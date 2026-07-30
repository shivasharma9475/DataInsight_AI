from __future__ import annotations

from typing import Any

import pandas as pd

from app.services.root_cause_engine import analyze_period_change


SUPPORTED_AGGREGATIONS = {
    "sum",
    "mean",
    "median",
    "min",
    "max",
    "count",
}


def dataset_summary(df: pd.DataFrame) -> dict[str, Any]:
    """
    Return a lightweight factual overview of the dataset.
    """

    if df.empty:
        raise ValueError("Dataset is empty")

    numeric_columns = df.select_dtypes(
        include="number"
    ).columns.tolist()

    categorical_columns = df.select_dtypes(
        include=["object", "category", "bool"]
    ).columns.tolist()

    missing_by_column = {
        str(column): int(count)
        for column, count in df.isna().sum().items()
        if count > 0
    }

    return {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "columns": [str(column) for column in df.columns],
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "duplicate_rows": int(df.duplicated().sum()),
        "missing_cells": int(df.isna().sum().sum()),
        "missing_by_column": missing_by_column,
    }


def aggregate(
    df: pd.DataFrame,
    metric_column: str,
    aggregation: str = "sum",
) -> dict[str, Any]:
    """
    Calculate one aggregate for a numeric metric.
    """

    _require_column(df, metric_column)

    aggregation = aggregation.lower()

    if aggregation not in SUPPORTED_AGGREGATIONS:
        raise ValueError(
            f"Unsupported aggregation '{aggregation}'"
        )

    values = pd.to_numeric(
        df[metric_column],
        errors="coerce",
    )

    valid_values = values.dropna()

    if valid_values.empty:
        raise ValueError(
            f"Column '{metric_column}' has no valid numeric values"
        )

    if aggregation == "sum":
        value = valid_values.sum()

    elif aggregation == "mean":
        value = valid_values.mean()

    elif aggregation == "median":
        value = valid_values.median()

    elif aggregation == "min":
        value = valid_values.min()

    elif aggregation == "max":
        value = valid_values.max()

    else:
        value = valid_values.count()

    return {
        "metric": metric_column,
        "aggregation": aggregation,
        "value": _number(value),
        "valid_rows": int(valid_values.count()),
        "excluded_rows": int(values.isna().sum()),
    }


def group_by(
    df: pd.DataFrame,
    metric_column: str,
    dimension_column: str,
    aggregation: str = "sum",
    limit: int = 20,
) -> dict[str, Any]:
    """
    Aggregate a numeric metric by a categorical dimension.
    """

    _require_column(df, metric_column)
    _require_column(df, dimension_column)

    aggregation = aggregation.lower()

    if aggregation not in SUPPORTED_AGGREGATIONS:
        raise ValueError(
            f"Unsupported aggregation '{aggregation}'"
        )

    if limit < 1:
        raise ValueError("limit must be at least 1")

    working = df[
        [dimension_column, metric_column]
    ].copy()

    working[metric_column] = pd.to_numeric(
        working[metric_column],
        errors="coerce",
    )

    working = working.dropna(
        subset=[metric_column]
    )

    if working.empty:
        raise ValueError(
            f"Column '{metric_column}' has no valid numeric values"
        )

    grouped = (
        working
        .groupby(
            dimension_column,
            dropna=False,
        )[metric_column]
        .agg(aggregation)
        .reset_index(name="value")
    )

    grouped["absolute_value"] = (
        grouped["value"].abs()
    )

    grouped = (
        grouped
        .sort_values(
            "absolute_value",
            ascending=False,
        )
        .head(limit)
    )

    results = []

    for _, row in grouped.iterrows():
        dimension_value = row[dimension_column]

        results.append({
            "dimension_value": (
                "Missing"
                if pd.isna(dimension_value)
                else str(dimension_value)
            ),
            "value": _number(row["value"]),
        })

    return {
        "metric": metric_column,
        "dimension": dimension_column,
        "aggregation": aggregation,
        "results": results,
    }


def trend(
    df: pd.DataFrame,
    date_column: str,
    metric_column: str,
    period: str = "M",
    aggregation: str = "sum",
) -> dict[str, Any]:
    """
    Aggregate a metric over time.

    Supported periods:
        D = daily
        W = weekly
        M = monthly
        Q = quarterly
        Y = yearly
    """

    _require_column(df, date_column)
    _require_column(df, metric_column)

    if period not in {"D", "W", "M", "Q", "Y"}:
        raise ValueError(
            "period must be D, W, M, Q, or Y"
        )

    aggregation = aggregation.lower()

    if aggregation not in SUPPORTED_AGGREGATIONS:
        raise ValueError(
            f"Unsupported aggregation '{aggregation}'"
        )

    working = df[
        [date_column, metric_column]
    ].copy()

    working[date_column] = pd.to_datetime(
        working[date_column],
        errors="coerce",
    )

    working[metric_column] = pd.to_numeric(
        working[metric_column],
        errors="coerce",
    )

    working = working.dropna(
        subset=[
            date_column,
            metric_column,
        ]
    )

    if working.empty:
        raise ValueError(
            "No valid date/metric rows available"
        )

    working["_period"] = (
        working[date_column]
        .dt.to_period(period)
    )

    grouped = (
        working
        .groupby("_period")[metric_column]
        .agg(aggregation)
        .sort_index()
    )

    points = [
        {
            "period": str(period_value),
            "value": _number(value),
        }
        for period_value, value in grouped.items()
    ]

    return {
        "metric": metric_column,
        "date_column": date_column,
        "period": period,
        "aggregation": aggregation,
        "points": points,
    }


def root_cause(
    df: pd.DataFrame,
    date_column: str,
    metric_column: str,
    dimension_columns: list[str] | None = None,
    period: str = "M",
    comparison_mode: str = "comparable",
) -> dict[str, Any]:
    """
    Reuse the existing RCA engine.
    """

    return analyze_period_change(
        df=df,
        date_column=date_column,
        metric_column=metric_column,
        dimension_columns=dimension_columns or [],
        period=period,
        comparison_mode=comparison_mode,
    )


def execute_tool(
    df: pd.DataFrame,
    tool: str,
    arguments: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Central entry point used by the future Copilot orchestrator.

    The LLM will select a tool + arguments.
    This function executes the actual calculation.
    """

    arguments = arguments or {}

    if tool == "dataset_summary":
        result = dataset_summary(df)

    elif tool == "aggregate":
        result = aggregate(
            df=df,
            **arguments,
        )

    elif tool == "group_by":
        result = group_by(
            df=df,
            **arguments,
        )

    elif tool == "trend":
        result = trend(
            df=df,
            **arguments,
        )

    elif tool == "root_cause":
        result = root_cause(
            df=df,
            **arguments,
        )

    else:
        raise ValueError(
            f"Unknown Copilot tool '{tool}'"
        )

    return {
        "tool": tool,
        "result": result,
    }


def _require_column(
    df: pd.DataFrame,
    column: str,
) -> None:
    if column not in df.columns:
        raise ValueError(
            f"Column '{column}' does not exist"
        )


def _number(value: Any) -> int | float:
    """
    Convert NumPy/Pandas numbers into JSON-safe
    Python int/float values.
    """

    value = float(value)

    if value.is_integer():
        return int(value)

    return round(value, 4)