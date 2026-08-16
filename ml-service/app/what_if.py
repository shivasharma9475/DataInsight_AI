# app/what_if.py

from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.services import data_processing as dp
from app.services.what_if_engine import (
    WhatIfError,
    run_what_if,
)
from app.services.what_if_planner import (
    plan_what_if,
)
from app.core.security import require_internal_key


router = APIRouter()


# =========================================================
# Request Schema
# =========================================================

class WhatIfRequest(BaseModel):
    dataset_id: str = Field(
        ...,
        min_length=1,
    )

    # Natural-language mode
    question: Optional[str] = None

    # Manual mode
    metric_column: Optional[str] = None

    change_percentage: Optional[float] = None

    dimension_column: Optional[str] = None

    segment_value: Optional[Any] = None


# =========================================================
# Internal API Authentication
#
# NOTE: require_internal_key now lives in app.core.security so both this
# router and app/main.py share a single, timing-safe implementation.
# =========================================================


# =========================================================
# Dataset Loader
# =========================================================

def load_dataset(dataset_id: str):
    try:
        return dp.load_dataframe(
            dataset_id,
            cleaned=True,
        )

    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found",
        )


# =========================================================
# What-if Analysis
# =========================================================

@router.post(
    "/what-if",
    dependencies=[
        Depends(require_internal_key)
    ],
)
async def what_if(
    payload: WhatIfRequest,
):
    """
    Hybrid What-if Analysis endpoint.

    Supports two modes.

    -----------------------------------------------------
    Manual mode
    -----------------------------------------------------

    {
        "dataset_id": "...",
        "metric_column": "sales",
        "dimension_column": "region",
        "segment_value": "South",
        "change_percentage": 15
    }

    -----------------------------------------------------
    Natural-language mode
    -----------------------------------------------------

    {
        "dataset_id": "...",
        "question": "What if South region sales increase by 15%?"
    }

    -----------------------------------------------------

    OpenAI is only used for planning.
    Actual calculations are always performed by
    the deterministic What-if Engine.
    """

    # -----------------------------------------------------
    # Load dataset
    # -----------------------------------------------------

    df = load_dataset(
        payload.dataset_id
    )

    try:

        # =================================================
        # MODE 1
        # Natural-language question
        # =================================================

        if payload.question:

            profile = dp.profile_dataframe(df)

            plan = plan_what_if(
                message=payload.question,
                df=df,
                profile=profile,
            )

            result = run_what_if(
                df=df,

                metric_column=plan[
                    "metric_column"
                ],

                change_percentage=plan[
                    "change_percentage"
                ],

                dimension_column=plan.get(
                    "dimension_column"
                ),

                segment_value=plan.get(
                    "segment_value"
                ),
            )

            # -------------------------------------------------
            # Add planner metadata
            # -------------------------------------------------

            result["planner"] = plan.get(
                "planner",
                "deterministic_v1",
            )

            result["ai_used"] = plan.get(
                "ai_used",
                False,
            )

            return {
                "success": True,
                "result": result,
            }

        # =================================================
        # MODE 2
        # Manual selectors
        # =================================================

        if not payload.metric_column:

            raise WhatIfError(
                "metric_column is required "
                "when question is not provided."
            )

        if payload.change_percentage is None:

            raise WhatIfError(
                "change_percentage is required "
                "when question is not provided."
            )

        result = run_what_if(
            df=df,

            metric_column=payload.metric_column,

            change_percentage=payload.change_percentage,

            dimension_column=payload.dimension_column,

            segment_value=payload.segment_value,
        )

        return {
            "success": True,
            "result": result,
        }

    # =====================================================
    # Expected What-if errors
    # =====================================================

    except WhatIfError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    # =====================================================
    # Planner / validation errors
    # =====================================================

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    # =====================================================
    # Unexpected errors
    # =====================================================

    except Exception as exc:

        print(
            "[WHAT-IF ERROR]",
            type(exc).__name__,
            str(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="What-if analysis failed",
        )