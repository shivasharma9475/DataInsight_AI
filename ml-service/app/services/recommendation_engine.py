from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


# ============================================================
# Configuration
# ============================================================

MAX_RECOMMENDATIONS = 20

HIGH_PRIORITY_THRESHOLD = 75
MEDIUM_PRIORITY_THRESHOLD = 45

MISSING_WARNING_THRESHOLD = 10.0
MISSING_CRITICAL_THRESHOLD = 25.0

CONCENTRATION_THRESHOLD = 50.0

SEGMENT_STRONG_THRESHOLD = 20.0
SEGMENT_WEAK_THRESHOLD = -20.0

ANOMALY_Z_THRESHOLD = 3.0


# ============================================================
# Helpers
# ============================================================

def _safe_float(
    value: Any,
    default: float = 0.0,
) -> float:
    """
    Convert value to a finite float.
    """

    try:
        number = float(value)

        if not np.isfinite(number):
            return default

        return number

    except (TypeError, ValueError):
        return default


def _clean_dimension_value(value: Any) -> str:
    """
    Convert dimension values into frontend-safe strings.
    """

    if pd.isna(value):
        return "Missing"

    return str(value)


def _clamp_score(score: float) -> int:
    """
    Ensure score always remains between 0 and 100.
    """

    return int(
        round(
            max(
                0.0,
                min(100.0, score),
            )
        )
    )


def _priority_from_score(score: float) -> str:
    """
    Convert recommendation score to priority.
    """

    if score >= HIGH_PRIORITY_THRESHOLD:
        return "high"

    if score >= MEDIUM_PRIORITY_THRESHOLD:
        return "medium"

    return "low"


def _build_recommendation(
    *,
    recommendation_type: str,
    score: float,
    title: str,
    reason: str,
    evidence: dict[str, Any],
    actions: list[str],
) -> dict[str, Any]:
    """
    Build recommendation using one consistent response format.
    """

    final_score = _clamp_score(score)

    return {
        "type": recommendation_type,
        "priority": _priority_from_score(
            final_score
        ),
        "score": final_score,
        "title": title,
        "reason": reason,
        "evidence": evidence,
        "actions": actions,
    }


# ============================================================
# Validation
# ============================================================

def _validate_inputs(
    df: pd.DataFrame,
    metric_column: str | None,
    dimension_columns: list[str],
) -> None:

    if not isinstance(df, pd.DataFrame):
        raise TypeError(
            "df must be a pandas DataFrame"
        )

    if df.empty:
        raise ValueError(
            "Dataset is empty"
        )

    if metric_column is not None:
        if metric_column not in df.columns:
            raise ValueError(
                f"Metric column '{metric_column}' does not exist"
            )

    for dimension in dimension_columns:
        if dimension not in df.columns:
            raise ValueError(
                f"Dimension column '{dimension}' does not exist"
            )


# ============================================================
# 1. Data Quality
# ============================================================

