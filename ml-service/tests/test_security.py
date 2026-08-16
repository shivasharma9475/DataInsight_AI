from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_root_cause_endpoint_requires_internal_key():
    response = client.post(
        "/analysis/root-cause",
        json={
            "dataset_id": "test",
            "date_column": "date",
            "metric_column": "revenue",
            "dimension_columns": ["region"],
        },
    )

    assert response.status_code == 403


# ---------------------------------------------------------------------
# Production secret enforcement
#
# app.core.config reads INTERNAL_API_KEY at import time, so each scenario
# needs a fresh Python subprocess rather than re-importing within this
# process.
# ---------------------------------------------------------------------

import subprocess
import sys


def _load_config_in_subprocess(env_overrides):
    import os

    env = os.environ.copy()
    env.update(env_overrides)

    result = subprocess.run(
        [sys.executable, "-c", "import app.core.config"],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        env=env,
        capture_output=True,
        text=True,
    )
    return result


def test_refuses_to_start_in_production_without_internal_api_key():
    result = _load_config_in_subprocess(
        {"ENVIRONMENT": "production", "INTERNAL_API_KEY": ""}
    )
    assert result.returncode != 0
    assert "FATAL" in result.stderr


def test_starts_in_production_with_internal_api_key_set():
    result = _load_config_in_subprocess(
        {
            "ENVIRONMENT": "production",
            "INTERNAL_API_KEY": "a-real-random-shared-secret",
        }
    )
    assert result.returncode == 0


def test_starts_with_dev_default_outside_production():
    result = _load_config_in_subprocess(
        {"ENVIRONMENT": "development", "INTERNAL_API_KEY": ""}
    )
    assert result.returncode == 0