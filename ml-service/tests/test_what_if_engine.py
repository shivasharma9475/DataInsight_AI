import pandas as pd
import pytest

from app.services.what_if_engine import (
    WhatIfError,
    run_what_if,
)


@pytest.fixture
def sample_df():
    return pd.DataFrame(
        {
            "sales": [100, 200, 300, 400],
            "region": ["North", "South", "West", "West"],
            "profit": [10, 20, 30, 40],
        }
    )


# ---------------------------------------------------------
# Basic metric scenario
# ---------------------------------------------------------

def test_change_entire_metric(sample_df):
    result = run_what_if(
        sample_df,
        metric_column="sales",
        change_percentage=10,
    )

    assert result["scenario_type"] == "metric"

    assert result["baseline_total"] == 1000

    assert result["change_percentage"] == 10

    assert result["projected_total"] == 1100

    assert result["absolute_impact"] == 100

    assert result["percentage_impact"] == 10

    assert result["engine"] == "deterministic_v1"

    assert result["ai_used"] is False


# ---------------------------------------------------------
# Negative change
# ---------------------------------------------------------

def test_negative_metric_change(sample_df):
    result = run_what_if(
        sample_df,
        metric_column="sales",
        change_percentage=-20,
    )

    assert result["baseline_total"] == 1000

    assert result["projected_total"] == 800

    assert result["absolute_impact"] == -200

    assert result["percentage_impact"] == -20


# ---------------------------------------------------------
# Zero change
# ---------------------------------------------------------

def test_zero_change(sample_df):
    result = run_what_if(
        sample_df,
        metric_column="sales",
        change_percentage=0,
    )

    assert result["baseline_total"] == 1000

    assert result["projected_total"] == 1000

    assert result["absolute_impact"] == 0

    assert result["percentage_impact"] == 0


# ---------------------------------------------------------
# Segment scenario
# ---------------------------------------------------------

def test_segment_change(sample_df):
    result = run_what_if(
        sample_df,
        metric_column="sales",
        dimension_column="region",
        segment_value="West",
        change_percentage=15,
    )

    # West = 300 + 400 = 700
    assert result["baseline_segment"] == 700

    # 700 + 15% = 805
    assert result["projected_segment"] == 805

    # Total = 1000
    # Impact = +105
    assert result["baseline_total"] == 1000

    assert result["projected_total"] == 1105

    assert result["absolute_impact"] == 105

    assert result["percentage_impact"] == 10.5

    assert result["scenario_type"] == "segment"

    assert result["dimension_column"] == "region"

    assert result["segment_value"] == "West"


# ---------------------------------------------------------
# Segment negative change
# ---------------------------------------------------------

def test_segment_negative_change(sample_df):
    result = run_what_if(
        sample_df,
        metric_column="sales",
        dimension_column="region",
        segment_value="West",
        change_percentage=-20,
    )

    # West = 700
    # -20% = 560
    assert result["baseline_segment"] == 700

    assert result["projected_segment"] == 560

    # Impact = -140
    assert result["absolute_impact"] == -140

    # Total = 1000 - 140
    assert result["projected_total"] == 860

    assert result["percentage_impact"] == -14


# ---------------------------------------------------------
# Invalid metric column
# ---------------------------------------------------------

def test_invalid_metric_column(sample_df):
    with pytest.raises(
        WhatIfError,
        match="Metric column 'revenue' was not found",
    ):
        run_what_if(
            sample_df,
            metric_column="revenue",
            change_percentage=10,
        )


# ---------------------------------------------------------
# Invalid dimension column
# ---------------------------------------------------------

def test_invalid_dimension_column(sample_df):
    with pytest.raises(
        WhatIfError,
        match="Dimension column 'country' was not found",
    ):
        run_what_if(
            sample_df,
            metric_column="sales",
            dimension_column="country",
            segment_value="India",
            change_percentage=10,
        )


# ---------------------------------------------------------
# Missing segment
# ---------------------------------------------------------

def test_missing_segment(sample_df):
    with pytest.raises(
        WhatIfError,
        match="segment_value is required",
    ):
        run_what_if(
            sample_df,
            metric_column="sales",
            dimension_column="region",
            change_percentage=10,
        )


# ---------------------------------------------------------
# Invalid segment
# ---------------------------------------------------------

def test_invalid_segment(sample_df):
    with pytest.raises(
        WhatIfError,
        match="No valid 'sales' values found",
    ):
        run_what_if(
            sample_df,
            metric_column="sales",
            dimension_column="region",
            segment_value="India",
            change_percentage=10,
        )


# ---------------------------------------------------------
# Segment without dimension
# ---------------------------------------------------------

def test_segment_without_dimension(sample_df):
    with pytest.raises(
        WhatIfError,
        match="segment_value requires dimension_column",
    ):
        run_what_if(
            sample_df,
            metric_column="sales",
            segment_value="West",
            change_percentage=10,
        )


# ---------------------------------------------------------
# Non-numeric metric
# ---------------------------------------------------------

def test_non_numeric_metric():
    df = pd.DataFrame(
        {
            "sales": ["abc", "xyz", None],
            "region": ["North", "South", "West"],
        }
    )

    with pytest.raises(
        WhatIfError,
        match="No valid numeric values found",
    ):
        run_what_if(
            df,
            metric_column="sales",
            change_percentage=10,
        )


# ---------------------------------------------------------
# Numeric strings should work
# ---------------------------------------------------------

def test_numeric_strings_are_supported():
    df = pd.DataFrame(
        {
            "sales": ["100", "200", "300"],
            "region": ["North", "South", "West"],
        }
    )

    result = run_what_if(
        df,
        metric_column="sales",
        change_percentage=10,
    )

    assert result["baseline_total"] == 600

    assert result["projected_total"] == 660

    assert result["absolute_impact"] == 60


# ---------------------------------------------------------
# Assumptions are included
# ---------------------------------------------------------

def test_assumptions_are_returned(sample_df):
    result = run_what_if(
        sample_df,
        metric_column="sales",
        change_percentage=10,
    )

    assert "assumptions" in result

    assert len(result["assumptions"]) > 0

    assert any(
        "forecast" in assumption.lower()
        for assumption in result["assumptions"]
    )


# ---------------------------------------------------------
# Result should contain no AI dependency
# ---------------------------------------------------------

def test_engine_is_deterministic(sample_df):
    result1 = run_what_if(
        sample_df,
        metric_column="sales",
        dimension_column="region",
        segment_value="West",
        change_percentage=15,
    )

    result2 = run_what_if(
        sample_df,
        metric_column="sales",
        dimension_column="region",
        segment_value="West",
        change_percentage=15,
    )

    assert result1 == result2

    assert result1["ai_used"] is False
    assert result2["ai_used"] is False