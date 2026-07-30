import pandas as pd
import pytest

from app.services.recommendation_engine import generate_recommendations


# ============================================================
# Helpers
# ============================================================

def get_recommendations_by_type(result, recommendation_type):
    return [
        item
        for item in result["recommendations"]
        if item["type"] == recommendation_type
    ]


# ============================================================
# 1. Strong Segment / Growth Opportunity
# ============================================================

def test_detects_growth_opportunity():
    df = pd.DataFrame({
        "region": [
            "North",
            "North",
            "South",
            "South",
        ],
        "sales": [
            900,
            900,
            100,
            100,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=["region"],
    )

    growth = get_recommendations_by_type(
        result,
        "growth_opportunity",
    )

    assert len(growth) >= 1

    north = next(
        item
        for item in growth
        if item["evidence"]["value"] == "North"
    )

    assert north["evidence"]["dimension"] == "region"
    assert north["evidence"]["metric"] == "sales"
    assert north["evidence"]["segment_value"] == 1800


# ============================================================
# 2. Weak Segment / Decline Intervention
# ============================================================

def test_detects_decline_intervention():
    df = pd.DataFrame({
        "region": [
            "North",
            "North",
            "South",
            "South",
        ],
        "sales": [
            900,
            900,
            100,
            100,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=["region"],
    )

    declines = get_recommendations_by_type(
        result,
        "decline_intervention",
    )

    assert len(declines) >= 1

    south = next(
        item
        for item in declines
        if item["evidence"]["value"] == "South"
    )

    assert south["evidence"]["segment_value"] == 200

    assert (
        south["evidence"][
            "relative_difference_percentage"
        ]
        < 0
    )


# ============================================================
# 3. Concentration Risk
# ============================================================

def test_detects_concentration_risk():
    df = pd.DataFrame({
        "region": [
            "North",
            "North",
            "South",
            "West",
        ],
        "sales": [
            800,
            800,
            100,
            100,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=["region"],
    )

    risks = get_recommendations_by_type(
        result,
        "concentration_risk",
    )

    assert len(risks) >= 1

    risk = risks[0]

    assert risk["evidence"]["dimension"] == "region"
    assert risk["evidence"]["value"] == "North"
    assert risk["evidence"]["segment_value"] == 1600
    assert risk["evidence"]["total_value"] == 1800

    assert (
        risk["evidence"]["share_percentage"]
        > 50
    )


# ============================================================
# 4. Missing Data
# ============================================================

def test_detects_missing_values():
    df = pd.DataFrame({
        "region": [
            "North",
            None,
            None,
            "South",
            None,
        ],
        "sales": [
            100,
            200,
            300,
            400,
            500,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=["region"],
    )

    quality = get_recommendations_by_type(
        result,
        "data_quality",
    )

    missing_region = next(
        item
        for item in quality
        if item["evidence"].get("column") == "region"
    )

    assert (
        missing_region["evidence"]["missing_count"]
        == 3
    )

    assert (
        missing_region["evidence"]["missing_percentage"]
        == 60.0
    )

    assert missing_region["priority"] in {
        "high",
        "medium",
        "low",
    }


# ============================================================
# 5. Duplicate Records
# ============================================================

def test_detects_duplicate_rows():
    df = pd.DataFrame({
        "region": [
            "North",
            "North",
            "North",
            "North",
        ],
        "sales": [
            100,
            100,
            100,
            100,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=["region"],
    )

    quality = get_recommendations_by_type(
        result,
        "data_quality",
    )

    duplicates = [
        item
        for item in quality
        if "duplicate_rows" in item["evidence"]
    ]

    assert len(duplicates) == 1

    # duplicated() considers the first row original,
    # so remaining three are duplicates.
    assert (
        duplicates[0]["evidence"]["duplicate_rows"]
        == 3
    )

    assert (
        duplicates[0]["evidence"]["duplicate_percentage"]
        == 75.0
    )


# ============================================================
# 6. Statistical Anomaly
# ============================================================

def test_detects_statistical_anomaly():
    values = [100] * 100
    values.append(10000)

    df = pd.DataFrame({
        "sales": values,
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
    )

    anomalies = get_recommendations_by_type(
        result,
        "anomaly_investigation",
    )

    assert len(anomalies) == 1

    anomaly = anomalies[0]

    assert (
        anomaly["evidence"]["metric"]
        == "sales"
    )

    assert (
        anomaly["evidence"]["method"]
        == "z_score"
    )

    assert (
        anomaly["evidence"]["anomaly_count"]
        >= 1
    )

    assert 10000 in (
        anomaly["evidence"]["sample_values"]
    )


# ============================================================
# 7. Constant Values Should Not Produce Anomaly
# ============================================================

def test_constant_metric_does_not_produce_anomaly():
    df = pd.DataFrame({
        "sales": [
            100,
            100,
            100,
            100,
            100,
            100,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
    )

    anomalies = get_recommendations_by_type(
        result,
        "anomaly_investigation",
    )

    assert anomalies == []


# ============================================================
# 8. Scores Must Stay Between 0 and 100
# ============================================================

def test_recommendation_scores_are_bounded():
    df = pd.DataFrame({
        "region": [
            "A",
            "B",
            "C",
            "D",
        ],
        "sales": [
            1_000_000,
            1,
            1,
            1,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=["region"],
    )

    assert len(result["recommendations"]) > 0

    for recommendation in result["recommendations"]:
        assert 0 <= recommendation["score"] <= 100


# ============================================================
# 9. Recommendation Structure
# ============================================================

def test_recommendations_have_required_fields():
    df = pd.DataFrame({
        "region": [
            "North",
            "South",
        ],
        "sales": [
            900,
            100,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=["region"],
    )

    assert len(result["recommendations"]) > 0

    required_fields = {
        "type",
        "priority",
        "score",
        "title",
        "reason",
        "evidence",
        "actions",
    }

    for recommendation in result["recommendations"]:
        assert required_fields.issubset(
            recommendation.keys()
        )

        assert isinstance(
            recommendation["evidence"],
            dict,
        )

        assert isinstance(
            recommendation["actions"],
            list,
        )

        assert len(
            recommendation["actions"]
        ) > 0


# ============================================================
# 10. Missing Dimension Values Are Preserved
# ============================================================

def test_missing_dimension_values_are_preserved():
    df = pd.DataFrame({
        "region": [
            "North",
            "North",
            None,
            None,
        ],
        "sales": [
            100,
            100,
            900,
            900,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=["region"],
    )

    segment_recommendations = [
        item
        for item in result["recommendations"]
        if item["type"] in {
            "growth_opportunity",
            "decline_intervention",
            "concentration_risk",
        }
    ]

    values = {
        item["evidence"].get("value")
        for item in segment_recommendations
    }

    assert "Missing" in values


# ============================================================
# 11. Invalid Metric Column
# ============================================================

def test_invalid_metric_column_is_rejected():
    df = pd.DataFrame({
        "sales": [
            100,
            200,
            300,
        ],
    })

    with pytest.raises(
        ValueError,
        match="revenue",
    ):
        generate_recommendations(
            df=df,
            metric_column="revenue",
        )


# ============================================================
# 12. Invalid Dimension Column
# ============================================================

def test_invalid_dimension_column_is_rejected():
    df = pd.DataFrame({
        "sales": [
            100,
            200,
            300,
        ],
    })

    with pytest.raises(
        ValueError,
        match="region",
    ):
        generate_recommendations(
            df=df,
            metric_column="sales",
            dimension_columns=["region"],
        )


# ============================================================
# 13. Empty Dataset
# ============================================================

def test_empty_dataset_is_rejected():
    df = pd.DataFrame({
        "sales": [],
    })

    with pytest.raises(
        ValueError,
        match="Dataset is empty",
    ):
        generate_recommendations(
            df=df,
            metric_column="sales",
        )


# ============================================================
# 14. Non-Numeric Metric Does Not Crash
# ============================================================

def test_non_numeric_metric_does_not_crash():
    df = pd.DataFrame({
        "status": [
            "good",
            "bad",
            "good",
            "bad",
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="status",
    )

    assert (
        result["analysis_quality"]["valid_metric_rows"]
        == 0
    )


# ============================================================
# 15. External AI Is Never Used By Core Engine
# ============================================================

def test_core_engine_does_not_use_external_ai():
    df = pd.DataFrame({
        "sales": [
            100,
            200,
            300,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
    )

    quality = result["analysis_quality"]

    assert (
        quality["external_ai_used"]
        is False
    )

    assert (
        quality["engine"]
        == "deterministic_v1"
    )


# ============================================================
# 16. Summary Matches Recommendations
# ============================================================

def test_summary_matches_recommendations():
    df = pd.DataFrame({
        "region": [
            "North",
            "North",
            "South",
            "South",
        ],
        "sales": [
            900,
            900,
            100,
            100,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=["region"],
    )

    recommendations = result[
        "recommendations"
    ]

    summary = result["summary"]

    assert (
        summary["total"]
        == len(recommendations)
    )

    assert (
        summary["high_priority"]
        + summary["medium_priority"]
        + summary["low_priority"]
        == summary["total"]
    )


# ============================================================
# 17. Maximum Recommendation Limit
# ============================================================

def test_max_recommendations_is_respected():
    df = pd.DataFrame({
        "region": [
            "A",
            "B",
            "C",
            "D",
            "E",
            "F",
        ],
        "sales": [
            1000,
            500,
            200,
            100,
            50,
            10,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=["region"],
        max_recommendations=2,
    )

    assert (
        len(result["recommendations"])
        <= 2
    )


# ============================================================
# 18. Duplicate Dimensions Are Removed
# ============================================================

def test_duplicate_dimension_columns_are_removed():
    df = pd.DataFrame({
        "region": [
            "North",
            "South",
        ],
        "sales": [
            900,
            100,
        ],
    })

    result = generate_recommendations(
        df=df,
        metric_column="sales",
        dimension_columns=[
            "region",
            "region",
            "region",
        ],
    )

    assert (
        result["analysis_quality"]["dimension_columns"]
        == ["region"]
    )