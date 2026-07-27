from __future__ import annotations

from typing import Any

import pandas as pd


SUPPORTED_PERIODS = {"D", "W", "M", "Q", "Y"}
SUPPORTED_COMPARISON_MODES = {"full", "comparable"}


def analyze_period_change(
    df: pd.DataFrame,
    date_column: str,
    metric_column: str,
    dimension_columns: list[str] | None = None,
    period: str = "M",
    comparison_mode: str = "full",
) -> dict[str, Any]:
    """
    Compare the latest available period with the previous period and determine
    which dimension values contributed most to the metric change.

    Periods:
        D = Daily
        W = Weekly
        M = Monthly
        Q = Quarterly
        Y = Yearly

    comparison_mode:
        full:
            Compare all available rows in the previous and current periods.

        comparable:
            If the latest period is incomplete, compare the same elapsed
            portion of the previous period.

            Examples:
                Weekly:
                    Previous Mon-Wed vs Current Mon-Wed

                Monthly:
                    Apr 1-14 vs May 1-14

                Quarterly:
                    Equivalent elapsed portion of previous quarter

                Yearly:
                    Jan 1-May 14 of previous year
                    vs Jan 1-May 14 of current year

            For daily analysis, comparable intraday filtering is applied only
            when actual time-of-day information exists.
    """

    # --------------------------------------------------
    # Validation
    # --------------------------------------------------

    if date_column not in df.columns:
        raise ValueError(
            f"Date column '{date_column}' does not exist"
        )

    if metric_column not in df.columns:
        raise ValueError(
            f"Metric column '{metric_column}' does not exist"
        )

    if period not in SUPPORTED_PERIODS:
        raise ValueError(
            "period must be one of: D, W, M, Q, Y"
        )

    if comparison_mode not in SUPPORTED_COMPARISON_MODES:
        raise ValueError(
            "comparison_mode must be either 'full' or 'comparable'"
        )

    dimensions = dimension_columns or []

    # --------------------------------------------------
    # Prepare data
    # --------------------------------------------------

    working = df.copy()

    working[date_column] = pd.to_datetime(
        working[date_column],
        errors="coerce",
    )

    working[metric_column] = pd.to_numeric(
        working[metric_column],
        errors="coerce",
    )

    working = working.dropna(
        subset=[date_column, metric_column]
    ).copy()

    if working.empty:
        raise ValueError(
            "No valid date/metric rows available for analysis"
        )

    # --------------------------------------------------
    # Build periods
    # --------------------------------------------------

    working["_period"] = (
        working[date_column]
        .dt.to_period(period)
    )

    available_periods = sorted(
        working["_period"]
        .dropna()
        .unique()
    )

    if len(available_periods) < 2:
        raise ValueError(
            "At least two periods are required for root cause analysis"
        )

    previous_period = available_periods[-2]
    current_period = available_periods[-1]

    previous_df = working[
        working["_period"] == previous_period
    ].copy()

    current_df = working[
        working["_period"] == current_period
    ].copy()

    if previous_df.empty or current_df.empty:
        raise ValueError(
            "Previous or current period contains no valid rows"
        )

    # --------------------------------------------------
    # Period boundaries
    # --------------------------------------------------

    previous_period_start = (
        previous_period.start_time
    )

    previous_period_end = (
        previous_period.end_time
    )

    current_period_start = (
        current_period.start_time
    )

    current_period_end = (
        current_period.end_time
    )

    current_last_date = current_df[
        date_column
    ].max()

    # --------------------------------------------------
    # Analysis quality metadata
    # --------------------------------------------------

    analysis_quality: dict[str, Any] = {
    "comparison_mode": comparison_mode,
    "current_period_complete": True,

    # Backward-compatible field used by existing frontend/tests.
    # Most useful for monthly comparable analysis.
    "current_period_last_day": int(current_last_date.day),

    # Generic field for W/M/Q/Y analysis.
    "current_period_last_date": _timestamp_string(
        current_last_date
    ),

    "warning": None,

    "comparison_window": {
        "previous_start": _timestamp_string(
            previous_df[date_column].min()
        ),
        "previous_end": _timestamp_string(
            previous_df[date_column].max()
        ),
        "current_start": _timestamp_string(
            current_df[date_column].min()
        ),
        "current_end": _timestamp_string(
            current_last_date
        ),
    },
}

    # --------------------------------------------------
    # Comparable-period filtering
    # --------------------------------------------------

    if comparison_mode == "comparable":

        (
            previous_df,
            current_period_complete,
            warning,
        ) = _apply_comparable_window(
            previous_df=previous_df,
            current_df=current_df,
            date_column=date_column,
            period=period,
            previous_period_start=previous_period_start,
            previous_period_end=previous_period_end,
            current_period_start=current_period_start,
            current_period_end=current_period_end,
        )

        analysis_quality[
            "current_period_complete"
        ] = current_period_complete

        analysis_quality[
            "warning"
        ] = warning

    else:
        analysis_quality[
            "current_period_complete"
        ] = _is_period_complete(
            current_df=current_df,
            date_column=date_column,
            period=period,
            current_period_end=current_period_end,
        )

    # Update windows AFTER comparable filtering.
    analysis_quality["comparison_window"] = {
        "previous_start": _timestamp_string(
            previous_df[date_column].min()
        ),
        "previous_end": _timestamp_string(
            previous_df[date_column].max()
        ),
        "current_start": _timestamp_string(
            current_df[date_column].min()
        ),
        "current_end": _timestamp_string(
            current_df[date_column].max()
        ),
    }

    # --------------------------------------------------
    # Overall metric calculation
    # --------------------------------------------------

    previous_value = float(
        previous_df[metric_column].sum()
    )

    current_value = float(
        current_df[metric_column].sum()
    )

    absolute_change = (
        current_value - previous_value
    )

    if previous_value != 0:
        percentage_change = (
            absolute_change
            / abs(previous_value)
        ) * 100
    else:
        percentage_change = None

    # --------------------------------------------------
    # Dimension analysis
    # --------------------------------------------------

    dimension_results = []

    for dimension in dimensions:

        if dimension not in working.columns:
            continue

        result = _analyze_dimension(
            previous_df=previous_df,
            current_df=current_df,
            dimension=dimension,
            metric_column=metric_column,
            total_change=absolute_change,
        )

        dimension_results.append(result)

    # --------------------------------------------------
    # Combine contributors
    # --------------------------------------------------

    contributors = []

    for dimension_result in dimension_results:
        contributors.extend(
            dimension_result["contributors"]
        )

    contributors.sort(
        key=lambda item: abs(item["change"]),
        reverse=True,
    )

    # --------------------------------------------------
    # Response
    # --------------------------------------------------

    return {
        "metric": metric_column,

        "analysis_quality": analysis_quality,

        "comparison": {
            "previous_period": str(
                previous_period
            ),

            "current_period": str(
                current_period
            ),

            "previous_value": round(
                previous_value,
                4,
            ),

            "current_value": round(
                current_value,
                4,
            ),

            "absolute_change": round(
                absolute_change,
                4,
            ),

            "percentage_change": (
                round(
                    percentage_change,
                    2,
                )
                if percentage_change is not None
                else None
            ),

            "direction": _direction(
                absolute_change
            ),
        },

        "dimensions": dimension_results,

        "top_contributors": contributors[:10],
    }


