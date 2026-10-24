import json
from functools import lru_cache
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlsplit

from dotenv import dotenv_values
from minio import Minio
from pydantic import BaseModel, ValidationError

from logger import get_app_logger
from models import Buildings, Floorplans, Graph, Placements

# Mapping of S3 object name patterns to their Pydantic validator models
SCHEMA_VALIDATORS: dict[str, type[BaseModel]] = {
    "buildings.json": Buildings,
    "floorplans.json": Floorplans,
    "placements.json": Placements,
    "all-graph.json": Graph,
}


class S3Client:
    def __init__(self) -> None:
        """Initialize the S3 client.

        Sets up configuration for interacting with the configured bucket.
        """
        self.logger = get_app_logger()

        credentials_file = Path(__file__).resolve().parents[2] / ".env"
        credentials = dotenv_values(credentials_file)
        required = (
            "S3_ENDPOINT",
            "S3_REGION",
            "S3_BUCKET",
            "S3_ACCESS_KEY",
            "S3_SECRET_KEY",
        )
        if any(not credentials.get(name) for name in required):
            msg = (
                f"Missing temporary S3 settings in {credentials_file}; "
                "run python3 scripts/dev/dev.py secrets to fetch TEMP_DEV_S3"
            )
            raise ValueError(msg)
        self.access_key = credentials.get("S3_ACCESS_KEY")
        self.secret_key = credentials.get("S3_SECRET_KEY")
        self.s3_endpoint = str(credentials["S3_ENDPOINT"])
        endpoint = urlsplit(self.s3_endpoint)
        if (
            endpoint.scheme != "https"
            or not endpoint.hostname
            or endpoint.path not in {"", "/"}
            or endpoint.username
            or endpoint.password
            or endpoint.query
            or endpoint.fragment
        ):
            msg = "TEMP_DEV_S3 requires an HTTPS S3 origin without embedded credentials"
            raise ValueError(msg)
        self.bucket_name = str(credentials["S3_BUCKET"])
        self._json_cache: dict[str, dict[str, Any]] = {}
        self.client = Minio(
            endpoint.netloc,
            secure=True,
            region=str(credentials["S3_REGION"]),
            access_key=self.access_key,
            secret_key=self.secret_key,
        )

    def _get_validator(self, s3_object_name: str) -> type[BaseModel] | None:
        """Get the Pydantic validator model for a given S3 object name."""
        basename = Path(s3_object_name).name
        return SCHEMA_VALIDATORS.get(basename)

    def _validate_json_data(
        self,
        json_data: dict[str, Any],
        validator: type[BaseModel],
    ) -> bool:
        """Validate JSON data against a Pydantic model. Returns True if valid."""
        try:
            validator.model_validate(json_data)
        except ValidationError:
            self.logger.exception("Validation failed")
            return False
        else:
            return True

    def upload_json_file(self, local_file_path: str, s3_object_name: str) -> bool:
        """Upload a JSON file to S3 bucket. Return if the upload was successful.

        Validates the JSON data against the appropriate Pydantic model before uploading.
        """
        validator = self._get_validator(s3_object_name)

        if validator:
            try:
                with Path(local_file_path).open(encoding="utf-8") as f:
                    json_data = json.load(f)
            except Exception:
                self.logger.exception(
                    "Error loading JSON file %s",
                    local_file_path,
                )
                return False

            if not self._validate_json_data(json_data, validator):
                self.logger.error(
                    "Validation failed for %s, not uploading",
                    local_file_path,
                )
                return False

        try:
            self.client.fput_object(
                self.bucket_name,
                s3_object_name,
                local_file_path,
                content_type="application/json",
            )
        except Exception:
            self.logger.exception(
                "Error uploading %s to %s",
                local_file_path,
                s3_object_name,
            )
            return False

        return True

    def preload_json_file(self, s3_object_name: str) -> dict[str, Any]:
        """Validate and cache an input so imports use the preflight snapshot."""
        data = self.get_json_file(s3_object_name)
        if not isinstance(data, dict) or not data:
            msg = f"Missing, empty, or invalid dataset: {s3_object_name}"
            raise ValueError(msg)
        validator = self._get_validator(s3_object_name)
        if validator:
            validator.model_validate(data)
        self._json_cache[s3_object_name] = data
        return data

    def get_json_file(self, s3_object_name: str) -> dict[str, Any] | None:
        """Get JSON data from S3 bucket."""
        if s3_object_name in self._json_cache:
            return self._json_cache[s3_object_name]
        try:
            # Get the object
            response = self.client.get_object(self.bucket_name, s3_object_name)

            # Read and parse JSON data
            try:
                json_data = json.loads(response.read().decode("utf-8"))
            finally:
                response.close()
                response.release_conn()

        except Exception:
            self.logger.exception(
                "Error getting %s from %s",
                s3_object_name,
                self.bucket_name,
            )
            return None

        return cast("dict[str, Any]", json_data)


@lru_cache(maxsize=1)
def get_s3_client_singleton() -> S3Client:
    return S3Client()


if __name__ == "__main__":
    s3_client = S3Client()
    json_data = s3_client.get_json_file("floorplans/buildings.json")
