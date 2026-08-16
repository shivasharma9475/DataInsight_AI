"""
REST API connector.

Fetches JSON from a caller-supplied URL and flattens it into a DataFrame.
Only GET requests are supported (this is a data *import* tool, not a
general HTTP client) and there's no resource-listing concept -- the URL
itself is the one resource, so `list_resources()` returns a single
placeholder entry for interface consistency with the DB connectors.
"""
from __future__ import annotations

from typing import Any

import pandas as pd
import requests

from .base import BaseConnector, ConnectorError, DEFAULT_TIMEOUT_SECONDS

_MAX_RESPONSE_BYTES = 25 * 1024 * 1024  # 25 MB guardrail


class RESTConnector(BaseConnector):
    """
    config:
      url: str (required, must be http:// or https://)
      headers: dict[str, str] (optional, e.g. {"Authorization": "Bearer ..."})
      params: dict[str, str] (optional query string params)
      json_path: str (optional, dot-path to the list of records within the
                 response, e.g. "data.items" for {"data": {"items": [...]}})
    """

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.url = (config or {}).get("url", "")
        self.headers = (config or {}).get("headers") or {}
        self.params = (config or {}).get("params") or {}
        self.json_path = (config or {}).get("json_path") or ""

        if not isinstance(self.url, str) or not self.url.startswith(("http://", "https://")):
            raise ConnectorError("A valid http:// or https:// URL is required.")
        if not isinstance(self.headers, dict):
            raise ConnectorError("headers must be a JSON object of string key/value pairs.")

    def _get(self) -> requests.Response:
        try:
            response = requests.get(
                self.url,
                headers=self.headers,
                params=self.params,
                timeout=DEFAULT_TIMEOUT_SECONDS,
                stream=True,
            )
        except requests.exceptions.Timeout as exc:
            raise ConnectorError(
                f"Connection to the REST endpoint timed out after {DEFAULT_TIMEOUT_SECONDS}s."
            ) from exc
        except requests.exceptions.ConnectionError as exc:
            raise ConnectorError("Could not connect to the REST endpoint.") from exc
        except requests.exceptions.RequestException as exc:
            raise ConnectorError(f"REST request failed: {exc}") from exc

        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > _MAX_RESPONSE_BYTES:
            raise ConnectorError("Response is too large to import (over 25 MB).")

        return response

    def test_connection(self) -> dict:
        response = self._get()
        if response.status_code >= 400:
            raise ConnectorError(
                f"REST endpoint returned HTTP {response.status_code}."
            )
        return {"success": True, "message": f"Reached endpoint (HTTP {response.status_code})."}

    def list_resources(self) -> list[str]:
        # A REST endpoint is itself the single resource to import.
        return ["response"]

    def _extract_records(self, payload: Any) -> list[dict]:
        node = payload
        if self.json_path:
            for part in self.json_path.split("."):
                if isinstance(node, dict) and part in node:
                    node = node[part]
                else:
                    raise ConnectorError(
                        f"json_path '{self.json_path}' was not found in the response."
                    )

        if isinstance(node, list):
            return node
        if isinstance(node, dict):
            return [node]

        raise ConnectorError(
            "REST response is not a JSON object/array of records. If the "
            "records are nested, set json_path (e.g. 'data.items')."
        )

    def fetch_dataframe(self, resource: str, limit: int | None = None) -> pd.DataFrame:
        response = self._get()

        if response.status_code >= 400:
            raise ConnectorError(f"REST endpoint returned HTTP {response.status_code}.")

        try:
            payload = response.json()
        except ValueError as exc:
            raise ConnectorError("REST response was not valid JSON.") from exc

        records = self._extract_records(payload)

        if not records:
            raise ConnectorError("REST endpoint returned an empty dataset.")

        try:
            df = pd.json_normalize(records)
        except Exception as exc:
            raise ConnectorError(f"Could not flatten the REST response into a table: {exc}") from exc

        if limit:
            df = df.head(limit)

        return df