# ==========================================================
# Comparable period logic
# ==========================================================


def _apply_comparable_window(
    previous_df: pd.DataFrame,
    current_df: pd.DataFrame,
    date_column: str,
    period: str,
    previous_period_start: pd.Timestamp,
    previous_period_end: pd.Timestamp,
    current_period_start: pd.Timestamp,
    current_period_end: pd.Timestamp,
) -> tuple[
    pd.DataFrame,
    bool,
    str | None,
]:
    """
    Restrict the previous period to the same elapsed portion
    represented by the latest current-period observation.
    """

    if current_df.empty:
        return (
            previous_df,
            False,
            "Current period contains no valid rows.",
        )

    current_last_date = current_df[
        date_column
    ].max()

    # --------------------------------------------------
    # DAILY
    # --------------------------------------------------
    #
    # A date-only dataset cannot tell us whether:
    #
    # 2025-05-14
    #
    # represents a complete day or a partial day.
    #
    # Only use comparable intraday filtering when
    # time-of-day information actually exists.
    # --------------------------------------------------

    if period == "D":

        has_intraday_data = _has_intraday_information(
            current_df,
            date_column,
        )

        if not has_intraday_data:
            return (
                previous_df,
                True,
                None,
            )

        current_complete = (
            current_last_date
            >= current_period_end.floor("s")
        )

        if current_complete:
            return (
                previous_df,
                True,
                None,
            )

        elapsed = (
            current_last_date
            - current_period_start
        )

        previous_cutoff = (
            previous_period_start
            + elapsed
        )

        if previous_cutoff > previous_period_end:
            previous_cutoff = previous_period_end

        filtered_previous = previous_df[
            previous_df[date_column]
            <= previous_cutoff
        ].copy()

        warning = (
            "Current daily period is incomplete. "
            "Equivalent elapsed intraday windows "
            "were compared."
        )

        return (
            filtered_previous,
            False,
            warning,
        )

    # --------------------------------------------------
    # WEEK / MONTH / QUARTER / YEAR
    # --------------------------------------------------

    current_complete = _is_period_complete(
        current_df=current_df,
        date_column=date_column,
        period=period,
        current_period_end=current_period_end,
    )

    if current_complete:
        return (
            previous_df,
            True,
            None,
        )

    # Amount of calendar time represented in the
    # current period.
    elapsed = (
        current_last_date.normalize()
        - current_period_start.normalize()
    )

    previous_cutoff = (
        previous_period_start.normalize()
        + elapsed
    )

    # Defensive protection for unequal period lengths.
    #
    # Example:
    # Previous month = February
    # Current month  = March
    if (
        previous_cutoff.normalize()
        > previous_period_end.normalize()
    ):
        previous_cutoff = (
            previous_period_end.normalize()
        )

    filtered_previous = previous_df[
        previous_df[date_column].dt.normalize()
        <= previous_cutoff.normalize()
    ].copy()

    warning = (
        "Current period is incomplete. "
        "Equivalent elapsed-period windows "
        "were compared."
    )

    return (
        filtered_previous,
        False,
        warning,
    )


