# app/connectors.py
"""
Connector API: test a data-source connection, list its importable
resources, and import a chosen resource into the same dataset pipeline
CSV/Excel uploads use.

Not exposed to the browser -- only the Node backend calls this, with the
internal shared-secret header, same as every other route in this service.

Credentials arrive in the request body on every call and are used only
for the duration of that single request; nothing here writes them to
disk, logs them, or echoes them back in a response.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.security import require_internal_key
from app.services import data_processing as dp
from app.services.connectors import get_connector, ConnectorError

router = APIRouter(prefix="/connectors")


# =========================================================
# Request Schemas
# =========================================================

class ConnectorTestRequest(BaseModel):
    type: str = Field(..., min_length=1)
    config: dict[str, Any] = Field(default_factory=dict)


class ConnectorImportRequest(BaseModel):
    type: str = Field(..., min_length=1)
    config: dict[str, Any] = Field(default_factory=dict)
    resource: str = Field(..., min_length=1)
    limit: Optional[int] = Field(default=None, ge=1, le=200_000)


# =========================================================
# Endpoints
# =========================================================

@router.post("/test", dependencies=[Depends(require_internal_key)])
async def test_connector(payload: ConnectorTestRequest):
    try:
        connector = get_connector(payload.type, payload.config)
        result = connector.test_connection()
        resources = connector.list_resources()
    except ConnectorError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Never leak raw driver/library internals (which can include
        # connection strings) to the client -- log server-side only.
        print("[CONNECTOR TEST ERROR]", type(e).__name__, str(e))
        raise HTTPException(
            status_code=400,
            detail="Could not connect. Please check your connection details.",
        )

    return {
        "success": True,
        "result": {
            **result,
            "resources": resources,
        },
    }


@router.post("/import", dependencies=[Depends(require_internal_key)])
async def import_connector(payload: ConnectorImportRequest):
    try:
        connector = get_connector(payload.type, payload.config)
        df = connector.fetch_dataframe(payload.resource, payload.limit)
        source_label = f"{payload.type}:{payload.resource}"
        dataset_id, _, profile = dp.ingest_dataframe(df, source_label=source_label)
    except ConnectorError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        # e.g. ingest_dataframe's own empty-dataframe guard
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print("[CONNECTOR IMPORT ERROR]", type(e).__name__, str(e))
        raise HTTPException(
            status_code=400,
            detail="Import failed. Please check your connection details and selected resource.",
        )

    return {
        "success": True,
        "result": {
            "dataset_id": dataset_id,
            "profile": profile,
        },
    }
