"""
MySQL connector.

Read-only by design: only ever issues SELECT statements against a single,
caller-chosen, whitelist-validated table name. There is no free-text SQL
entry point anywhere in this connector.
"""
from __future__ import annotations

from typing import Any

import pandas as pd
import pymysql

from .base import BaseConnector, ConnectorError, DEFAULT_TIMEOUT_SECONDS, validate_sql_identifier

_MAX_ROWS = 200_000


class MySQLConnector(BaseConnector):
    """
    config:
      host, port (default 3306), user, password, database
    """

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        cfg = config or {}

        for field in ("host", "user", "database"):
            if not cfg.get(field):
                raise ConnectorError(f"'{field}' is required.")

        self.host = cfg["host"]
        self.port = int(cfg.get("port") or 3306)
        self.user = cfg["user"]
        self.password = cfg.get("password") or ""
        self.database = cfg["database"]

    def _connect(self):
        try:
            return pymysql.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database,
                connect_timeout=DEFAULT_TIMEOUT_SECONDS,
                read_timeout=DEFAULT_TIMEOUT_SECONDS,
                cursorclass=pymysql.cursors.SSCursor,
            )
        except pymysql.err.OperationalError as exc:
            # OperationalError covers both "can't reach host" (timeout/
            # refused) and "access denied" (bad credentials). Message text
            # from pymysql doesn't include the password, only host/user,
            # so it's safe to surface as-is.
            raise ConnectorError(f"Could not connect to MySQL: {exc}") from exc
        except pymysql.err.MySQLError as exc:
            raise ConnectorError(f"MySQL error: {exc}") from exc

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
                # Table names come back from MySQL's own catalog, not from
                # caller input, so no identifier validation is needed here.
                cur.execute("SHOW TABLES")
                return [row[0] for row in cur.fetchall()]
        finally:
            conn.close()

    def fetch_dataframe(self, resource: str, limit: int | None = None) -> pd.DataFrame:
        table = validate_sql_identifier(resource, kind="table name")

        row_limit = min(limit, _MAX_ROWS) if limit else _MAX_ROWS

        conn = self._connect()
        try:
            with conn.cursor() as cur:
                # `table` was validated against a strict identifier
                # allow-list above (letters/digits/underscore only), so
                # it's safe to interpolate here -- DBAPI can only
                # parameterize values, not identifiers. The row limit
                # itself IS parameterized.
                cur.execute(f"SELECT * FROM `{table}` LIMIT %s", (row_limit,))
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
        except pymysql.err.ProgrammingError as exc:
            raise ConnectorError(f"Table '{table}' could not be read: {exc}") from exc
        finally:
            conn.close()

        if not rows:
            raise ConnectorError(f"Table '{table}' is empty.")

        return pd.DataFrame(rows, columns=columns)
