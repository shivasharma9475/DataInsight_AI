"""
AutoML-style engine. No user code required: pick a task, we pick/try sane
algorithms, handle preprocessing, and return metrics + predictions the
frontend can chart directly.
"""
from typing import Optional
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold, KFold
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingRegressor,
)
from sklearn.tree import DecisionTreeClassifier
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    r2_score, mean_absolute_error, mean_squared_error,
    silhouette_score, confusion_matrix,
)

try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except Exception:
    XGBOOST_AVAILABLE = False


class MLEngineError(ValueError):
    """Raised for user-facing AutoML validation failures (bad target,
    not enough rows, no usable features, etc.)."""


# Categorical columns with more unique values than this (or more than half
# the rows, whichever is smaller) are almost always identifiers rather than
# useful predictive signal, and one-hot/label-encoding them adds noise and
# overfitting risk without real predictive value.
MAX_CATEGORICAL_CARDINALITY = 50

MIN_ROWS_REQUIRED = 10


def _select_and_validate_features(
    df: pd.DataFrame,
    target_column: Optional[str],
    feature_columns: list[str],
) -> tuple[list[str], list[str]]:
    """
    Clean up a requested feature list before training:

    - Drop the target column if the caller (accidentally or otherwise)
      included it, to prevent target leakage.
    - Drop columns that don't exist in the dataset.
    - Drop constant columns (zero variance -> zero signal).
    - Drop high-cardinality categorical/text columns (near-unique values
      per row -- almost certainly an identifier, not a real feature).
    - Drop datetime columns (not usable by these models without explicit
      feature engineering, which is out of scope here).

    Returns (clean_feature_columns, warnings).
    """
    warnings: list[str] = []
    clean: list[str] = []

    for col in feature_columns:
        if col == target_column:
            warnings.append(
                f"Dropped '{col}': it is the target column and would leak "
                "the answer into the features."
            )
            continue

        if col not in df.columns:
            warnings.append(f"Dropped '{col}': column not found in dataset.")
            continue

        series = df[col]

        if pd.api.types.is_datetime64_any_dtype(series):
            warnings.append(
                f"Dropped '{col}': datetime columns aren't used directly as "
                "model features."
            )
            continue

        non_null = series.dropna()
        if non_null.nunique() <= 1:
            warnings.append(
                f"Dropped '{col}': constant value across the dataset, no "
                "predictive signal."
            )
            continue

        if series.dtype == object or str(series.dtype).startswith("category"):
            cardinality_limit = min(MAX_CATEGORICAL_CARDINALITY, max(1, len(df) // 2))
            if non_null.nunique() > cardinality_limit:
                warnings.append(
                    f"Dropped '{col}': too many unique values ({non_null.nunique()}) "
                    "for a categorical feature -- likely an identifier column."
                )
                continue

        clean.append(col)

    if not clean:
        raise MLEngineError(
            "No usable feature columns remain after validation. "
            "Check the warnings for why each column was dropped."
        )

    return clean, warnings


def _validate_common(df: pd.DataFrame, target_column: str, feature_columns: list[str]) -> None:
    if df is None or df.empty:
        raise MLEngineError("Dataset is empty.")

    if not target_column:
        raise MLEngineError("target_column is required.")

    if target_column not in df.columns:
        raise MLEngineError(f"Target column '{target_column}' was not found in the dataset.")

    if not feature_columns:
        raise MLEngineError("At least one feature_column is required.")

    if len(df) < MIN_ROWS_REQUIRED:
        raise MLEngineError(
            f"Dataset has only {len(df)} row(s); at least {MIN_ROWS_REQUIRED} "
            "are required to train a reliable model."
        )


def _prep_features(df: pd.DataFrame, feature_columns: list[str]) -> tuple[pd.DataFrame, dict]:
    X = df[feature_columns].copy()
    encoders = {}
    for col in X.columns:
        if X[col].dtype == object or str(X[col].dtype).startswith("category"):
            X[col] = X[col].astype(str).fillna("Unknown")
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col])
            encoders[col] = le
        else:
            X[col] = X[col].fillna(X[col].median() if X[col].notna().any() else 0)
    return X, encoders


