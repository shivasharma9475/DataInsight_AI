import pandas as pd
import pytest

from app.services.copilot_engine import (
    aggregate,
    dataset_summary,
    execute_tool,
    group_by,
    root_cause,
    trend,
)


@pytest.fixture
def sales_df():
    return pd.DataFrame({
        "date": [
            "2026-01-01",
            "2026-01-10",
            "2026-02-01",
            "2026-02-10",
        ],
        "region": [
            "North",
            "South",
            "North",
            "South",
        ],
        "product": [
            "Widget A",
            "Widget B",
            "Widget A",
            "Widget B",
        ],
        "sales": [
            100,
            200,
            300,
            400,
        ],
    })


def test_dataset_summary(sales_df):
    result = dataset_summary(sales_df)

    assert result["row_count"] == 4
    assert result["column_count"] == 4
    assert result["duplicate_rows"] == 0
    assert result["missing_cells"] == 0

    assert "sales" in result["numeric_columns"]
    assert "region" in result["categorical_columns"]


def test_aggregate_sum(sales_df):
    result = aggregate(
        df=sales_df,
        metric_column="sales",
        aggregation="sum",
    )

    assert result["metric"] == "sales"
    assert result["aggregation"] == "sum"
    assert result["value"] == 1000
    assert result["valid_rows"] == 4
    assert result["excluded_rows"] == 0


def test_group_by_region(sales_df):
    result = group_by(
        df=sales_df,
        metric_column="sales",
        dimension_column="region",
        aggregation="sum",
    )

    values = {
        item["dimension_value"]: item["value"]
        for item in result["results"]
    }

    assert values["North"] == 400
    assert values["South"] == 600


def test_monthly_trend(sales_df):
    result = trend(
        df=sales_df,
        date_column="date",
        metric_column="sales",
        period="M",
        aggregation="sum",
    )

    assert result["points"] == [
        {
            "period": "2026-01",
            "value": 300,
        },
        {
            "period": "2026-02",
            "value": 700,
        },
    ]


def test_root_cause_reuses_rca_engine(sales_df):
    result = root_cause(
        df=sales_df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="M",
        comparison_mode="full",
    )

    comparison = result["comparison"]

    assert comparison["previous_value"] == 300
    assert comparison["current_value"] == 700
    assert comparison["absolute_change"] == 400
    assert comparison["direction"] == "increase"


def test_execute_tool_dispatches_aggregate(sales_df):
    result = execute_tool(
        df=sales_df,
        tool="aggregate",
        arguments={
            "metric_column": "sales",
            "aggregation": "mean",
        },
    )

    assert result["tool"] == "aggregate"
    assert result["result"]["value"] == 250


def test_unknown_tool_rejected(sales_df):
    with pytest.raises(
        ValueError,
        match="Unknown Copilot tool",
    ):
        execute_tool(
            df=sales_df,
            tool="make_up_sales_numbers",
        )
