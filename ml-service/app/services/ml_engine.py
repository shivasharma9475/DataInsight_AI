"""
AutoML-style engine. No user code required: pick a task, we pick/try sane
algorithms, handle preprocessing, and return metrics + predictions the
frontend can chart directly.
"""
from typing import Optional
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
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
    silhouette_score,
)

try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except Exception:
    XGBOOST_AVAILABLE = False


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
    y_raw = df[target].astype(str).fillna("Unknown")
    le_target = LabelEncoder()
    y = le_target.fit_transform(y_raw)
    X, _ = _prep_features(df, feature_columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if len(set(y)) > 1 else None
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

    results = {}
    best_name, best_score, best_model = None, -1, None
    chosen = [algorithm] if algorithm and algorithm in models else models.keys()

    for name in chosen:
        model = models[name]
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        acc = accuracy_score(y_test, preds)
        results[name] = {
            "accuracy": round(float(acc), 4),
            "precision": round(float(precision_score(y_test, preds, average="weighted", zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, preds, average="weighted", zero_division=0)), 4),
            "f1_score": round(float(f1_score(y_test, preds, average="weighted", zero_division=0)), 4),
        }
        if acc > best_score:
            best_name, best_score, best_model = name, acc, model

    importances = None
    if hasattr(best_model, "feature_importances_"):
        importances = dict(zip(feature_columns, [round(float(i), 4) for i in best_model.feature_importances_]))
    elif hasattr(best_model, "coef_"):
        coefs = np.abs(best_model.coef_).mean(axis=0) if best_model.coef_.ndim > 1 else np.abs(best_model.coef_)
        importances = dict(zip(feature_columns, [round(float(i), 4) for i in coefs]))

    return {
        "task": "classification",
        "target": target,
        "models_tried": results,
        "best_model": best_name,
        "best_score": round(float(best_score), 4),
        "feature_importance": importances,
        "class_labels": le_target.classes_.tolist(),
    }


def run_regression(df: pd.DataFrame, target: str, feature_columns: list[str],
                    algorithm: Optional[str] = None) -> dict:
    data = df[[target] + feature_columns].dropna(subset=[target])
    y = data[target].astype(float)
    X, _ = _prep_features(data, feature_columns)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    models = {
        "linear_regression": LinearRegression(),
        "random_forest": RandomForestRegressor(n_estimators=200, random_state=42),
        "gradient_boosting": GradientBoostingRegressor(random_state=42),
    }

    results = {}
    best_name, best_score, best_model = None, -1e9, None
    chosen = [algorithm] if algorithm and algorithm in models else models.keys()

    for name in chosen:
        model = models[name]
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        r2 = r2_score(y_test, preds)
        results[name] = {
            "r2_score": round(float(r2), 4),
            "mae": round(float(mean_absolute_error(y_test, preds)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test, preds))), 4),
        }
        if r2 > best_score:
            best_name, best_score, best_model = name, r2, model

    importances = None
    if hasattr(best_model, "feature_importances_"):
        importances = dict(zip(feature_columns, [round(float(i), 4) for i in best_model.feature_importances_]))
    elif hasattr(best_model, "coef_"):
        importances = dict(zip(feature_columns, [round(float(i), 4) for i in best_model.coef_]))

    preds_all = best_model.predict(X_test)
    return {
        "task": "regression",
        "target": target,
        "models_tried": results,
        "best_model": best_name,
        "best_score": round(float(best_score), 4),
        "feature_importance": importances,
        "actual_vs_predicted": {
            "actual": y_test.tolist()[:200],
            "predicted": [round(float(p), 4) for p in preds_all.tolist()[:200]],
        },
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


def run_forecast(df: pd.DataFrame, date_column: str, target_column: str, periods: int = 30) -> dict:
    data = df[[date_column, target_column]].dropna().sort_values(date_column)
    data[date_column] = pd.to_datetime(data[date_column])
    data = data.set_index(date_column)

    series = data[target_column].astype(float)
    # Resample to daily if there's enough span, otherwise use as-is
    if series.index.to_series().diff().dt.days.median() and series.index.to_series().diff().dt.days.median() <= 1:
        series = series.resample("D").mean().interpolate()

    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        seasonal_periods = 7 if len(series) >= 14 else None
        model = ExponentialSmoothing(
            series, trend="add",
            seasonal="add" if seasonal_periods else None,
            seasonal_periods=seasonal_periods,
        ).fit()
        forecast = model.forecast(periods)
        method = "Holt-Winters Exponential Smoothing"
    except Exception:
        # Fallback: simple linear trend extrapolation
        x = np.arange(len(series))
        coeffs = np.polyfit(x, series.values, 1)
        future_x = np.arange(len(series), len(series) + periods)
        forecast_vals = np.polyval(coeffs, future_x)
        last_date = series.index[-1]
        freq = pd.infer_freq(series.index) or "D"
        future_index = pd.date_range(last_date, periods=periods + 1, freq=freq)[1:]
        forecast = pd.Series(forecast_vals, index=future_index)
        method = "Linear trend extrapolation"

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
        "trend_direction": trend_direction,
        "pct_change_projected": pct_change,
    }
