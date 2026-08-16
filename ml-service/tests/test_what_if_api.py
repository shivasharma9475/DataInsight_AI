"""
Integration tests for the hybrid What-if API endpoint (POST /what-if).

Covers:
    a. manual mode
    b. deterministic natural-language mode (no OPENAI_API_KEY)
    c. OpenAI mode (OpenAI client mocked, never calls the real API)
    d. OpenAI failure -> deterministic fallback
    e. invalid column
    f. invalid segment
    g. invalid percentage
"""
import uuid
from unittest.mock import patch, MagicMock

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import INTERNAL_API_KEY
from app.services import data_processing as dp

client = TestClient(app)

HEADERS = {"x-internal-key": INTERNAL_API_KEY}


@pytest.fixture
def dataset_id():
    ds_id = str(uuid.uuid4())
    df = pd.DataFrame(
        {
            "sales": [100, 200, 300, 400],
            "region": ["North", "South", "West", "West"],
            "profit": [10, 20, 30, 40],
        }
    )
    dp.save_dataframe(ds_id, df, cleaned=True)
    return ds_id


# -----------------------------------------------------------------
# a. Manual mode
# -----------------------------------------------------------------

def test_manual_mode(dataset_id):
    response = client.post(
        "/what-if",
        headers=HEADERS,
        json={
            "dataset_id": dataset_id,
            "metric_column": "sales",
            "change_percentage": 10,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["result"]["scenario_type"] == "metric"
    assert body["result"]["baseline_total"] == 1000
    assert body["result"]["projected_total"] == 1100
    assert body["result"]["engine"] == "deterministic_v1"


def test_manual_mode_with_segment(dataset_id):
    response = client.post(
        "/what-if",
        headers=HEADERS,
        json={
            "dataset_id": dataset_id,
            "metric_column": "sales",
            "dimension_column": "region",
            "segment_value": "South",
            "change_percentage": 20,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["result"]["scenario_type"] == "segment"
    assert body["result"]["baseline_segment"] == 200


# -----------------------------------------------------------------
# b. Deterministic natural-language mode
# -----------------------------------------------------------------

def test_deterministic_nl_mode(dataset_id, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post(
        "/what-if",
        headers=HEADERS,
        json={
            "dataset_id": dataset_id,
            "question": "What if South region sales increase by 15%?",
        },
    )

    assert response.status_code == 200
    body = response.json()
    result = body["result"]

    assert result["planner"] == "deterministic_v1"
    assert result["ai_used"] is False
    assert result["metric_column"] == "sales"
    assert result["dimension_column"] == "region"
    assert result["segment_value"] == "South"
    assert result["change_percentage"] == 15


# -----------------------------------------------------------------
# c. OpenAI mode (mocked client, no real network call)
# -----------------------------------------------------------------

def test_openai_mode(dataset_id, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    fake_response = MagicMock()
    fake_response.choices = [
        MagicMock(
            message=MagicMock(
                content=(
                    '{"metric_column": "sales", "dimension_column": "region", '
                    '"segment_value": "West", "change_percentage": 25}'
                )
            )
        )
    ]

    with patch("openai.OpenAI") as mock_openai_cls:
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = fake_response
        mock_openai_cls.return_value = mock_client

        response = client.post(
            "/what-if",
            headers=HEADERS,
            json={
                "dataset_id": dataset_id,
                "question": "What if West sales grew by 25%?",
            },
        )

    assert response.status_code == 200
    body = response.json()
    result = body["result"]

    assert result["planner"] == "openai"
    assert result["ai_used"] is True
    assert result["metric_column"] == "sales"
    assert result["dimension_column"] == "region"
    assert result["segment_value"] == "West"
    assert result["change_percentage"] == 25
    # The calculation itself must always come from the deterministic engine.
    assert result["engine"] == "deterministic_v1"


# -----------------------------------------------------------------
# d. OpenAI failure -> deterministic fallback
# -----------------------------------------------------------------

def test_openai_failure_falls_back_to_deterministic(dataset_id, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    with patch("openai.OpenAI") as mock_openai_cls:
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = RuntimeError(
            "OpenAI is unavailable"
        )
        mock_openai_cls.return_value = mock_client

        response = client.post(
            "/what-if",
            headers=HEADERS,
            json={
                "dataset_id": dataset_id,
                "question": "What if South sales increase by 15%?",
            },
        )

    assert response.status_code == 200
    body = response.json()
    result = body["result"]

    # Falls back to the deterministic planner without failing the request.
    assert result["planner"] == "deterministic_v1"
    assert result["ai_used"] is False
    assert result["metric_column"] == "sales"
    assert result["change_percentage"] == 15


# -----------------------------------------------------------------
# e. Invalid column
# -----------------------------------------------------------------

def test_invalid_metric_column(dataset_id):
    response = client.post(
        "/what-if",
        headers=HEADERS,
        json={
            "dataset_id": dataset_id,
            "metric_column": "does_not_exist",
            "change_percentage": 10,
        },
    )

    assert response.status_code == 400
    assert "does_not_exist" in response.json()["detail"]


# -----------------------------------------------------------------
# f. Invalid segment
# -----------------------------------------------------------------

def test_invalid_segment_value(dataset_id):
    response = client.post(
        "/what-if",
        headers=HEADERS,
        json={
            "dataset_id": dataset_id,
            "metric_column": "sales",
            "dimension_column": "region",
            "segment_value": "Atlantis",
            "change_percentage": 10,
        },
    )

    assert response.status_code == 400
    assert "Atlantis" in response.json()["detail"]


# -----------------------------------------------------------------
# g. Invalid percentage
# -----------------------------------------------------------------

def test_invalid_percentage_type(dataset_id):
    response = client.post(
        "/what-if",
        headers=HEADERS,
        json={
            "dataset_id": dataset_id,
            "metric_column": "sales",
            "change_percentage": "not-a-number",
        },
    )

    # FastAPI/pydantic rejects a non-numeric change_percentage before it
    # ever reaches the engine.
    assert response.status_code == 422


def test_missing_percentage_in_manual_mode(dataset_id):
    response = client.post(
        "/what-if",
        headers=HEADERS,
        json={
            "dataset_id": dataset_id,
            "metric_column": "sales",
        },
    )

    assert response.status_code == 400
    assert "change_percentage" in response.json()["detail"]


# -----------------------------------------------------------------
# Auth / dataset-not-found guardrails
# -----------------------------------------------------------------

def test_requires_internal_key(dataset_id):
    response = client.post(
        "/what-if",
        json={
            "dataset_id": dataset_id,
            "metric_column": "sales",
            "change_percentage": 10,
        },
    )

    assert response.status_code == 403


def test_dataset_not_found():
    response = client.post(
        "/what-if",
        headers=HEADERS,
        json={
            "dataset_id": str(uuid.uuid4()),
            "metric_column": "sales",
            "change_percentage": 10,
        },
    )

    assert response.status_code == 404
