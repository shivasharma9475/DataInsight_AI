"""
Google Sheets connector -- public/link-shared sheets ONLY.

LIMITATION (intentional, documented): this connector does not implement
Google OAuth. It only works for a spreadsheet that's shared as "Anyone
with the link can view", by fetching Google's public CSV-export endpoint
for a single sheet/tab (gid). Private spreadsheets requiring a signed-in
Google account are out of scope for this phase -- that would need a full
OAuth consent flow and token storage, which is a much larger feature.

Given a normal Google Sheets share URL like:
  https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit#gid=<GID>
this connector derives the CSV export URL:
  https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=<GID>
and reuses the same fetch/parse path as a normal CSV.
"""
from __future__ import annotations

import re
from io import StringIO
from typing import Any

import pandas as pd
import requests

from .base import BaseConnector, ConnectorError, DEFAULT_TIMEOUT_SECONDS

_SHEET_ID_RE = re.compile(r"/spreadsheets/d/([a-zA-Z0-9-_]+)")
_GID_RE = re.compile(r"[?#&]gid=(\d+)")
_MAX_RESPONSE_BYTES = 25 * 1024 * 1024


class GoogleSheetsConnector(BaseConnector):
    """
    config:
      url: str -- a Google Sheets share URL, or a sheet ID directly
      gid: str | int (optional) -- specific tab; defaults to the first tab (gid=0)
    """

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        cfg = config or {}
        raw_url = cfg.get("url") or ""

        if not isinstance(raw_url, str) or not raw_url:
            raise ConnectorError("A Google Sheets URL is required.")

        sheet_id_match = _SHEET_ID_RE.search(raw_url)
        if sheet_id_match:
            self.sheet_id = sheet_id_match.group(1)
        elif re.fullmatch(r"[a-zA-Z0-9-_]+", raw_url):
            # Caller passed the bare sheet ID rather than a full URL.
            self.sheet_id = raw_url
        else:
            raise ConnectorError(
                "Could not find a Google Sheets ID in the provided URL. "
                "Expected something like "
                "https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit"
            )

        gid_match = _GID_RE.search(raw_url)
        self.gid = str(cfg.get("gid") or (gid_match.group(1) if gid_match else 0))

    @property
    def _export_url(self) -> str:
        return (
            f"https://docs.google.com/spreadsheets/d/{self.sheet_id}"
            f"/export?format=csv&gid={self.gid}"
        )

    def _fetch_csv_text(self) -> str:
        try:
            response = requests.get(self._export_url, timeout=DEFAULT_TIMEOUT_SECONDS, stream=True)
        except requests.exceptions.Timeout as exc:
            raise ConnectorError(
                f"Connection to Google Sheets timed out after {DEFAULT_TIMEOUT_SECONDS}s."
            ) from exc
        except requests.exceptions.RequestException as exc:
            raise ConnectorError(f"Could not reach Google Sheets: {exc}") from exc

        if response.status_code == 404:
            raise ConnectorError(
                "Google Sheet not found. Make sure the link is correct."
            )
        if response.status_code in (401, 403):
            raise ConnectorError(
                "This Google Sheet is not publicly accessible. Share it as "
                "'Anyone with the link can view' and try again -- "
                "private sheets requiring sign-in aren't supported yet."
            )
        if response.status_code >= 400:
            raise ConnectorError(f"Google Sheets returned HTTP {response.status_code}.")

        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > _MAX_RESPONSE_BYTES:
            raise ConnectorError("Sheet is too large to import (over 25 MB).")

        text = response.text
        # A private/nonexistent sheet often still returns HTTP 200 with an
        # HTML sign-in page instead of CSV -- detect and reject that.
        if text.lstrip().lower().startswith(("<!doctype html", "<html")):
            raise ConnectorError(
                "This Google Sheet is not publicly accessible. Share it as "
                "'Anyone with the link can view' and try again."
            )

        return text

    def test_connection(self) -> dict:
        text = self._fetch_csv_text()
        if not text.strip():
            raise ConnectorError("Google Sheet appears to be empty.")
        return {"success": True, "message": "Sheet is publicly readable."}

    def list_resources(self) -> list[str]:
        # Without OAuth we can't enumerate tab names via the Sheets API;
        # the caller selects a tab via `gid` in the config instead.
        return [f"gid:{self.gid}"]

    def fetch_dataframe(self, resource: str, limit: int | None = None) -> pd.DataFrame:
        text = self._fetch_csv_text()
        try:
            df = pd.read_csv(StringIO(text))
        except Exception as exc:
            raise ConnectorError(f"Could not parse the sheet as CSV: {exc}") from exc

        if df.empty:
            raise ConnectorError("Google Sheet is empty.")

        if limit:
            df = df.head(limit)

        return df
