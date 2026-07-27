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