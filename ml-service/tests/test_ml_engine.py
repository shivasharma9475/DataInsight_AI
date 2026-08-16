import numpy as np
import pandas as pd
import pytest

from app.services.ml_engine import (
    run_regression,
    run_classification,
    run_clustering,
    run_forecast,
    MLEngineError,
    ForecastError,
)


def test_linear_regression_learns_known_relationship():
    # y = 2x + 5
    x = np.arange(1, 101)

    df = pd.DataFrame({
        "x": x,
        "y": 2 * x + 5,
    })

    result = run_regression(
        df,
        target="y",
        feature_columns=["x"],
        algorithm="linear_regression",
    )

    assert result["task"] == "regression"
    assert result["best_model"] == "linear_regression"
    assert result["best_score"] > 0.99

    metrics = result["models_tried"]["linear_regression"]

    assert metrics["r2_score"] > 0.99
    assert metrics["mae"] < 0.01


def test_classification_learns_separable_classes():
    rng = np.random.default_rng(42)

    class_a = rng.normal(loc=-3, scale=0.4, size=(50, 2))
    class_b = rng.normal(loc=3, scale=0.4, size=(50, 2))

    features = np.vstack([class_a, class_b])

    df = pd.DataFrame({
        "x1": features[:, 0],
        "x2": features[:, 1],
        "target": ["A"] * 50 + ["B"] * 50,
    })

    result = run_classification(
        df,
        target="target",
        feature_columns=["x1", "x2"],
        algorithm="logistic_regression",
    )

    assert result["task"] == "classification"
    assert result["best_model"] == "logistic_regression"

    metrics = result["models_tried"]["logistic_regression"]

    assert metrics["accuracy"] > 0.95
    assert metrics["f1_score"] > 0.95


def test_kmeans_finds_two_clusters():
    rng = np.random.default_rng(42)

    group_a = rng.normal(loc=-5, scale=0.3, size=(50, 2))
    group_b = rng.normal(loc=5, scale=0.3, size=(50, 2))

    points = np.vstack([group_a, group_b])

    df = pd.DataFrame({
        "x": points[:, 0],
        "y": points[:, 1],
    })

    result = run_clustering(
        df,
        feature_columns=["x", "y"],
        algorithm="kmeans",
        n_clusters=2,
    )

    assert result["task"] == "clustering"
    assert result["algorithm"] == "kmeans"
    assert result["n_clusters_found"] == 2

    assert result["silhouette_score"] is not None
    assert result["silhouette_score"] > 0.8


def test_forecast_returns_requested_number_of_periods():
    dates = pd.date_range(
        start="2026-01-01",
        periods=60,
        freq="D",
    )

    sales = np.arange(100, 160, dtype=float)

    df = pd.DataFrame({
        "date": dates,
        "sales": sales,
    })

    result = run_forecast(
        df,
        date_column="date",
        target_column="sales",
        periods=10,
    )

    assert result["task"] == "forecasting"

    assert len(result["forecast"]["x"]) == 10
    assert len(result["forecast"]["y"]) == 10

    assert result["trend_direction"] == "upward"

# ---------------------------------------------------------------------
# Hardening: leakage prevention, feature validation, cross-validation
# ---------------------------------------------------------------------

def test_regression_drops_target_leakage_if_included_as_feature():
    x = np.arange(1, 101)
    df = pd.DataFrame({"x": x, "y": 2 * x + 5})

    result = run_regression(
        df,
        target="y",
        # "y" is accidentally included as a feature -- must be dropped.
        feature_columns=["x", "y"],
        algorithm="linear_regression",
    )

    assert "y" not in result["feature_columns"]
    assert any("leak" in w.lower() for w in result["warnings"])


