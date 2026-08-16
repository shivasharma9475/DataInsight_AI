"""Connector package: common abstraction + concrete implementations."""
from .base import BaseConnector, ConnectorError
from .rest_connector import RESTConnector
from .mysql_connector import MySQLConnector
from .postgres_connector import PostgresConnector
from .google_sheets_connector import GoogleSheetsConnector

CONNECTOR_REGISTRY: dict[str, type[BaseConnector]] = {
    "rest": RESTConnector,
    "mysql": MySQLConnector,
    "postgres": PostgresConnector,
    "google_sheets": GoogleSheetsConnector,
}


def get_connector(connector_type: str, config: dict) -> BaseConnector:
    connector_cls = CONNECTOR_REGISTRY.get(connector_type)
    if connector_cls is None:
        raise ConnectorError(
            f"Unknown connector type '{connector_type}'. "
            f"Supported types: {', '.join(sorted(CONNECTOR_REGISTRY))}."
        )
    return connector_cls(config)
