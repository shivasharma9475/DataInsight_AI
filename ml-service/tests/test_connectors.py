"""
Unit tests for the connector abstraction and each concrete connector.
All external I/O (requests, pymysql, psycopg2) is mocked -- these tests
never touch the network or a real database.
"""
from unittest.mock import patch, MagicMock

import pandas as pd
import pytest
import requests

from app.services.connectors import get_connector, CONNECTOR_REGISTRY
from app.services.connectors.base import ConnectorError, validate_sql_identifier
from app.services.connectors.rest_connector import RESTConnector
from app.services.connectors.mysql_connector import MySQLConnector
from app.services.connectors.postgres_connector import PostgresConnector
from app.services.connectors.google_sheets_connector import GoogleSheetsConnector


# ---------------------------------------------------------------------
# base.py
# ---------------------------------------------------------------------

def test_validate_sql_identifier_accepts_safe_names():
    assert validate_sql_identifier("sales_2026") == "sales_2026"
    assert validate_sql_identifier("_private") == "_private"


@pytest.mark.parametrize(
    "bad_identifier",
    [
        "sales; DROP TABLE users;--",
        "sales`; DROP TABLE users;--",
        "sales OR 1=1",
        "1table",
        "table name",
        "table-name",
        "",
        "table/**/name",
    ],
)
def test_validate_sql_identifier_rejects_injection_attempts(bad_identifier):
    with pytest.raises(ConnectorError):
        validate_sql_identifier(bad_identifier)


def test_get_connector_unknown_type_raises():
    with pytest.raises(ConnectorError):
        get_connector("carrier_pigeon", {})


def test_get_connector_registry_has_expected_types():
    assert set(CONNECTOR_REGISTRY.keys()) == {"rest", "mysql", "postgres", "google_sheets"}


# ---------------------------------------------------------------------
# REST connector
# ---------------------------------------------------------------------

def test_rest_connector_rejects_bad_url():
    with pytest.raises(ConnectorError):
        RESTConnector({"url": "not-a-url"})


def test_rest_connector_fetch_dataframe_success():
    connector = RESTConnector({"url": "https://example.com/api/sales"})

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}
    fake_response.json.return_value = [
        {"region": "North", "sales": 100},
        {"region": "South", "sales": 200},
    ]

    with patch("requests.get", return_value=fake_response):
        df = connector.fetch_dataframe("response")

    assert len(df) == 2
    assert list(df.columns) == ["region", "sales"]


def test_rest_connector_nested_json_path():
    connector = RESTConnector({"url": "https://example.com/api", "json_path": "data.items"})

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}
    fake_response.json.return_value = {"data": {"items": [{"a": 1}, {"a": 2}]}}

    with patch("requests.get", return_value=fake_response):
        df = connector.fetch_dataframe("response")

    assert len(df) == 2


def test_rest_connector_timeout():
    connector = RESTConnector({"url": "https://example.com/api"})

    with patch("requests.get", side_effect=requests.exceptions.Timeout()):
        with pytest.raises(ConnectorError, match="timed out"):
            connector.fetch_dataframe("response")


def test_rest_connector_connection_error():
    connector = RESTConnector({"url": "https://example.com/api"})

    with patch("requests.get", side_effect=requests.exceptions.ConnectionError()):
        with pytest.raises(ConnectorError):
            connector.test_connection()


def test_rest_connector_malformed_json():
    connector = RESTConnector({"url": "https://example.com/api"})

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}
    fake_response.json.side_effect = ValueError("not json")

    with patch("requests.get", return_value=fake_response):
        with pytest.raises(ConnectorError, match="not valid JSON"):
            connector.fetch_dataframe("response")


def test_rest_connector_empty_response():
    connector = RESTConnector({"url": "https://example.com/api"})

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}
    fake_response.json.return_value = []

    with patch("requests.get", return_value=fake_response):
        with pytest.raises(ConnectorError, match="empty"):
            connector.fetch_dataframe("response")


def test_rest_connector_http_error_status():
    connector = RESTConnector({"url": "https://example.com/api"})

    fake_response = MagicMock()
    fake_response.status_code = 404
    fake_response.headers = {}

    with patch("requests.get", return_value=fake_response):
        with pytest.raises(ConnectorError, match="404"):
            connector.fetch_dataframe("response")