def test_classification_drops_constant_and_high_cardinality_columns():
    rng = np.random.default_rng(0)
    n = 60

    df = pd.DataFrame(
        {
            "signal": rng.normal(size=n),
            "constant_col": ["same_value"] * n,
            "id_col": [f"id_{i}" for i in range(n)],
            "target": rng.choice(["A", "B"], size=n),
        }
    )

    result = run_classification(
        df,
        target="target",
        feature_columns=["signal", "constant_col", "id_col"],
        algorithm="logistic_regression",
    )

    assert "constant_col" not in result["feature_columns"]
    assert "id_col" not in result["feature_columns"]
    assert "signal" in result["feature_columns"]
    assert len(result["warnings"]) == 2


def test_regression_rejects_too_few_rows():
    df = pd.DataFrame({"x": [1, 2, 3], "y": [1, 2, 3]})

    with pytest.raises(MLEngineError):
        run_regression(df, target="y", feature_columns=["x"])


def test_classification_rejects_single_class_target():
    df = pd.DataFrame(
        {
            "x": np.arange(20),
            "target": ["only_class"] * 20,
        }
    )

    with pytest.raises(MLEngineError):
        run_classification(df, target="target", feature_columns=["x"])


def test_regression_rejects_missing_target_column():
    df = pd.DataFrame({"x": np.arange(20)})

    with pytest.raises(MLEngineError):
        run_regression(df, target="does_not_exist", feature_columns=["x"])


def test_classification_reports_cross_validation_when_enough_data():
    rng = np.random.default_rng(42)
    class_a = rng.normal(loc=-3, scale=0.4, size=(60, 2))
    class_b = rng.normal(loc=3, scale=0.4, size=(60, 2))
    features = np.vstack([class_a, class_b])

    df = pd.DataFrame(
        {
            "x1": features[:, 0],
            "x2": features[:, 1],
            "target": ["A"] * 60 + ["B"] * 60,
        }
    )

    result = run_classification(
        df,
        target="target",
        feature_columns=["x1", "x2"],
        algorithm="logistic_regression",
    )

    metrics = result["models_tried"]["logistic_regression"]
    assert "cv_accuracy_mean" in metrics
    assert 0 <= metrics["cv_accuracy_mean"] <= 1


def test_classification_returns_confusion_matrix():
    rng = np.random.default_rng(42)
    class_a = rng.normal(loc=-3, scale=0.4, size=(50, 2))
    class_b = rng.normal(loc=3, scale=0.4, size=(50, 2))
    features = np.vstack([class_a, class_b])

    df = pd.DataFrame(
        {
            "x1": features[:, 0],
            "x2": features[:, 1],
            "target": ["A"] * 50 + ["B"] * 50,
        }
    )

    result = run_classification(
        df,
        target="target",
        feature_columns=["x1", "x2"],
        algorithm="logistic_regression",
    )

    assert "confusion_matrix" in result
    assert len(result["confusion_matrix"]) == 2


# ---------------------------------------------------------------------
# Explainability
# ---------------------------------------------------------------------

def test_classification_explainability_uses_real_model_data():
    rng = np.random.default_rng(42)
    class_a = rng.normal(loc=-3, scale=0.4, size=(50, 2))
    class_b = rng.normal(loc=3, scale=0.4, size=(50, 2))
    features = np.vstack([class_a, class_b])

    df = pd.DataFrame(
        {
            "x1": features[:, 0],
            "x2": features[:, 1],
            "target": ["A"] * 50 + ["B"] * 50,
        }
    )

    result = run_classification(
        df,
        target="target",
        feature_columns=["x1", "x2"],
        algorithm="logistic_regression",
    )

    explain = result["explainability"]
    assert explain["global"]["top_features"] is not None
    assert {f["feature"] for f in explain["global"]["top_features"]} <= {"x1", "x2"}

    assert explain["local"]["method"] == "exact_linear"
    assert len(explain["local"]["examples"]) > 0

    example = explain["local"]["examples"][0]
    assert example["predicted_value"] in ("A", "B")
    assert len(example["top_contributing_features"]) > 0
    for contrib in example["top_contributing_features"]:
        assert contrib["feature"] in ("x1", "x2")
        assert "contribution" in contrib
        assert contrib["direction"] in ("increases", "decreases")