# ---------------------------------------------------------------------
# Explainability
#
# Global explanation = the model's own feature_importances_/coef_
# (already computed as `feature_importance` in each run_* result --
# real numbers straight from the fitted model, never invented).
#
# Local explanation ("why this specific prediction") is computed
# deterministically from the same fitted model:
#   - Linear/logistic models: exact per-feature contribution
#     = coef_i * (x_i - mean_i), which is a real decomposition of the
#     model's own linear equation.
#   - Tree-based models (no exact per-prediction decomposition without
#     SHAP): deterministic approximation
#     = feature_importance_i * (x_i - mean_i), i.e. how unusual this
#     feature's value is, weighted by how much the model relies on that
#     feature overall. Grounded entirely in real fitted-model numbers
#     and real input values -- never fabricated -- but is explicitly an
#     approximation, and is labeled as such in the output.
# ---------------------------------------------------------------------

def _local_contributions(
    model,
    row: pd.Series,
    feature_means: pd.Series,
    feature_columns: list[str],
    importances: Optional[dict],
    class_index: Optional[int] = None,
    top_n: int = 5,
) -> tuple[list[dict], str]:
    deviations = row[feature_columns] - feature_means[feature_columns]

    if hasattr(model, "coef_"):
        coefs = model.coef_
        if coefs.ndim > 1:
            idx = class_index if class_index is not None else 0
            idx = min(idx, coefs.shape[0] - 1)
            coefs = coefs[idx]
        contributions = {
            col: float(coefs[i] * deviations[col])
            for i, col in enumerate(feature_columns)
        }
        method = "exact_linear"
    elif importances:
        contributions = {
            col: float(importances.get(col, 0.0) * deviations[col])
            for col in feature_columns
        }
        method = "approximate_importance_weighted"
    else:
        return [], "unavailable"

    ranked = sorted(contributions.items(), key=lambda kv: abs(kv[1]), reverse=True)[:top_n]
    return (
        [
            {
                "feature": col,
                "value": round(float(row[col]), 4),
                "contribution": round(contrib, 4),
                "direction": "increases" if contrib > 0 else "decreases",
            }
            for col, contrib in ranked
        ],
        method,
    )


def build_explainability(
    model,
    X: pd.DataFrame,
    X_test: pd.DataFrame,
    y_test,
    feature_columns: list[str],
    importances: Optional[dict],
    task: str,
    class_labels: Optional[list[str]] = None,
    predictions=None,
    max_examples: int = 5,
) -> dict:
    """Global + local explainability for a just-trained model. Never
    fabricates numbers -- everything here is derived from the fitted
    model's real coefficients/importances and the real feature values."""
    feature_means = X[feature_columns].mean()

    global_top = None
    if importances:
        global_top = [
            {"feature": f, "importance": round(float(v), 4)}
            for f, v in sorted(importances.items(), key=lambda kv: abs(kv[1]), reverse=True)[:10]
        ]

    local_examples = []
    n_examples = min(max_examples, len(X_test))
    method_used = "unavailable"

    for i in range(n_examples):
        row = X_test.iloc[i]
        class_index = None
        predicted_value = None

        if task == "classification" and predictions is not None:
            pred_encoded = int(predictions[i])
            class_index = pred_encoded
            predicted_value = class_labels[pred_encoded] if class_labels else pred_encoded
        elif predictions is not None:
            predicted_value = round(float(predictions[i]), 4)

        contributions, method_used = _local_contributions(
            model, row, feature_means, feature_columns, importances, class_index
        )

        local_examples.append({
            "row_index": int(X_test.index[i]) if hasattr(X_test.index[i], "__int__") else i,
            "predicted_value": predicted_value,
            "top_contributing_features": contributions,
        })

    return {
        "global": {
            "top_features": global_top,
        },
        "local": {
            "method": method_used,
            "note": (
                "Local contributions are computed deterministically from the "
                "trained model's own coefficients/importances and each row's "
                "actual feature values."
                + (
                    " For tree-based models this is an approximation (importance "
                    "weighted by how unusual the value is), not an exact "
                    "per-prediction decomposition."
                    if method_used == "approximate_importance_weighted"
                    else ""
                )
            ),
            "examples": local_examples,
        },
    }