def _analyze_data_quality(
    df: pd.DataFrame,
) -> list[dict[str, Any]]:

    recommendations = []

    total_rows = len(df)

    if total_rows == 0:
        return recommendations

    # --------------------------------------------------------
    # Missing values
    # --------------------------------------------------------

    for column in df.columns:

        missing_count = int(
            df[column]
            .isna()
            .sum()
        )

        if missing_count == 0:
            continue

        missing_percentage = (
            missing_count
            / total_rows
            * 100
        )

        # Ignore tiny amounts of missing data in V1.
        if (
            missing_percentage
            < MISSING_WARNING_THRESHOLD
        ):
            continue

        if (
            missing_percentage
            >= MISSING_CRITICAL_THRESHOLD
        ):
            score = min(
                100,
                70
                + (
                    missing_percentage
                    - MISSING_CRITICAL_THRESHOLD
                ),
            )

        else:
            score = (
                45
                + (
                    missing_percentage
                    - MISSING_WARNING_THRESHOLD
                )
                * 1.5
            )

        recommendations.append(
            _build_recommendation(
                recommendation_type="data_quality",
                score=score,
                title=(
                    f"Review missing values in {column}"
                ),
                reason=(
                    f"{missing_percentage:.1f}% of values "
                    f"in '{column}' are missing."
                ),
                evidence={
                    "column": column,
                    "missing_count": missing_count,
                    "missing_percentage": round(
                        missing_percentage,
                        2,
                    ),
                    "total_rows": total_rows,
                },
                actions=[
                    (
                        "Investigate why values are missing "
                        "before using this column."
                    ),
                    (
                        "Consider imputing, excluding, or "
                        "flagging affected records."
                    ),
                    (
                        "Compare analysis results before and "
                        "after the selected treatment."
                    ),
                ],
            )
        )

    # --------------------------------------------------------
    # Duplicate rows
    # --------------------------------------------------------

    duplicate_count = int(
        df.duplicated().sum()
    )

    if duplicate_count > 0:

        duplicate_percentage = (
            duplicate_count
            / total_rows
            * 100
        )

        # Avoid noisy recommendations for very small amounts.
        if duplicate_percentage >= 2.0:

            score = min(
                95,
                40
                + duplicate_percentage * 2,
            )

            recommendations.append(
                _build_recommendation(
                    recommendation_type="data_quality",
                    score=score,
                    title="Review duplicate records",
                    reason=(
                        f"{duplicate_count} duplicate rows "
                        "were detected."
                    ),
                    evidence={
                        "duplicate_rows":
                            duplicate_count,

                        "duplicate_percentage":
                            round(
                                duplicate_percentage,
                                2,
                            ),

                        "total_rows":
                            total_rows,
                    },
                    actions=[
                        (
                            "Verify whether duplicate rows "
                            "represent repeated observations."
                        ),
                        (
                            "Remove confirmed duplicates "
                            "before calculating key metrics."
                        ),
                    ],
                )
            )

    return recommendations


# ============================================================
# 2. Segment Performance
# ============================================================

