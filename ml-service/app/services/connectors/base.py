"""
Common connector abstraction.

Every connector (REST, MySQL, PostgreSQL, Google Sheets, ...) implements
the same tiny interface and returns a plain pandas DataFrame. From that
point on, the DataFrame goes through the exact same
`data_processing.ingest_dataframe()` path that a CSV/Excel upload uses --
no analytics engine (EDA, RCA, ML, what-if, forecasting, copilot) needs
to know or care where the data came from.

Design constraints that every connector implementation follows:
  - No connector ever accepts or executes arbitrary user-supplied SQL.
    Database connectors only support "pick a table from a whitelisted
    list", never a free-text query box.
  - No connector logs or returns credentials in any response.
  - Every network-touching connector enforces an explicit timeout.
  - Table/column identifiers used to build SQL are validated against a
    strict allow-list pattern before ever touching a query string --
    values are always sent as bind parameters, never interpolated.
"""
from __future__ import annotations

import re
from abc import ABC, abstractmethod
from typing import Any

import pandas as pd

# Connection/read timeout applied to every connector, in seconds. Kept
# short and non-configurable-by-the-caller so a slow/unreachable external
# system can't tie up a request indefinitely.
DEFAULT_TIMEOUT_SECONDS = 10

# Safe SQL identifier: letters, digits, underscore, must not start with a
# digit. Used to validate table/schema names before they're interpolated
# into a query (DBAPI parameter binding can't parameterize identifiers,
# only values, so a strict allow-list is the correct defense here).
_SAFE_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class ConnectorError(ValueError):
    """User-facing connector failure (bad config, connection failure,
    invalid resource, timeout, malformed response, etc.). Messages on
    this exception are safe to show to the end user -- they must never
    contain credentials."""


def validate_sql_identifier(name: str, kind: str = "identifier") -> str:
    """Raise ConnectorError unless `name` is a safe, whitelisted SQL
    identifier. Returns the name unchanged so this can be used inline."""
    if not isinstance(name, str) or not _SAFE_IDENTIFIER_RE.match(name):
        raise ConnectorError(
            f"Invalid {kind} '{name}'. Only letters, digits, and "
            "underscores are allowed, and it must not start with a digit."
        )
    return name


class BaseConnector(ABC):
    """Interface every connector implements.

    config: connector-specific connection details (host, url, etc.) --
    this dict may contain credentials and must never be logged, stored,
    or echoed back in a response as-is.
    """

    def __init__(self, config: dict[str, Any]):
        self.config = config or {}

    @abstractmethod
    def test_connection(self) -> dict:
        """Attempt to connect/reach the source. Returns a small dict
        describing success, e.g. {"success": True, "message": "..."}.
        Must never raise for a normal "can't connect" case -- callers
        rely on ConnectorError for that; this method itself may raise
        ConnectorError, which the API layer turns into a clean 400."""
        raise NotImplementedError

    @abstractmethod
    def list_resources(self) -> list[str]:
        """Return the list of importable resource names (table names,
        sheet names, etc.). Never includes credentials."""
        raise NotImplementedError

    @abstractmethod
    def fetch_dataframe(self, resource: str, limit: int | None = None) -> pd.DataFrame:
        """Fetch `resource` (already validated against list_resources by
        the caller) as a pandas DataFrame, optionally capped at `limit`
        rows."""
        raise NotImplementedError