def recommend_task(profile: dict) -> dict:
    """Suggest which ML task(s) fit this dataset."""
    suggestions = []
    if profile["datetime_columns"] and profile["numerical_columns"]:
        suggestions.append({
            "task": "forecasting",
            "reason": f"Detected a date column and numeric metrics — time-series forecasting is available "
                      f"for columns like '{profile['numerical_columns'][0]}'.",
        })
    if profile["categorical_columns"]:
        low_card = [c for c in profile["categorical_columns"]]
        if low_card:
            suggestions.append({
                "task": "classification",
                "reason": f"Categorical column(s) such as '{low_card[0]}' could be predicted from the other fields.",
            })
    if len(profile["numerical_columns"]) >= 2:
        suggestions.append({
            "task": "regression",
            "reason": f"Multiple numeric columns detected — you can predict one (e.g. "
                      f"'{profile['numerical_columns'][0]}') from the others.",
        })
    if len(profile["numerical_columns"]) >= 2:
        suggestions.append({
            "task": "clustering",
            "reason": "Numeric features are available for unsupervised segmentation (e.g. customer segments).",
        })
    return {"suggestions": suggestions}


def run_classification(df: pd.DataFrame, target: str, feature_columns: list[str],
                        algorithm: Optional[str] = None) -> dict:
    _validate_common(df, target, feature_columns)
    clean_features, warnings = _select_and_validate_features(df, target, feature_columns)

    y_raw = df[target].astype(str).fillna("Unknown")

    class_counts = y_raw.value_counts()
    if len(class_counts) < 2:
        raise MLEngineError(
            f"Target column '{target}' has only {len(class_counts)} distinct "
            "class -- classification needs at least 2."
        )

    le_target = LabelEncoder()
    y = le_target.fit_transform(y_raw)
    X, _ = _prep_features(df, clean_features)

    # Stratification requires every class to have at least 2 members.
    can_stratify = class_counts.min() >= 2

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if can_stratify else None
    )

    if not can_stratify:
        warnings.append(
            "Some target classes have only one example, so the train/test "
            "split could not be stratified -- metrics may be less reliable."
        )

    models = {
        "logistic_regression": LogisticRegression(max_iter=1000),
        "decision_tree": DecisionTreeClassifier(max_depth=8, random_state=42),
        "random_forest": RandomForestClassifier(n_estimators=200, random_state=42),
    }
    if XGBOOST_AVAILABLE:
        models["xgboost"] = XGBClassifier(
            n_estimators=200, use_label_encoder=False, eval_metric="logloss", random_state=42
        )

    # Cross-validation folds: at most 5, but never more than the smallest
    # class size (StratifiedKFold requires every fold to see every class).
    cv_folds = min(5, int(class_counts.min())) if can_stratify else 0

    results = {}
    best_name, best_score, best_model = None, -1, None
    chosen = [algorithm] if algorithm and algorithm in models else models.keys()

    for name in chosen:
        model = models[name]
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        acc = accuracy_score(y_test, preds)

        metrics = {
            "accuracy": round(float(acc), 4),
            "precision": round(float(precision_score(y_test, preds, average="weighted", zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, preds, average="weighted", zero_division=0)), 4),
            "f1_score": round(float(f1_score(y_test, preds, average="weighted", zero_division=0)), 4),
        }

        if cv_folds >= 2:
            try:
                from sklearn.base import clone
                cv_scores = cross_val_score(
                    clone(models[name]),
                    X, y, cv=StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42),
                    scoring="accuracy",
                )
                metrics["cv_accuracy_mean"] = round(float(cv_scores.mean()), 4)
                metrics["cv_accuracy_std"] = round(float(cv_scores.std()), 4)
                metrics["cv_folds"] = cv_folds
            except Exception:
                # Cross-validation is a nice-to-have; never fail the whole
                # run because CV couldn't be computed for one model.
                pass

        results[name] = metrics

        if acc > best_score:
            best_name, best_score, best_model = name, acc, model

    importances = None
    if hasattr(best_model, "feature_importances_"):
        importances = dict(zip(clean_features, [round(float(i), 4) for i in best_model.feature_importances_]))
    elif hasattr(best_model, "coef_"):
        coefs = np.abs(best_model.coef_).mean(axis=0) if best_model.coef_.ndim > 1 else np.abs(best_model.coef_)
        importances = dict(zip(clean_features, [round(float(i), 4) for i in coefs]))

    best_preds = best_model.predict(X_test)
    cm = confusion_matrix(y_test, best_preds).tolist()

    explainability = build_explainability(
        best_model, X, X_test, y_test, clean_features, importances,
        task="classification", class_labels=le_target.classes_.tolist(),
        predictions=best_preds,
    )

    return {
        "task": "classification",
        "target": target,
        "feature_columns": clean_features,
        "models_tried": results,
        "best_model": best_name,
        "best_score": round(float(best_score), 4),
        "feature_importance": importances,
        "class_labels": le_target.classes_.tolist(),
        "confusion_matrix": cm,
        "warnings": warnings,
        "explainability": explainability,
    }


