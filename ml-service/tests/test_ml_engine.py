import numpy as np
import pandas as pd

from app.services.ml_engine import (
    run_regression,
    run_classification,
    run_clustering,
    run_forecast,
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