def _analyze_segment_performance(
    df: pd.DataFrame,
    metric_column: str,
    dimension_columns: list[str],
) -> list[dict[str, Any]]:
    """
    Compare each segment against the average segment total.

    IMPORTANT:
    This is NOT historical growth/decline.

    It identifies segments performing substantially above
    or below their peers.

    Historical changes should later come from the RCA engine.
    """

    recommendations = []

    working = df.copy()

    working[metric_column] = pd.to_numeric(
        working[metric_column],
        errors="coerce",
    )

    working = working[
        working[metric_column].notna()
    ]

    if working.empty:
        return recommendations

    for dimension in dimension_columns:

        grouped = (
            working
            .groupby(
                dimension,
                dropna=False,
            )[metric_column]
            .sum()
        )

        # Need multiple segments for comparison.
        if len(grouped) < 2:
            continue

        average_value = _safe_float(
            grouped.mean()
        )

        if average_value == 0:
            continue

        for (
            dimension_value,
            segment_value,
        ) in grouped.items():

            segment_value = _safe_float(
                segment_value
            )

            relative_difference = (
                (
                    segment_value
                    - average_value
                )
                / abs(average_value)
                * 100
            )

            clean_value = (
                _clean_dimension_value(
                    dimension_value
                )
            )

            # ------------------------------------------------
            # Strong segment
            # ------------------------------------------------

            if (
                relative_difference
                >= SEGMENT_STRONG_THRESHOLD
            ):

                score = min(
                    95,
                    50
                    + relative_difference
                    * 0.35,
                )

                recommendations.append(
                    _build_recommendation(
                        recommendation_type=(
                            "growth_opportunity"
                        ),
                        score=score,
                        title=(
                            f"Strong {metric_column} "
                            f"performance in {clean_value}"
                        ),
                        reason=(
                            f"{clean_value} performs "
                            f"{relative_difference:.1f}% above "
                            f"the average {dimension} segment."
                        ),
                        evidence={
                            "dimension":
                                dimension,

                            "value":
                                clean_value,

                            "metric":
                                metric_column,

                            "segment_value":
                                round(
                                    segment_value,
                                    2,
                                ),

                            "average_segment_value":
                                round(
                                    average_value,
                                    2,
                                ),

                            "relative_difference_percentage":
                                round(
                                    relative_difference,
                                    2,
                                ),
                        },
                        actions=[
                            (
                                "Review the factors associated "
                                "with this segment's performance."
                            ),
                            (
                                "Compare this segment with "
                                "lower-performing segments."
                            ),
                            (
                                "Evaluate whether successful "
                                "patterns can be replicated."
                            ),
                        ],
                    )
                )

            # ------------------------------------------------
            # Weak segment
            # ------------------------------------------------

            elif (
                relative_difference
                <= SEGMENT_WEAK_THRESHOLD
            ):

                score = min(
                    95,
                    50
                    + abs(
                        relative_difference
                    )
                    * 0.35,
                )

                recommendations.append(
                    _build_recommendation(
                        recommendation_type=(
                            "decline_intervention"
                        ),
                        score=score,
                        title=(
                            f"Investigate weak "
                            f"{metric_column} performance "
                            f"in {clean_value}"
                        ),
                        reason=(
                            f"{clean_value} performs "
                            f"{abs(relative_difference):.1f}% "
                            f"below the average "
                            f"{dimension} segment."
                        ),
                        evidence={
                            "dimension":
                                dimension,

                            "value":
                                clean_value,

                            "metric":
                                metric_column,

                            "segment_value":
                                round(
                                    segment_value,
                                    2,
                                ),

                            "average_segment_value":
                                round(
                                    average_value,
                                    2,
                                ),

                            "relative_difference_percentage":
                                round(
                                    relative_difference,
                                    2,
                                ),
                        },
                        actions=[
                            (
                                "Compare this segment with "
                                "higher-performing segments."
                            ),
                            (
                                "Review pricing, product, "
                                "operational, and demand differences."
                            ),
                            (
                                "Track this segment separately "
                                "to determine whether weakness persists."
                            ),
                        ],
                    )
                )

    return recommendations


# ============================================================
# 3. Concentration Risk
# ============================================================

def _analyze_concentration(
    df: pd.DataFrame,
    metric_column: str,
    dimension_columns: list[str],
) -> list[dict[str, Any]]:

    recommendations = []

    working = df.copy()

    working[metric_column] = pd.to_numeric(
        working[metric_column],
        errors="coerce",
    )

    working = working[
        working[metric_column].notna()
    ]

    if working.empty:
        return recommendations

    for dimension in dimension_columns:

        grouped = (
            working
            .groupby(
                dimension,
                dropna=False,
            )[metric_column]
            .sum()
        )

        if len(grouped) < 2:
            continue

        total_value = _safe_float(
            grouped.sum()
        )

        # Concentration percentages are misleading for
        # zero/negative totals.
        if total_value <= 0:
            continue

        largest_segment = (
            grouped.idxmax()
        )

        largest_value = _safe_float(
            grouped.max()
        )

        share_percentage = (
            largest_value
            / total_value
            * 100
        )

        if (
            share_percentage
            < CONCENTRATION_THRESHOLD
        ):
            continue

        clean_value = (
            _clean_dimension_value(
                largest_segment
            )
        )

        score = min(
            95,
            55
            + (
                share_percentage
                - CONCENTRATION_THRESHOLD
            )
            * 1.2,
        )

        recommendations.append(
            _build_recommendation(
                recommendation_type=(
                    "concentration_risk"
                ),
                score=score,
                title=(
                    f"High {metric_column} concentration "
                    f"in {clean_value}"
                ),
                reason=(
                    f"{clean_value} contributes "
                    f"{share_percentage:.1f}% of total "
                    f"{metric_column} within {dimension}."
                ),
                evidence={
                    "dimension":
                        dimension,

                    "value":
                        clean_value,

                    "metric":
                        metric_column,

                    "segment_value":
                        round(
                            largest_value,
                            2,
                        ),

                    "total_value":
                        round(
                            total_value,
                            2,
                        ),

                    "share_percentage":
                        round(
                            share_percentage,
                            2,
                        ),
                },
                actions=[
                    (
                        "Assess dependency on this segment."
                    ),
                    (
                        "Track changes in this segment as "
                        "a key risk indicator."
                    ),
                    (
                        "Evaluate opportunities to strengthen "
                        "other segments."
                    ),
                ],
            )
        )

    return recommendations


