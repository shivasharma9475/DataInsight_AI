"""
PostgreSQL connector.

Same read-only, whitelist-validated-table-only design as the MySQL
connector -- no free-text SQL entry point.
"""
from __future__ import annotations

from typing import Any

import pandas as pd
import psycopg2
import psycopg2.extras

from .base import BaseConnector, ConnectorError, DEFAULT_TIMEOUT_SECONDS, validate_sql_identifier

_MAX_ROWS = 200_000


class PostgresConnector(BaseConnector):
    """
    config:
      host, port (default 5432), user, password, database, schema (default 'public')
    """

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        cfg = config or {}

        for field in ("host", "user", "database"):
            if not cfg.get(field):
                raise ConnectorError(f"'{field}' is required.")

        self.host = cfg["host"]
        self.port = int(cfg.get("port") or 5432)
        self.user = cfg["user"]
        self.password = cfg.get("password") or ""
        self.database = cfg["database"]
        self.schema = validate_sql_identifier(cfg.get("schema") or "public", kind="schema name")

    def _connect(self):
        try:
            return psycopg2.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                dbname=self.database,
                connect_timeout=DEFAULT_TIMEOUT_SECONDS,
                options=f"-c statement_timeout={DEFAULT_TIMEOUT_SECONDS * 1000}",
            )
        except psycopg2.OperationalError as exc:
            # Covers unreachable host, timeout, and bad credentials. The
            # driver's message includes host/user but never the password.
            raise ConnectorError(f"Could not connect to PostgreSQL: {exc}") from exc

    def test_connection(self) -> dict:
        conn = self._connect()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
            return {"success": True, "message": f"Connected to database '{self.database}'."}
        finally:
            conn.close()

    def list_resources(self) -> list[str]:
        conn = self._connect()
        try:
            with conn.cursor() as cur:
                # schema was already validated as a safe identifier; the
                # value we're filtering by is bound as a parameter.
                cur.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = %s",
                    (self.schema,),
                )
                return [row[0] for row in cur.fetchall()]
        finally:
            conn.close()

    def fetch_dataframe(self, resource: str, limit: int | None = None) -> pd.DataFrame:
        table = validate_sql_identifier(resource, kind="table name")

        row_limit = min(limit, _MAX_ROWS) if limit else _MAX_ROWS

        conn = self._connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # `table`/`self.schema` were validated against a strict
                # identifier allow-list, so interpolation here is safe --
                # DBAPI can't parameterize identifiers, only values. The
                # row limit itself IS parameterized.
                cur.execute(
                    f'SELECT * FROM "{self.schema}"."{table}" LIMIT %s',
                    (row_limit,),
                )
                rows = cur.fetchall()
        except psycopg2.errors.UndefinedTable as exc:
            raise ConnectorError(f"Table '{table}' could not be read: {exc}") from exc
        finally:
            conn.close()

        if not rows:
            raise ConnectorError(f"Table '{table}' is empty.")

        return pd.DataFrame([dict(r) for r in rows])