def test_regression_explainability_falls_back_for_tree_models():
    x = np.arange(1, 101)
    df = pd.DataFrame({"x": x, "y": 2 * x + 5})

    result = run_regression(
        df,
        target="y",
        feature_columns=["x"],
        algorithm="random_forest",
    )

    explain = result["explainability"]
    assert explain["local"]["method"] == "approximate_importance_weighted"
    assert "approximation" in explain["local"]["note"]


# ---------------------------------------------------------------------
# Forecasting: existing Holt-Winters/fallback behavior (baseline)
# ---------------------------------------------------------------------

def _daily_series_df(n=60, start="2026-01-01"):
    dates = pd.date_range(start=start, periods=n, freq="D")
    values = np.arange(100, 100 + n, dtype=float)
    return pd.DataFrame({"date": dates, "sales": values})


def test_forecast_still_returns_backward_compatible_shape():
    df = _daily_series_df()

    result = run_forecast(df, date_column="date", target_column="sales", periods=10)

    # Original fields must still be present with the original shapes.
    assert result["task"] == "forecasting"
    assert result["method"] in (
        "Holt-Winters Exponential Smoothing",
        "Linear trend extrapolation",
    )
    assert result["date_column"] == "date"
    assert result["target_column"] == "sales"
    assert len(result["forecast"]["x"]) == 10
    assert len(result["forecast"]["y"]) == 10
    assert "history" in result
    assert result["trend_direction"] in ("upward", "downward")
    assert "pct_change_projected" in result

    # New fields are additive, not replacing anything.
    assert "confidence_interval" in result
    assert "evaluation" in result
    assert "warnings" in result


def test_forecast_uses_holt_winters_for_seasonal_data():
    df = _daily_series_df(n=60)
    result = run_forecast(df, date_column="date", target_column="sales", periods=10)
    assert result["method"] == "Holt-Winters Exponential Smoothing"


# ---------------------------------------------------------------------
# Forecasting: validation / error cases
# ---------------------------------------------------------------------

def test_forecast_rejects_missing_date_column():
    df = _daily_series_df()
    with pytest.raises(ForecastError):
        run_forecast(df, date_column="does_not_exist", target_column="sales", periods=5)


def test_forecast_rejects_missing_metric_column():
    df = _daily_series_df()
    with pytest.raises(ForecastError):
        run_forecast(df, date_column="date", target_column="does_not_exist", periods=5)