# ============================================================
# 4. Statistical Anomalies
# ============================================================

def _analyze_anomalies(
    df: pd.DataFrame,
    metric_column: str,
) -> list[dict[str, Any]]:

    recommendations = []

    numeric = pd.to_numeric(
        df[metric_column],
        errors="coerce",
    )

    valid = numeric.dropna()

    # Avoid anomaly detection on tiny datasets.
    if len(valid) < 5:
        return recommendations

    mean = _safe_float(
        valid.mean()
    )

    standard_deviation = _safe_float(
        valid.std(ddof=0)
    )

    if standard_deviation <= 0:
        return recommendations

    z_scores = (
        valid - mean
    ) / standard_deviation

    anomaly_mask = (
        z_scores.abs()
        >= ANOMALY_Z_THRESHOLD
    )

    anomalies = valid[
        anomaly_mask
    ]

    if anomalies.empty:
        return recommendations

    anomaly_z_scores = (
        z_scores.loc[
            anomalies.index
        ]
        .abs()
    )

    maximum_z_score = _safe_float(
        anomaly_z_scores.max()
    )

    anomaly_count = len(
        anomalies
    )

    anomaly_percentage = (
        anomaly_count
        / len(valid)
        * 100
    )

    score = min(
        95,
        55
        + maximum_z_score * 8,
    )

    sample_values = [
        round(
            _safe_float(value),
            2,
        )
        for value in anomalies.head(5)
    ]

    recommendations.append(
        _build_recommendation(
            recommendation_type=(
                "anomaly_investigation"
            ),
            score=score,
            title=(
                f"Investigate unusual "
                f"{metric_column} values"
            ),
            reason=(
                f"{anomaly_count} statistically unusual "
                f"{metric_column} values were detected."
            ),
            evidence={
                "metric":
                    metric_column,

                "method":
                    "z_score",

                "threshold":
                    ANOMALY_Z_THRESHOLD,

                "anomaly_count":
                    anomaly_count,

                "anomaly_percentage":
                    round(
                        anomaly_percentage,
                        2,
                    ),

                "maximum_absolute_z_score":
                    round(
                        maximum_z_score,
                        2,
                    ),

                "sample_values":
                    sample_values,
            },
            actions=[
                (
                    "Review the underlying records "
                    "for the detected anomalies."
                ),
                (
                    "Determine whether unusual values "
                    "represent valid events or data issues."
                ),
                (
                    "Analyze related dimensions to identify "
                    "patterns behind unusual observations."
                ),
            ],
        )
    )

    return recommendations


# ============================================================
# Deduplication
# ============================================================

def _deduplicate_recommendations(
    recommendations: list[
        dict[str, Any]
    ],
) -> list[dict[str, Any]]:

    unique = []
    seen = set()

    for item in recommendations:

        evidence = item.get(
            "evidence",
            {},
        )

        key = (
            item.get("type"),
            evidence.get("dimension"),
            evidence.get("value"),
            evidence.get("column"),
            evidence.get("metric"),
        )

        if key in seen:
            continue

        seen.add(key)

        unique.append(item)

    return unique


# ============================================================
# Public Recommendation Engine
# ============================================================

