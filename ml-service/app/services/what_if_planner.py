from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional

from openai import OpenAI


def _clean_column_name(
    value: str,
    columns: list[str],
) -> Optional[str]:
    """
    Match a user-provided column name against
    actual dataset columns.
    """

    if not value:
        return None

    value = str(value).strip()

    # Exact match
    if value in columns:
        return value

    # Case-insensitive match
    lowered = value.lower()

    for column in columns:
        if column.lower() == lowered:
            return column

    return None


def _clean_segment_value(
    value: Any,
    dimension_column: Optional[str],
    df,
) -> Optional[Any]:
    if value is None or dimension_column is None:
        return value

    values = df[dimension_column].dropna().unique()

    value_str = str(value).strip().lower()

    for existing in values:
        if str(existing).strip().lower() == value_str:
            return existing

    return None


def deterministic_plan(
    message: str,
    df,
    profile: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Convert a natural-language what-if question into
    structured parameters without using an external AI API.

    Supported examples:

        "Increase sales by 15%"

        "What if sales increase by 15%?"

        "What if West region sales increase by 20%?"

        "Decrease sales in West by 10%"
    """

    if not message or not message.strip():
        raise ValueError(
            "What-if question is required."
        )

    columns = list(df.columns)

    numerical_columns = []

    if profile:
        numerical_columns = (
            profile.get("numerical_columns")
            or []
        )

    if not numerical_columns:
        numerical_columns = [
            column
            for column in columns
            if str(
                df[column].dtype
            ).startswith(
                ("int", "float")
            )
        ]

    if not numerical_columns:
        raise ValueError(
            "Dataset does not contain a numeric column."
        )

    text = message.strip()

    # -----------------------------------------------------
    # Extract percentage
    # -----------------------------------------------------

    percentage_match = re.search(
        r"([+-]?\d+(?:\.\d+)?)\s*%",
        text,
    )

    if not percentage_match:
        raise ValueError(
            "Could not find a percentage change. "
            "Example: 'increase sales by 15%'."
        )

    change_percentage = float(
        percentage_match.group(1)
    )

    # -----------------------------------------------------
    # Detect increase / decrease
    # -----------------------------------------------------

    lowered = text.lower()

    decrease_words = [
        "decrease",
        "decreases",
        "decreased",
        "reduce",
        "reduces",
        "reduced",
        "drop",
        "drops",
        "dropped",
        "lower",
        "decline",
        "declines",
        "fall",
        "falls",
    ]

    increase_words = [
        "increase",
        "increases",
        "increased",
        "raise",
        "raises",
        "raised",
        "grow",
        "grows",
        "growth",
        "improve",
        "improves",
        "improved",
    ]

    if any(
        word in lowered
        for word in decrease_words
    ):
        change_percentage = -abs(
            change_percentage
        )

    elif any(
        word in lowered
        for word in increase_words
    ):
        change_percentage = abs(
            change_percentage
        )

    # -----------------------------------------------------
    # Detect metric column
    # -----------------------------------------------------

    metric_column = None

    # Prefer longer column names first
    # to avoid partial matches.
    sorted_columns = sorted(
        numerical_columns,
        key=len,
        reverse=True,
    )

    for column in sorted_columns:
        if column.lower() in lowered:
            metric_column = column
            break

    if metric_column is None:
        if len(numerical_columns) == 1:
            metric_column = numerical_columns[0]
        else:
            raise ValueError(
                "Could not determine the metric column. "
                f"Available numeric columns: {numerical_columns}"
            )

    # -----------------------------------------------------
    # Detect dimension + segment
    # -----------------------------------------------------

    dimension_column = None
    segment_value = None

    categorical_columns = []

    if profile:
        categorical_columns = (
            profile.get("categorical_columns")
            or []
        )

    if not categorical_columns:
        categorical_columns = [
            column
            for column in columns
            if column != metric_column
            and str(
                df[column].dtype
            ) == "object"
        ]

    for dimension in sorted(
        categorical_columns,
        key=len,
        reverse=True,
    ):
        if dimension.lower() not in lowered:
            continue

        unique_values = (
            df[dimension]
            .dropna()
            .unique()
        )

        for value in unique_values:
            if str(value).lower() in lowered:
                dimension_column = dimension
                segment_value = value
                break

        if dimension_column:
            break

    # -----------------------------------------------------
    # Return structured plan
    # -----------------------------------------------------

    return {
        "metric_column": metric_column,
        "dimension_column": dimension_column,
        "segment_value": segment_value,
        "change_percentage": change_percentage,
        "planner": "deterministic_v1",
        "ai_used": False,
    }


def _openai_plan(
    message: str,
    df,
    profile: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Use OpenAI ONLY to understand the user's request.

    OpenAI does NOT calculate anything.
    """

    api_key = os.getenv(
        "OPENAI_API_KEY"
    )

    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured."
        )

    client = OpenAI(
        api_key=api_key
    )

    columns = list(df.columns)

    numerical_columns = (
        profile.get("numerical_columns", [])
        if profile
        else []
    )

    categorical_columns = (
        profile.get("categorical_columns", [])
        if profile
        else []
    )

    prompt = f"""
You are a What-if analysis planner.

Convert the user's request into JSON parameters.

You MUST NOT calculate any values.

Available columns:
{columns}

Numeric columns:
{numerical_columns}

Categorical columns:
{categorical_columns}

User question:
{message}

Return ONLY valid JSON:

{{
  "metric_column": "string",
  "dimension_column": "string or null",
  "segment_value": "value or null",
  "change_percentage": number
}}

Rules:
- metric_column must be one of the numeric columns.
- dimension_column must be one of the categorical columns or null.
- segment_value must belong to the selected dimension or null.
- Increase must be positive.
- Decrease must be negative.
- Do not invent columns or values.
"""

    response = client.chat.completions.create(
        model=os.getenv(
            "OPENAI_MODEL",
            "gpt-4o-mini",
        ),
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": prompt,
            }
        ],
    )

    content = (
        response.choices[0]
        .message.content
        .strip()
    )

    # Handle accidental markdown fences
    content = re.sub(
        r"^```json\s*",
        "",
        content,
        flags=re.IGNORECASE,
    )

    content = re.sub(
        r"\s*```$",
        "",
        content,
    )

    plan = json.loads(content)

    metric_column = _clean_column_name(
        plan.get("metric_column"),
        numerical_columns,
    )

    if not metric_column:
        raise ValueError(
            "OpenAI returned an invalid metric column."
        )

    dimension_column = plan.get(
        "dimension_column"
    )

    if dimension_column:
        dimension_column = _clean_column_name(
            dimension_column,
            categorical_columns,
        )

        if not dimension_column:
            raise ValueError(
                "OpenAI returned an invalid dimension column."
            )

    segment_value = _clean_segment_value(
        plan.get("segment_value"),
        dimension_column,
        df,
    )

    if (
        dimension_column
        and segment_value is None
    ):
        raise ValueError(
            "OpenAI returned an invalid segment value."
        )

    change_percentage = float(
        plan["change_percentage"]
    )

    return {
        "metric_column": metric_column,
        "dimension_column": dimension_column,
        "segment_value": segment_value,
        "change_percentage": change_percentage,
        "planner": "openai",
        "ai_used": True,
    }


def plan_what_if(
    message: str,
    df,
    profile: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Hybrid planner.

    1. Try OpenAI if an API key exists.
    2. If OpenAI is unavailable/fails, use deterministic planner.
    3. Never perform the actual calculation here.
    """

    api_key = os.getenv(
        "OPENAI_API_KEY"
    )

    if api_key:
        try:
            return _openai_plan(
                message=message,
                df=df,
                profile=profile,
            )

        except Exception as exc:
            print(
                "[WHAT-IF] OpenAI planner failed. "
                "Falling back to deterministic planner:",
                type(exc).__name__,
                str(exc),
            )

    return deterministic_plan(
        message=message,
        df=df,
        profile=profile,
    )