# ==========================================================
# Period completeness
# ==========================================================


def _is_period_complete(
    current_df: pd.DataFrame,
    date_column: str,
    period: str,
    current_period_end: pd.Timestamp,
) -> bool:

    if current_df.empty:
        return False

    current_last_date = current_df[
        date_column
    ].max()

    if period == "D":

        if not _has_intraday_information(
            current_df,
            date_column,
        ):
            # Date-only datasets provide no reliable way
            # to determine intraday completeness.
            return True

        return (
            current_last_date
            >= current_period_end.floor("s")
        )

    # For W/M/Q/Y, reaching the final calendar date of
    # the period is considered complete.
    return (
        current_last_date.normalize()
        >= current_period_end.normalize()
    )


def _has_intraday_information(
    df: pd.DataFrame,
    date_column: str,
) -> bool:
    """
    Return True when at least one timestamp contains
    non-midnight time information.
    """

    series = df[
        date_column
    ].dropna()

    if series.empty:
        return False

    return bool(
        (
            series
            != series.dt.normalize()
        ).any()
    )


# ==========================================================
# Dimension analysis
# ==========================================================


def _analyze_dimension(
    previous_df: pd.DataFrame,
    current_df: pd.DataFrame,
    dimension: str,
    metric_column: str,
    total_change: float,
) -> dict[str, Any]:

    previous = (
        previous_df
        .groupby(
            dimension,
            dropna=False,
        )[metric_column]
        .sum()
    )

    current = (
        current_df
        .groupby(
            dimension,
            dropna=False,
        )[metric_column]
        .sum()
    )

    comparison = pd.concat(
        [
            previous.rename("previous"),
            current.rename("current"),
        ],
        axis=1,
    ).fillna(0)

    comparison["change"] = (
        comparison["current"]
        - comparison["previous"]
    )

    contributors = []

    for value, row in comparison.iterrows():

        change = float(
            row["change"]
        )

        if total_change != 0:
            contribution_pct = (
                change
                / total_change
            ) * 100
        else:
            contribution_pct = 0.0

        contributors.append({
            "dimension": dimension,

            "value": (
                "Missing"
                if pd.isna(value)
                else str(value)
            ),

            "previous_value": round(
                float(row["previous"]),
                4,
            ),

            "current_value": round(
                float(row["current"]),
                4,
            ),

            "change": round(
                change,
                4,
            ),

            "contribution_pct": round(
                contribution_pct,
                2,
            ),

            "impact": _impact(
                change
            ),
        })

    contributors.sort(
        key=lambda item: abs(
            item["change"]
        ),
        reverse=True,
    )

    # --------------------------------------------------
    # Reconciliation
    # --------------------------------------------------

    dimension_total_change = float(
        comparison["change"].sum()
    )

    reconciliation_error = (
        dimension_total_change
        - total_change
    )

    return {
        "dimension": dimension,

        "contributors": contributors,

        "reconciliation": {
            "dimension_change": round(
                dimension_total_change,
                4,
            ),

            "overall_change": round(
                total_change,
                4,
            ),

            "error": round(
                reconciliation_error,
                8,
            ),
        },
    }


# ==========================================================
# Helpers
# ==========================================================


def _direction(
    change: float,
) -> str:

    if change > 0:
        return "increase"

    if change < 0:
        return "decrease"

    return "no_change"


def _impact(
    change: float,
) -> str:

    if change > 0:
        return "positive"

    if change < 0:
        return "negative"

    return "neutral"


def _timestamp_string(
    value: pd.Timestamp | Any,
) -> str | None:

    if value is None:
        return None

    if pd.isna(value):
        return None

    timestamp = pd.Timestamp(
        value
    )

    # Keep time when the dataset contains it.
    if timestamp != timestamp.normalize():
        return timestamp.isoformat()

    return timestamp.strftime(
        "%Y-%m-%d"
    )