def run_regression(df: pd.DataFrame, target: str, feature_columns: list[str],
                    algorithm: Optional[str] = None) -> dict:
    _validate_common(df, target, feature_columns)
    clean_features, warnings = _select_and_validate_features(df, target, feature_columns)

    data = df[[target] + clean_features].dropna(subset=[target])

    if len(data) < MIN_ROWS_REQUIRED:
        raise MLEngineError(
            f"Only {len(data)} row(s) have a non-null target value; at least "
            f"{MIN_ROWS_REQUIRED} are required."
        )

    y = data[target].astype(float)

    if y.nunique() <= 1:
        raise MLEngineError(
            f"Target column '{target}' is constant -- there is nothing to predict."
        )

    X, _ = _prep_features(data, clean_features)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    models = {
        "linear_regression": LinearRegression(),
        "random_forest": RandomForestRegressor(n_estimators=200, random_state=42),
        "gradient_boosting": GradientBoostingRegressor(random_state=42),
    }

    cv_folds = min(5, len(data) // 5) if len(data) >= 25 else 0

    results = {}
    best_name, best_score, best_model = None, -1e9, None
    chosen = [algorithm] if algorithm and algorithm in models else models.keys()

    for name in chosen:
        model = models[name]
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        r2 = r2_score(y_test, preds)

        metrics = {
            "r2_score": round(float(r2), 4),
            "mae": round(float(mean_absolute_error(y_test, preds)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test, preds))), 4),
        }

        if cv_folds >= 2:
            try:
                from sklearn.base import clone
                cv_scores = cross_val_score(
                    clone(models[name]),
                    X, y, cv=KFold(n_splits=cv_folds, shuffle=True, random_state=42),
                    scoring="r2",
                )
                metrics["cv_r2_mean"] = round(float(cv_scores.mean()), 4)
                metrics["cv_r2_std"] = round(float(cv_scores.std()), 4)
                metrics["cv_folds"] = cv_folds
            except Exception:
                pass

        results[name] = metrics

        if r2 > best_score:
            best_name, best_score, best_model = name, r2, model

    importances = None
    if hasattr(best_model, "feature_importances_"):
        importances = dict(zip(clean_features, [round(float(i), 4) for i in best_model.feature_importances_]))
    elif hasattr(best_model, "coef_"):
        importances = dict(zip(clean_features, [round(float(i), 4) for i in best_model.coef_]))

    preds_all = best_model.predict(X_test)

    explainability = build_explainability(
        best_model, X, X_test, y_test, clean_features, importances,
        task="regression", predictions=preds_all,
    )

    return {
        "task": "regression",
        "target": target,
        "feature_columns": clean_features,
        "models_tried": results,
        "best_model": best_name,
        "best_score": round(float(best_score), 4),
        "feature_importance": importances,
        "actual_vs_predicted": {
            "actual": y_test.tolist()[:200],
            "predicted": [round(float(p), 4) for p in preds_all.tolist()[:200]],
        },
        "warnings": warnings,
        "explainability": explainability,
    }