def test_rest_connector_wrong_shape_response():
    connector = RESTConnector({"url": "https://example.com/api"})

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}
    fake_response.json.return_value = "just a string"

    with patch("requests.get", return_value=fake_response):
        with pytest.raises(ConnectorError):
            connector.fetch_dataframe("response")


# ---------------------------------------------------------------------
# MySQL connector
# ---------------------------------------------------------------------

def test_mysql_connector_requires_fields():
    with pytest.raises(ConnectorError):
        MySQLConnector({"host": "localhost"})  # missing user/database


def test_mysql_connector_invalid_credentials():
    import pymysql

    connector = MySQLConnector(
        {"host": "localhost", "user": "root", "password": "wrong", "database": "shop"}
    )

    with patch(
        "pymysql.connect",
        side_effect=pymysql.err.OperationalError(1045, "Access denied for user 'root'@'localhost'"),
    ):
        with pytest.raises(ConnectorError, match="Could not connect"):
            connector.test_connection()


def test_mysql_connector_timeout():
    import socket

    connector = MySQLConnector(
        {"host": "10.255.255.1", "user": "root", "password": "x", "database": "shop"}
    )

    with patch("pymysql.connect", side_effect=socket.timeout("timed out")):
        with pytest.raises(Exception):
            connector.test_connection()


def test_mysql_connector_rejects_invalid_table_identifier():
    connector = MySQLConnector(
        {"host": "localhost", "user": "root", "password": "x", "database": "shop"}
    )

    with patch.object(MySQLConnector, "_connect"):
        with pytest.raises(ConnectorError):
            connector.fetch_dataframe("sales; DROP TABLE users;--")


def test_mysql_connector_lists_tables():
    connector = MySQLConnector(
        {"host": "localhost", "user": "root", "password": "x", "database": "shop"}
    )

    fake_cursor = MagicMock()
    fake_cursor.__enter__.return_value = fake_cursor
    fake_cursor.fetchall.return_value = [("orders",), ("customers",)]
    fake_conn = MagicMock()
    fake_conn.cursor.return_value = fake_cursor

    with patch.object(connector, "_connect", return_value=fake_conn):
        resources = connector.list_resources()

    assert resources == ["orders", "customers"]


def test_mysql_connector_fetch_dataframe_success():
    connector = MySQLConnector(
        {"host": "localhost", "user": "root", "password": "x", "database": "shop"}
    )

    fake_cursor = MagicMock()
    fake_cursor.__enter__.return_value = fake_cursor
    fake_cursor.fetchall.return_value = [(1, "North", 100), (2, "South", 200)]
    fake_cursor.description = [("id",), ("region",), ("sales",)]
    fake_conn = MagicMock()
    fake_conn.cursor.return_value = fake_cursor

    with patch.object(connector, "_connect", return_value=fake_conn):
        df = connector.fetch_dataframe("orders")

    assert len(df) == 2
    assert list(df.columns) == ["id", "region", "sales"]


def test_mysql_connector_empty_table():
    connector = MySQLConnector(
        {"host": "localhost", "user": "root", "password": "x", "database": "shop"}
    )

    fake_cursor = MagicMock()
    fake_cursor.__enter__.return_value = fake_cursor
    fake_cursor.fetchall.return_value = []
    fake_cursor.description = [("id",)]
    fake_conn = MagicMock()
    fake_conn.cursor.return_value = fake_cursor

    with patch.object(connector, "_connect", return_value=fake_conn):
        with pytest.raises(ConnectorError, match="empty"):
            connector.fetch_dataframe("orders")


# ---------------------------------------------------------------------
# PostgreSQL connector
# ---------------------------------------------------------------------

def test_postgres_connector_requires_fields():
    with pytest.raises(ConnectorError):
        PostgresConnector({"host": "localhost"})


def test_postgres_connector_rejects_invalid_schema():
    with pytest.raises(ConnectorError):
        PostgresConnector(
            {
                "host": "localhost",
                "user": "postgres",
                "database": "shop",
                "schema": "public; DROP TABLE users;--",
            }
        )


def test_postgres_connector_rejects_invalid_table_identifier():
    connector = PostgresConnector(
        {"host": "localhost", "user": "postgres", "password": "x", "database": "shop"}
    )

    with patch.object(PostgresConnector, "_connect"):
        with pytest.raises(ConnectorError):
            connector.fetch_dataframe("orders; DROP TABLE users;--")