def generate_recommendations(
    df: pd.DataFrame,
    metric_column: str | None = None,
    dimension_columns: list[str] | None = None,
    max_recommendations: int = MAX_RECOMMENDATIONS,
) -> dict[str, Any]:
    """
    Generate deterministic recommendations from a dataset.

    No OpenAI, Gemini, Ollama, or external AI API is used here.

    This function is the trusted calculation layer.

    Optional AI enhancement should happen AFTER this function
    returns its verified recommendations.
    """

    dimensions = (
        list(dimension_columns)
        if dimension_columns
        else []
    )

    # Remove duplicate dimensions while preserving order.
    dimensions = list(
        dict.fromkeys(
            dimensions
        )
    )

    _validate_inputs(
        df=df,
        metric_column=metric_column,
        dimension_columns=dimensions,
    )

    recommendations: list[
        dict[str, Any]
    ] = []

    # --------------------------------------------------------
    # Data quality works without metric selection.
    # --------------------------------------------------------

    recommendations.extend(
        _analyze_data_quality(
            df
        )
    )

    valid_metric_rows = 0

    # --------------------------------------------------------
    # Metric-dependent analysis
    # --------------------------------------------------------

    if metric_column is not None:

        numeric_metric = pd.to_numeric(
            df[metric_column],
            errors="coerce",
        )

        valid_metric_rows = int(
            numeric_metric
            .notna()
            .sum()
        )

        if valid_metric_rows > 0:

            recommendations.extend(
                _analyze_anomalies(
                    df=df,
                    metric_column=metric_column,
                )
            )

            if dimensions:

                recommendations.extend(
                    _analyze_segment_performance(
                        df=df,
                        metric_column=metric_column,
                        dimension_columns=dimensions,
                    )
                )

                recommendations.extend(
                    _analyze_concentration(
                        df=df,
                        metric_column=metric_column,
                        dimension_columns=dimensions,
                    )
                )

    # --------------------------------------------------------
    # Deduplicate
    # --------------------------------------------------------

    recommendations = (
        _deduplicate_recommendations(
            recommendations
        )
    )

    # --------------------------------------------------------
    # Sort highest score first
    # --------------------------------------------------------

    recommendations.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    try:
        max_recommendations = int(
            max_recommendations
        )
    except (TypeError, ValueError):
        max_recommendations = (
            MAX_RECOMMENDATIONS
        )

    max_recommendations = max(
        1,
        min(
            100,
            max_recommendations,
        ),
    )

    recommendations = recommendations[
        :max_recommendations
    ]

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    priority_counts = {
        "high": 0,
        "medium": 0,
        "low": 0,
    }

    type_counts: dict[
        str,
        int
    ] = {}

    for recommendation in recommendations:

        priority = recommendation[
            "priority"
        ]

        priority_counts[
            priority
        ] += 1

        recommendation_type = (
            recommendation[
                "type"
            ]
        )

        type_counts[
            recommendation_type
        ] = (
            type_counts.get(
                recommendation_type,
                0,
            )
            + 1
        )

    return {
        "summary": {
            "total":
                len(recommendations),

            "high_priority":
                priority_counts["high"],

            "medium_priority":
                priority_counts["medium"],

            "low_priority":
                priority_counts["low"],

            "by_type":
                type_counts,
        },

        "recommendations":
            recommendations,

        "analysis_quality": {
            "engine":
                "deterministic_v1",

            "external_ai_used":
                False,

            "rows_analyzed":
                len(df),

            "metric_column":
                metric_column,

            "valid_metric_rows":
                valid_metric_rows,

            "dimension_columns":
                dimensions,

            "rules": {
                "missing_warning_percentage":
                    MISSING_WARNING_THRESHOLD,

                "missing_critical_percentage":
                    MISSING_CRITICAL_THRESHOLD,

                "concentration_percentage":
                    CONCENTRATION_THRESHOLD,

                "strong_segment_percentage":
                    SEGMENT_STRONG_THRESHOLD,

                "weak_segment_percentage":
                    SEGMENT_WEAK_THRESHOLD,

                "anomaly_z_score":
                    ANOMALY_Z_THRESHOLD,
            },
        },
    }