def run_clustering(df: pd.DataFrame, feature_columns: list[str], algorithm: Optional[str] = None,
                    n_clusters: int = 4) -> dict:
    X, _ = _prep_features(df, feature_columns)
    X_scaled = StandardScaler().fit_transform(X)

    algo = algorithm or "kmeans"
    if algo == "dbscan":
        model = DBSCAN(eps=0.8, min_samples=5)
        labels = model.fit_predict(X_scaled)
    else:
        algo = "kmeans"
        model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = model.fit_predict(X_scaled)

    sil = None
    if len(set(labels)) > 1 and len(set(labels)) < len(labels):
        try:
            sil = round(float(silhouette_score(X_scaled, labels)), 4)
        except Exception:
            sil = None

    cluster_sizes = pd.Series(labels).value_counts().to_dict()
    # 2D projection for plotting: use first two scaled features (or PCA if more)
    if X_scaled.shape[1] > 2:
        from sklearn.decomposition import PCA
        coords = PCA(n_components=2, random_state=42).fit_transform(X_scaled)
    else:
        coords = X_scaled

    return {
        "task": "clustering",
        "algorithm": algo,
        "n_clusters_found": int(len(set(labels)) - (1 if -1 in labels else 0)),
        "silhouette_score": sil,
        "cluster_sizes": {str(k): int(v) for k, v in cluster_sizes.items()},
        "points": {
            "x": coords[:, 0].tolist()[:2000],
            "y": coords[:, 1].tolist()[:2000],
            "cluster": [int(l) for l in labels.tolist()][:2000],
        },
    }


MIN_FORECAST_OBSERVATIONS = 5


class ForecastError(MLEngineError):
    """Raised for forecasting-specific validation failures."""


