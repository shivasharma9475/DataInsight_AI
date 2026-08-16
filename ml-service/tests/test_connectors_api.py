"""
API-level tests for POST /connectors/test and POST /connectors/import.
"""
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient

from app.main import app
from app.core.config import INTERNAL_API_KEY

client = TestClient(app)
HEADERS = {"x-internal-key": INTERNAL_API_KEY}


# ---------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------

def test_connectors_test_requires_internal_key():
    response = client.post("/connectors/test", json={"type": "rest", "config": {"url": "https://example.com"}})
    assert response.status_code == 403


def test_connectors_import_requires_internal_key():
    response = client.post(
        "/connectors/import",
        json={"type": "rest", "config": {"url": "https://example.com"}, "resource": "response"},
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------

def test_connectors_test_unknown_type():
    response = client.post(
        "/connectors/test", headers=HEADERS, json={"type": "ftp", "config": {}}
    )
    assert response.status_code == 400
    assert "Unknown connector type" in response.json()["detail"]


def test_connectors_import_missing_resource():
    response = client.post(
        "/connectors/import",
        headers=HEADERS,
        json={"type": "rest", "config": {"url": "https://example.com"}},
    )
    assert response.status_code == 422  # pydantic: resource is required


# ---------------------------------------------------------------------
# REST connector via the API
# ---------------------------------------------------------------------

def test_connectors_test_rest_success():
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}

    with patch("requests.get", return_value=fake_response):
        response = client.post(
            "/connectors/test",
            headers=HEADERS,
            json={"type": "rest", "config": {"url": "https://example.com/api"}},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["result"]["success"] is True


def test_connectors_import_rest_creates_dataset():
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}
    fake_response.json.return_value = [
        {"region": "North", "sales": 100},
        {"region": "South", "sales": 200},
    ]

    with patch("requests.get", return_value=fake_response):
        response = client.post(
            "/connectors/import",
            headers=HEADERS,
            json={
                "type": "rest",
                "config": {"url": "https://example.com/api"},
                "resource": "response",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert "dataset_id" in body["result"]
    assert body["result"]["profile"]["row_count"] == 2


def test_connectors_import_rest_malformed_response_returns_400():
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}
    fake_response.json.side_effect = ValueError("bad json")

    with patch("requests.get", return_value=fake_response):
        response = client.post(
            "/connectors/import",
            headers=HEADERS,
            json={
                "type": "rest",
                "config": {"url": "https://example.com/api"},
                "resource": "response",
            },
        )

    assert response.status_code == 400


def test_connectors_import_rest_empty_dataset_returns_400():
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}
    fake_response.json.return_value = []

    with patch("requests.get", return_value=fake_response):
        response = client.post(
            "/connectors/import",
            headers=HEADERS,
            json={
                "type": "rest",
                "config": {"url": "https://example.com/api"},
                "resource": "response",
            },
        )

    assert response.status_code == 400


# ---------------------------------------------------------------------
# MySQL connector via the API
# ---------------------------------------------------------------------

def test_connectors_test_mysql_invalid_credentials_returns_400():
    import pymysql

    with patch(
        "pymysql.connect",
        side_effect=pymysql.err.OperationalError(1045, "Access denied"),
    ):
        response = client.post(
            "/connectors/test",
            headers=HEADERS,
            json={
                "type": "mysql",
                "config": {
                    "host": "localhost",
                    "user": "root",
                    "password": "wrong",
                    "database": "shop",
                },
            },
        )

    assert response.status_code == 400
    # Credentials must never appear in the error response.
    assert "wrong" not in response.text


def test_connectors_import_mysql_rejects_sql_injection_in_resource():
    response = client.post(
        "/connectors/import",
        headers=HEADERS,
        json={
            "type": "mysql",
            "config": {"host": "localhost", "user": "root", "password": "x", "database": "shop"},
            "resource": "orders; DROP TABLE users;--",
        },
    )
    assert response.status_code == 400


def test_connectors_import_mysql_success():
    fake_cursor = MagicMock()
    fake_cursor.__enter__.return_value = fake_cursor
    fake_cursor.fetchall.return_value = [(1, "North", 100.0), (2, "South", 200.0)]
    fake_cursor.description = [("id",), ("region",), ("sales",)]
    fake_conn = MagicMock()
    fake_conn.cursor.return_value = fake_cursor

    with patch("pymysql.connect", return_value=fake_conn):
        response = client.post(
            "/connectors/import",
            headers=HEADERS,
            json={
                "type": "mysql",
                "config": {"host": "localhost", "user": "root", "password": "x", "database": "shop"},
                "resource": "orders",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["result"]["profile"]["row_count"] == 2
    # The password must never be echoed back anywhere in the response.
    assert '"x"' not in response.text


# ---------------------------------------------------------------------
# Credentials must never leak into responses
# ---------------------------------------------------------------------

def test_connector_secrets_never_appear_in_test_response():
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}

    with patch("requests.get", return_value=fake_response):
        response = client.post(
            "/connectors/test",
            headers=HEADERS,
            json={
                "type": "rest",
                "config": {
                    "url": "https://example.com/api",
                    "headers": {"Authorization": "Bearer super-secret-token-12345"},
                },
            },
        )

    assert "super-secret-token-12345" not in response.text


def test_connector_secrets_never_appear_in_postgres_error_response():
    import psycopg2

    with patch(
        "psycopg2.connect",
        side_effect=psycopg2.OperationalError("password authentication failed"),
    ):
        response = client.post(
            "/connectors/test",
            headers=HEADERS,
            json={
                "type": "postgres",
                "config": {
                    "host": "localhost",
                    "user": "postgres",
                    "password": "top-secret-password",
                    "database": "shop",
                },
            },
        )

    assert response.status_code == 400
    assert "top-secret-password" not in response.text
