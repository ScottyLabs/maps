import os
from functools import lru_cache
from typing import Any, Literal

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

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

    TOKEN_URL = (
        "https://idp.scottylabs.org/realms/scottylabs/protocol/openid-connect/token"  # noqa: S105
    )

    def __init__(self) -> None:
        self.logger = get_app_logger()

        # Load required environment-specific variables
        self.server_url = os.getenv("SERVER_URL", "").rstrip("/")
        self.auth_client_id = os.getenv("AUTH_CLIENT_ID")
        self.auth_client_secret = os.getenv("AUTH_CLIENT_SECRET")

        if not self.server_url:
            msg = "SERVER_URL must be set"
            self.logger.critical(msg)
            raise ValueError(msg)

        if not self.auth_client_id or not self.auth_client_secret:
            msg = "AUTH_CLIENT_ID and AUTH_CLIENT_SECRET must be set"
            self.logger.critical(msg)
            raise ValueError(msg)

        issuer = os.getenv("AUTH_ISSUER")
        self.token_url = (
            f"{issuer.rstrip('/')}/protocol/openid-connect/token"
            if issuer
            else self.TOKEN_URL
        )

        # In-memory cached token
        self._cached_token = None

    def _get_token(self) -> str:
        if self._cached_token:
            return self._cached_token

        data = {
            "grant_type": "client_credentials",
            "client_id": self.auth_client_id,
            "client_secret": self.auth_client_secret,
        }

        # Retry connection establishment only; never replay database writes.
        with requests.Session() as session:
            retry = Retry(total=2, connect=2, read=0, status=0, backoff_factor=0.5)
            session.mount("https://", HTTPAdapter(max_retries=retry))
            response = session.post(self.token_url, data=data, timeout=self.TIMEOUT)
            response.raise_for_status()
            token_data = response.json()

        self._cached_token = token_data.get("access_token")
        if not self._cached_token:
            msg = "Failed to get token"
            self.logger.critical(msg)
            raise RuntimeError(msg)

        return self._cached_token

    def preflight(self) -> None:
        """Check credentials, admin authorization, and backend without adding rows."""
        self.populate_table("Building", [])

    def read_preview(self, path: str, revision: str) -> Any:  # noqa: ANN401
        """Read an app API response pinned to one selected preview revision."""
        response = requests.get(
            self.server_url + path,
            headers={
                "Authorization": f"Bearer {self._get_token()}",
                "X-Maps-Revision": revision,
            },
            timeout=self.TIMEOUT,
        )
        response.raise_for_status()
        return response.json()

    def load_preview(self, workspace: str, revision: str) -> dict[str, Any]:
        """Ask the native API to stage and explicitly activate one candidate."""
        return self._preview_operation(
            {"operation": "load", "workspace": workspace, "revision": revision},
        )

    def restore_baseline(self) -> dict[str, Any]:
        """Select the preserved ordinary import without deleting any map data."""
        return self._preview_operation({"operation": "baseline"})

    def _preview_operation(self, operation: dict[str, str]) -> dict[str, Any]:
        response = requests.post(
            f"{self.server_url}/pipeline",
            json=operation,
            headers={"Authorization": f"Bearer {self._get_token()}"},
            timeout=120,
        )
        data = response.json()
        if not isinstance(data, dict):
            msg = "Invalid preview activation response"
            raise TypeError(msg)
        if response.status_code != self.SUCCESS_STATUS_CODE:
            msg = (
                data.get("message") or data.get("error") or "Preview activation failed"
            )
            raise RuntimeError(msg)
        return data

    def drop_tables(self, table_names: list[TableName]) -> bool:
        """Drop specified tables."""
        response = requests.delete(
            f"{self.server_url}/drop-tables",
            json={"tableNames": table_names},
            headers={"Authorization": f"Bearer {self._get_token()}"},
            timeout=self.TIMEOUT,
        )
        response.raise_for_status()
        return response.status_code == self.SUCCESS_STATUS_CODE

    def populate_table(self, table_name: TableName, data: list[dict[str, Any]]) -> bool:
        """Populate a table with the given data."""
        response = requests.post(
            f"{self.server_url}/populate-table/{table_name.lower()}",
            json=data,
            headers={"Authorization": f"Bearer {self._get_token()}"},
            timeout=self.TIMEOUT,
        )

        if response.status_code in {401, 403}:
            msg = (
                "Backend rejected the population service token. The Keycloak "
                "service account needs /projects/maps/admins in its groups claim. "
                "The token must be valid and issued by the configured Keycloak realm. "
                "See scripts/dev/openbao.md."
            )
            raise RuntimeError(msg)
        if response.status_code != self.SUCCESS_STATUS_CODE:
            msg = f"Failed to populate {table_name} table (HTTP {response.status_code})"
            raise RuntimeError(msg)

        return True


@lru_cache(maxsize=1)
def get_api_client_singleton() -> ApiClient:
    return ApiClient()