def _prepare_time_series(
    df: pd.DataFrame, date_column: str, target_column: str
) -> tuple[pd.Series, list[str]]:
    """
    Validate and clean a (date, metric) pair into a regularly-spaced,
    numeric time series ready for forecasting.

    Handles/validates:
      - missing columns
      - non-numeric metric column
      - insufficient observations
      - duplicate periods (same date appearing more than once -> averaged)
      - missing periods (gaps in the date range -> interpolated)
    """
    warnings: list[str] = []

    if date_column not in df.columns:
        raise ForecastError(f"Date column '{date_column}' was not found in the dataset.")

    if target_column not in df.columns:
        raise ForecastError(f"Metric column '{target_column}' was not found in the dataset.")

    parsed_dates = pd.to_datetime(df[date_column], errors="coerce")
    if parsed_dates.notna().mean() < 0.5:
        raise ForecastError(
            f"Column '{date_column}' does not look like a valid date/time column."
        )

    metric = pd.to_numeric(df[target_column], errors="coerce")
    if metric.notna().mean() < 0.5:
        raise ForecastError(
            f"Column '{target_column}' does not look like a numeric metric column."
        )

    working = pd.DataFrame({"date": parsed_dates, "value": metric}).dropna()

    if len(working) < MIN_FORECAST_OBSERVATIONS:
        raise ForecastError(
            f"Only {len(working)} valid (date, value) observation(s) found; at "
            f"least {MIN_FORECAST_OBSERVATIONS} are required to forecast."
        )

    # Duplicate periods: same exact timestamp appearing more than once.
    duplicate_count = int(working["date"].duplicated().sum())
    if duplicate_count:
        working = working.groupby("date", as_index=True)["value"].mean()
        warnings.append(
            f"Found {duplicate_count} duplicate date/time value(s); they were "
            "averaged together."
        )
    else:
        working = working.set_index("date")["value"]

    working = working.sort_index()

    # Determine a sensible regular frequency and fill any gaps.
    inferred_freq = pd.infer_freq(working.index)
    if inferred_freq is None:
        median_gap_days = working.index.to_series().diff().dt.days.median()
        if pd.isna(median_gap_days):
            inferred_freq = "D"
        elif median_gap_days <= 1:
            inferred_freq = "D"
        elif median_gap_days <= 8:
            inferred_freq = "W"
        elif median_gap_days <= 32:
            inferred_freq = "MS"
        else:
            inferred_freq = "YS"

    full_index = pd.date_range(working.index.min(), working.index.max(), freq=inferred_freq)
    reindexed = working.reindex(full_index)

    missing_count = int(reindexed.isna().sum())
    if missing_count:
        reindexed = reindexed.interpolate(limit_direction="both")
        warnings.append(
            f"Detected {missing_count} missing period(s) in the date range; "
            "values were linearly interpolated."
        )

    return reindexed, warnings


def _fit_forecast_method(series: pd.Series, periods: int):
    """Fit the configured method and return (forecast, in_sample_fitted, method_name)."""
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        seasonal_periods = 7 if len(series) >= 14 else None
        model = ExponentialSmoothing(
            series, trend="add",
            seasonal="add" if seasonal_periods else None,
            seasonal_periods=seasonal_periods,
        ).fit()
        forecast = model.forecast(periods)
        fitted = model.fittedvalues
        method = "Holt-Winters Exponential Smoothing"
    except Exception:
        # Fallback: simple linear trend extrapolation
        x = np.arange(len(series))
        coeffs = np.polyfit(x, series.values, 1)
        fitted = pd.Series(np.polyval(coeffs, x), index=series.index)
        future_x = np.arange(len(series), len(series) + periods)
        forecast_vals = np.polyval(coeffs, future_x)
        last_date = series.index[-1]
        freq = pd.infer_freq(series.index) or "D"
        future_index = pd.date_range(last_date, periods=periods + 1, freq=freq)[1:]
        forecast = pd.Series(forecast_vals, index=future_index)
        method = "Linear trend extrapolation"

    return forecast, fitted, method


MIN_RESIDUALS_FOR_CONFIDENCE_INTERVAL = 5


def _evaluate_forecast_method(series: pd.Series) -> dict:
    """
    Backtest: hold out the last portion of known history, refit on the
    remainder, forecast the held-out horizon, and compare against the
    actual values. Only meaningful when there's enough history to hold
    out a real chunk without starving the training fit.

    Always returns a dict with an "available" flag, so callers/consumers
    can tell the difference between "we checked and it's not possible"
    and a silently missing field.
    """
    holdout_size = max(1, min(len(series) // 5, 14))
    if len(series) - holdout_size < MIN_FORECAST_OBSERVATIONS:
        return {
            "available": False,
            "reason": (
                f"Not enough history for a reliable holdout evaluation "
                f"(need at least {MIN_FORECAST_OBSERVATIONS + holdout_size} "
                f"observations, have {len(series)})."
            ),
        }

    train = series.iloc[:-holdout_size]
    actual_holdout = series.iloc[-holdout_size:]

    try:
        forecast, _, method = _fit_forecast_method(train, holdout_size)
    except Exception:
        return {
            "available": False,
            "reason": "The forecasting method could not be fit on the holdout training window.",
        }

    forecast = forecast.iloc[:holdout_size]
    if len(forecast) != len(actual_holdout):
        return {
            "available": False,
            "reason": "Holdout forecast length did not match the held-out actuals.",
        }

    errors = actual_holdout.values - forecast.values
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors ** 2)))

    mape = None
    mape_reason = None
    if np.all(actual_holdout.values != 0):
        mape = round(float(np.mean(np.abs(errors / actual_holdout.values)) * 100), 2)
    else:
        mape_reason = "MAPE is undefined because the holdout period contains zero values (division by zero)."

    return {
        "available": True,
        "method": method,
        "holdout_periods": holdout_size,
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": mape,
        "mape_unavailable_reason": mape_reason,
    }