def test_postgres_connector_invalid_credentials():
    import psycopg2

    connector = PostgresConnector(
        {"host": "localhost", "user": "postgres", "password": "wrong", "database": "shop"}
    )

    with patch("psycopg2.connect", side_effect=psycopg2.OperationalError("password authentication failed")):
        with pytest.raises(ConnectorError, match="Could not connect"):
            connector.test_connection()


def test_postgres_connector_fetch_dataframe_success():
    connector = PostgresConnector(
        {"host": "localhost", "user": "postgres", "password": "x", "database": "shop"}
    )

    fake_cursor = MagicMock()
    fake_cursor.__enter__.return_value = fake_cursor
    fake_cursor.fetchall.return_value = [
        {"id": 1, "region": "North", "sales": 100},
        {"id": 2, "region": "South", "sales": 200},
    ]
    fake_conn = MagicMock()
    fake_conn.cursor.return_value = fake_cursor

    with patch.object(connector, "_connect", return_value=fake_conn):
        df = connector.fetch_dataframe("orders")

    assert len(df) == 2
    assert set(df.columns) == {"id", "region", "sales"}


# ---------------------------------------------------------------------
# Google Sheets connector (public CSV export only)
# ---------------------------------------------------------------------

def test_google_sheets_connector_extracts_sheet_id_from_url():
    connector = GoogleSheetsConnector(
        {"url": "https://docs.google.com/spreadsheets/d/1AbCdEfGhIj/edit#gid=42"}
    )
    assert connector.sheet_id == "1AbCdEfGhIj"
    assert connector.gid == "42"


def test_google_sheets_connector_rejects_bad_url():
    with pytest.raises(ConnectorError):
        GoogleSheetsConnector({"url": "https://example.com/not-a-sheet"})


def test_google_sheets_connector_requires_url():
    with pytest.raises(ConnectorError):
        GoogleSheetsConnector({})


def test_google_sheets_connector_fetch_success():
    connector = GoogleSheetsConnector(
        {"url": "https://docs.google.com/spreadsheets/d/1AbCdEfGhIj/edit"}
    )

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}
    fake_response.text = "region,sales\nNorth,100\nSouth,200\n"

    with patch("requests.get", return_value=fake_response):
        df = connector.fetch_dataframe("gid:0")

    assert len(df) == 2
    assert list(df.columns) == ["region", "sales"]


def test_google_sheets_connector_private_sheet_rejected():
    connector = GoogleSheetsConnector(
        {"url": "https://docs.google.com/spreadsheets/d/1AbCdEfGhIj/edit"}
    )

    fake_response = MagicMock()
    fake_response.status_code = 403
    fake_response.headers = {}

    with patch("requests.get", return_value=fake_response):
        with pytest.raises(ConnectorError, match="not publicly accessible"):
            connector.test_connection()


def test_google_sheets_connector_html_signin_page_detected():
    # A private sheet can return HTTP 200 with an HTML sign-in page
    # instead of CSV -- must be detected and rejected, not silently
    # "imported" as garbage data.
    connector = GoogleSheetsConnector(
        {"url": "https://docs.google.com/spreadsheets/d/1AbCdEfGhIj/edit"}
    )

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.headers = {}
    fake_response.text = "<!DOCTYPE html><html><body>Sign in</body></html>"

    with patch("requests.get", return_value=fake_response):
        with pytest.raises(ConnectorError, match="not publicly accessible"):
            connector.fetch_dataframe("gid:0")


def test_google_sheets_connector_not_found():
    connector = GoogleSheetsConnector(
        {"url": "https://docs.google.com/spreadsheets/d/doesnotexist/edit"}
    )

    fake_response = MagicMock()
    fake_response.status_code = 404
    fake_response.headers = {}

    with patch("requests.get", return_value=fake_response):
        with pytest.raises(ConnectorError, match="not found"):
            connector.test_connection()


def test_google_sheets_connector_timeout():
    connector = GoogleSheetsConnector(
        {"url": "https://docs.google.com/spreadsheets/d/1AbCdEfGhIj/edit"}
    )

    with patch("requests.get", side_effect=requests.exceptions.Timeout()):
        with pytest.raises(ConnectorError, match="timed out"):
            connector.test_connection()