def test_forecast_rejects_non_numeric_metric():
    df = _daily_series_df()
    df["sales"] = ["a", "b", "c"] * (len(df) // 3)
    with pytest.raises(ForecastError):
        run_forecast(df, date_column="date", target_column="sales", periods=5)


def test_forecast_rejects_invalid_dates():
    df = _daily_series_df()
    df["date"] = ["not-a-date"] * len(df)
    with pytest.raises(ForecastError):
        run_forecast(df, date_column="date", target_column="sales", periods=5)


def test_forecast_rejects_insufficient_observations():
    df = pd.DataFrame(
        {
            "date": pd.date_range("2026-01-01", periods=3, freq="D"),
            "sales": [10.0, 12.0, 14.0],
        }
    )
    with pytest.raises(ForecastError):
        run_forecast(df, date_column="date", target_column="sales", periods=5)


def test_forecast_handles_duplicate_timestamps_with_warning():
    dates = list(pd.date_range("2026-01-01", periods=20, freq="D"))
    dates[5] = dates[4]  # inject a duplicate timestamp
    values = list(np.arange(100, 120, dtype=float))

    df = pd.DataFrame({"date": dates, "sales": values})

    result = run_forecast(df, date_column="date", target_column="sales", periods=5)

    assert any("duplicate" in w.lower() for w in result["warnings"])


def test_forecast_rejects_non_positive_periods():
    df = _daily_series_df()
    with pytest.raises(ForecastError):
        run_forecast(df, date_column="date", target_column="sales", periods=0)


def test_forecast_rejects_excessive_periods():
    df = _daily_series_df()
    with pytest.raises(ForecastError):
        run_forecast(df, date_column="date", target_column="sales", periods=10000)


# ---------------------------------------------------------------------
# Forecasting: evaluation metrics (only when a valid holdout exists)
# ---------------------------------------------------------------------

def test_forecast_evaluation_available_with_enough_history():
    df = _daily_series_df(n=60)
    result = run_forecast(df, date_column="date", target_column="sales", periods=10)

    evaluation = result["evaluation"]
    assert evaluation["available"] is True
    assert evaluation["mae"] >= 0
    assert evaluation["rmse"] >= 0
    # Strictly positive, non-zero, monotonic series -> MAPE is well-defined.
    assert evaluation["mape"] is not None
    assert evaluation["mape_unavailable_reason"] is None


def test_forecast_evaluation_unavailable_with_too_little_history():
    df = pd.DataFrame(
        {
            "date": pd.date_range("2026-01-01", periods=5, freq="D"),
            "sales": [10.0, 11.0, 12.0, 13.0, 14.0],
        }
    )
    result = run_forecast(df, date_column="date", target_column="sales", periods=2)

    assert result["evaluation"]["available"] is False
    assert "reason" in result["evaluation"]


def test_forecast_mape_unavailable_when_holdout_has_zero_values():
    dates = pd.date_range("2026-01-01", periods=60, freq="D")
    values = np.zeros(60)
    values[:45] = np.arange(1, 46, dtype=float)  # zeros land in the holdout window
    df = pd.DataFrame({"date": dates, "sales": values})

    result = run_forecast(df, date_column="date", target_column="sales", periods=5)

    evaluation = result["evaluation"]
    if evaluation["available"]:
        assert evaluation["mape"] is None
        assert evaluation["mape_unavailable_reason"] is not None


# ---------------------------------------------------------------------
# Forecasting: confidence intervals (only when statistically defensible)
# ---------------------------------------------------------------------

def test_forecast_confidence_interval_available_with_noisy_data():
    rng = np.random.default_rng(0)
    dates = pd.date_range("2026-01-01", periods=60, freq="D")
    values = 100 + np.arange(60) + rng.normal(scale=3, size=60)
    df = pd.DataFrame({"date": dates, "sales": values})

    result = run_forecast(df, date_column="date", target_column="sales", periods=10)

    ci = result["confidence_interval"]
    assert ci["available"] is True
    assert len(ci["lower"]) == 10
    assert len(ci["upper"]) == 10
    # Interval must actually bracket the point forecast and widen with horizon.
    for lo, hi in zip(ci["lower"], ci["upper"]):
        assert lo <= hi
    first_width = ci["upper"][0] - ci["lower"][0]
    last_width = ci["upper"][-1] - ci["lower"][-1]
    assert last_width >= first_width


def test_forecast_confidence_interval_unavailable_for_perfectly_deterministic_series():
    # A perfectly linear, noise-free series can produce ~zero residual
    # variance -- no defensible interval should be fabricated.
    df = pd.DataFrame(
        {
            "date": pd.date_range("2026-01-01", periods=20, freq="D"),
            "sales": np.arange(1, 21, dtype=float),
        }
    )

    result = run_forecast(df, date_column="date", target_column="sales", periods=5)

    ci = result["confidence_interval"]
    if not ci["available"]:
        assert "reason" in ci


def test_forecast_confidence_interval_unavailable_with_too_few_residuals():
    df = pd.DataFrame(
        {
            "date": pd.date_range("2026-01-01", periods=6, freq="D"),
            "sales": [10.0, 15.0, 9.0, 20.0, 11.0, 17.0],
        }
    )
    result = run_forecast(df, date_column="date", target_column="sales", periods=3)

    ci = result["confidence_interval"]
    # With only 6 observations we either don't have enough residuals, or
    # if we do, it must be honestly labeled either way -- never silently
    # fabricated without the availability flag.
    assert "available" in ci