def run_forecast(df: pd.DataFrame, date_column: str, target_column: str, periods: int = 30) -> dict:
    if periods is None or periods < 1:
        raise ForecastError("periods must be a positive integer.")
    if periods > 730:
        raise ForecastError("periods cannot exceed 730 (2 years) in a single request.")

    series, warnings = _prepare_time_series(df, date_column, target_column)

    forecast, fitted, method = _fit_forecast_method(series, periods)

    # Approximate 95% confidence interval, grown with the forecast horizon,
    # based on this model's own in-sample residual variance. This is a
    # standard lightweight approximation (not an exact statistical interval
    # like statsmodels' get_forecast() confidence intervals, which aren't
    # available for every method used here) -- always labeled as such, and
    # only produced when there are enough residuals to estimate variance
    # in a way that's actually defensible.
    aligned_fitted = fitted.reindex(series.index)
    residuals = (series - aligned_fitted).dropna()

    if len(residuals) < MIN_RESIDUALS_FOR_CONFIDENCE_INTERVAL:
        confidence_interval = {
            "available": False,
            "reason": (
                "Not enough in-sample residuals "
                f"({len(residuals)}) to estimate a defensible confidence interval; "
                f"at least {MIN_RESIDUALS_FOR_CONFIDENCE_INTERVAL} are required."
            ),
        }
    else:
        residual_std = float(residuals.std())
        if not residual_std or residual_std <= 0:
            confidence_interval = {
                "available": False,
                "reason": "In-sample residual variance is zero or undefined for this series, so no interval can be estimated.",
            }
        else:
            horizon_steps = np.arange(1, len(forecast) + 1)
            margin = 1.96 * residual_std * np.sqrt(horizon_steps)
            confidence_interval = {
                "available": True,
                "lower": [round(float(v), 4) for v in (forecast.values - margin)],
                "upper": [round(float(v), 4) for v in (forecast.values + margin)],
                "level": 0.95,
                "note": (
                    "Approximate interval based on this model's in-sample residual "
                    "variance, widening with the forecast horizon. Not an exact "
                    "statistical interval."
                ),
            }

    evaluation = _evaluate_forecast_method(series)

    trend_direction = "upward" if forecast.iloc[-1] > series.iloc[-1] else "downward"
    pct_change = round(((forecast.iloc[-1] - series.iloc[-1]) / abs(series.iloc[-1] + 1e-9)) * 100, 2)

    return {
        "task": "forecasting",
        "method": method,
        "date_column": date_column,
        "target_column": target_column,
        "history": {
            "x": series.index.astype(str).tolist()[-180:],
            "y": series.values.tolist()[-180:],
        },
        "forecast": {
            "x": forecast.index.astype(str).tolist(),
            "y": [round(float(v), 4) for v in forecast.values.tolist()],
        },
        "confidence_interval": confidence_interval,
        "evaluation": evaluation,
        "trend_direction": trend_direction,
        "pct_change_projected": pct_change,
        "warnings": warnings,
    }
