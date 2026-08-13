# app/services/what_if_engine.py

from __future__ import annotations

from typing import Any, Dict, Optional

import pandas as pd


class WhatIfError(ValueError):
    """Raised when a what-if scenario cannot be calculated."""


def _validate_columns(
    df: pd.DataFrame,
    metric_column: str,
    dimension_column: Optional[str] = None,
) -> None:
    if metric_column not in df.columns:
        raise WhatIfError(
            f"Metric column '{metric_column}' was not found in the dataset."
        )

    if dimension_column and dimension_column not in df.columns:
        raise WhatIfError(
            f"Dimension column '{dimension_column}' was not found in the dataset."
        )


def _numeric_metric(df: pd.DataFrame, metric_column: str) -> pd.Series:
    metric = pd.to_numeric(
        df[metric_column],
        errors="coerce",
    ).dropna()

    if metric.empty:
        raise WhatIfError(
            f"No valid numeric values found in '{metric_column}'."
        )

    return metric


def _calculate_projected_value(
    current_value: float,
    change_percentage: float,
) -> float:
    return round(
        current_value * (
            1 + change_percentage / 100
        ),
        10,
    )


def run_what_if(
    df: pd.DataFrame,
    metric_column: str,
    change_percentage: float,
    dimension_column: Optional[str] = None,
    segment_value: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Run a deterministic what-if simulation.

    Scenario:
        "What happens if a selected metric/segment changes
         by X percent?"

    The engine does NOT predict the future.
    It calculates a mathematical scenario assuming
    all other values remain unchanged.

    Examples:

        run_what_if(
            df,
            metric_column="sales",
            change_percentage=15
        )

        run_what_if(
            df,
            metric_column="sales",
            dimension_column="region",
            segment_value="West",
            change_percentage=15
        )
    """

    if not isinstance(df, pd.DataFrame):
        raise WhatIfError("df must be a pandas DataFrame.")

    if not metric_column:
        raise WhatIfError("metric_column is required.")

    if not isinstance(change_percentage, (int, float)):
        raise WhatIfError(
            "change_percentage must be a number."
        )

    _validate_columns(
        df,
        metric_column,
        dimension_column,
    )

    metric = _numeric_metric(
        df,
        metric_column,
    )

    baseline_total = float(metric.sum())

    # ---------------------------------------------------------
    # Scenario 1:
    # Change the entire metric
    # ---------------------------------------------------------

    if dimension_column is None:
        if segment_value is not None:
            raise WhatIfError(
                "segment_value requires dimension_column."
            )

        projected_total = _calculate_projected_value(
            baseline_total,
            float(change_percentage),
        )

        absolute_impact = (
            projected_total - baseline_total
        )

        return {
            "scenario_type": "metric",
            "metric_column": metric_column,

            "baseline_total": baseline_total,

            "change_percentage": float(
                change_percentage
            ),

            "projected_total": projected_total,

            "absolute_impact": absolute_impact,

            "percentage_impact": float(
                change_percentage
            ),

            "engine": "deterministic_v1",
            "ai_used": False,

            "assumptions": [
                "The entire metric changes by the specified percentage.",
                "All other conditions remain unchanged.",
                "This is a scenario simulation, not a forecast.",
            ],
        }

    # ---------------------------------------------------------
    # Scenario 2:
    # Change one dimension segment
    # ---------------------------------------------------------

    if segment_value is None:
        raise WhatIfError(
            "segment_value is required when dimension_column is provided."
        )

    segment_mask = (
        df[dimension_column].astype(str)
        == str(segment_value)
    )

    segment_metric = pd.to_numeric(
        df.loc[segment_mask, metric_column],
        errors="coerce",
    ).dropna()

    if segment_metric.empty:
        raise WhatIfError(
            f"No valid '{metric_column}' values found "
            f"for {dimension_column}='{segment_value}'."
        )

    baseline_segment = float(
        segment_metric.sum()
    )

    projected_segment = _calculate_projected_value(
        baseline_segment,
        float(change_percentage),
    )

    segment_impact = (
        projected_segment - baseline_segment
    )

    # Only selected segment changes.
    projected_total = (
        baseline_total + segment_impact
    )

    percentage_impact = (
    round(
        (segment_impact / baseline_total) * 100,
        10,
    )
    if baseline_total != 0
    else 0.0
)

    return {
        "scenario_type": "segment",

        "metric_column": metric_column,

        "dimension_column": dimension_column,

        "segment_value": segment_value,

        "baseline_total": baseline_total,

        "baseline_segment": baseline_segment,

        "change_percentage": float(
            change_percentage
        ),

        "projected_segment": projected_segment,

        "projected_total": projected_total,

        "absolute_impact": segment_impact,

        "percentage_impact": percentage_impact,

        "engine": "deterministic_v1",

        "ai_used": False,

        "assumptions": [
            "Only the selected segment changes.",
            "All other segments remain unchanged.",
            "The change is applied proportionally to the selected segment.",
            "This is a scenario simulation, not a forecast.",
        ],
    }