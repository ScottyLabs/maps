import os
from functools import lru_cache
from typing import Any, Literal

import requests

from logger import get_app_logger

type TableName = Literal[
    "Building",
    "Floor",
    "Room",
    "Alias",
    "Node",
    "Edge",
    "Poi",
]

ALL_TABLE_NAMES: list[TableName] = [
    "Building",
    "Floor",
    "Room",
    "Alias",
    "Node",
    "Edge",
    "Poi",
]


class ApiClient:
    TIMEOUT = 10
    SUCCESS_STATUS_CODE = 200

    def __init__(self) -> None:
        self.logger = get_app_logger()

        # Operator-run job: these come from apps/dataflow/.env, not secretspec.
        self.server_url = os.getenv("SERVER_URL")
        self.client_id = os.getenv("OIDC_CLIENT_ID")
        self.client_secret = os.getenv("OIDC_CLIENT_SECRET")

        keycloak_url = os.getenv("KEYCLOAK_URL", "https://idp.scottylabs.org")
        keycloak_realm = os.getenv("KEYCLOAK_REALM", "scottylabs")
        self.token_url = (
            f"{keycloak_url.rstrip('/')}/realms/{keycloak_realm}"
            "/protocol/openid-connect/token"
        )

        if not self.server_url:
            msg = "SERVER_URL must be set"
            self.logger.critical(msg)
            raise ValueError(msg)

        if not self.client_id or not self.client_secret:
            msg = "OIDC_CLIENT_ID and OIDC_CLIENT_SECRET must be set"
            self.logger.critical(msg)
            raise ValueError(msg)

        # In-memory cached token
        self._cached_token = None

    def _get_token(self) -> str:
        if self._cached_token:
            return self._cached_token

        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        response = requests.post(self.token_url, data=data, timeout=self.TIMEOUT)
        response.raise_for_status()
        token_data = response.json()

        self._cached_token = token_data.get("access_token")
        if not self._cached_token:
            msg = "Failed to get token"
            self.logger.critical(msg)
            raise RuntimeError(msg)

        return self._cached_token

    def drop_tables(self, table_names: list[TableName]) -> bool:
        """Drop specified tables."""
        response = requests.delete(
            f"{self.server_url}/api/drop-tables",
            json={"tableNames": table_names},
            headers={"Authorization": f"Bearer {self._get_token()}"},
            timeout=self.TIMEOUT,
        )
        return response.status_code == self.SUCCESS_STATUS_CODE

    def populate_table(self, table_name: TableName, data: list[dict[str, Any]]) -> bool:
        """Populate a table with the given data."""
        response = requests.post(
            f"{self.server_url}/api/populate-table/{table_name.lower()}",
            json=data,
            headers={"Authorization": f"Bearer {self._get_token()}"},
            timeout=self.TIMEOUT,
        )

        if response.status_code != self.SUCCESS_STATUS_CODE:
            msg = f"Failed to populate {table_name} table: {response.json()}"
            raise RuntimeError(msg)

        return True


@lru_cache(maxsize=1)
def get_api_client_singleton() -> ApiClient:
    return ApiClient()
