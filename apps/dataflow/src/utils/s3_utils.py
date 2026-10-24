"""S3 utility functions for uploading and downloading files."""

import json
import os
from typing import Any

from clients import get_s3_client_singleton

# Scrapers/serializers use exactly the same temporary bucket as population.
s3 = get_s3_client_singleton()
client = s3.client
bucket_name = s3.bucket_name


def upload_json_file(local_file_path: str, s3_object_name: str) -> bool:
    """Upload a JSON file to S3 bucket."""
    try:
        # Upload the file
        client.fput_object(
            bucket_name,
            s3_object_name,
            local_file_path,
            content_type="application/json",
        )
        print(f"Successfully uploaded {local_file_path} as {s3_object_name}")  # noqa: T201
        return True  # noqa: TRY300
    except Exception as e:  # noqa: BLE001
        print(f"Error uploading {local_file_path}: {e}")  # noqa: T201
        return False


def upload_folder(
    local_folder_path: str,
    s3_folder_name: str,
    file_type: str = "octet-stream",
) -> bool:
    """Upload a folder to S3 bucket.

    Args:
        local_folder_path (str): The local object name/path
        s3_folder_name (str): The S3 object name/path
        file_type (str): the file type

    """
    try:
        # Upload each of the files in the folder
        for filename in os.listdir(local_folder_path):  # noqa: PTH208
            local_path = os.path.join(local_folder_path, filename)  # noqa: PTH118
            if os.path.isdir(local_path):  # noqa: PTH112
                continue
            s3_object_name = f"{s3_folder_name}/{filename}"
            client.fput_object(
                bucket_name,
                s3_object_name,
                local_path,
                content_type=f"application/{file_type}",
            )
        print(f"Successfully uploaded {local_folder_path} as {s3_folder_name}")  # noqa: T201
        return True  # noqa: TRY300
    except Exception as e:  # noqa: BLE001
        print(f"Error uploading {local_folder_path}: {e}")  # noqa: T201
        return False


def upload_generic_file(
    local_file_path: str,
    s3_object_name: str,
    file_type: str = "octet-stream",
) -> bool:
    """Upload a generic file to S3 bucket.

    Args:
        local_file_path (str): The local object name/path
        s3_object_name (str): The S3 object name/path
        file_type (str): the file type

    """
    try:
        # Upload the file
        client.fput_object(
            bucket_name,
            s3_object_name,
            local_file_path,
            content_type=f"application/{file_type}",
        )
        print(f"Successfully uploaded {local_file_path} as {s3_object_name}")  # noqa: T201
        return True  # noqa: TRY300
    except Exception as e:  # noqa: BLE001
        print(f"Error uploading {local_file_path}: {e}")  # noqa: T201
        return False


def save_upload_json_file(  # noqa: PLR0913
    s3_object_name: str,
    json_data: dict[str, Any] | list[Any],
    local_file_path: str | None = None,
    indent: int = 2,
    ensure_ascii: bool = False,  # noqa: FBT001, FBT002
    cleanup_local: bool = False,  # noqa: FBT001, FBT002
) -> bool:
    """Save JSON data to a local file and upload it to S3 bucket.

    Args:
        s3_object_name (str): The object name/path in S3 bucket
        json_data (dict | list): The JSON data to save and upload
        local_file_path (str, optional): Local file path. If None, uses s3_object_name
        indent (int): Number of spaces for JSON indentation (default: 2)
        ensure_ascii (bool): If True, escape non-ASCII characters (default: False)
        cleanup_local (bool): If True, delete local file after upload (default: False)

    Returns:
        bool: True if successful, False otherwise

    """
    # Use s3_object_name as local path if not specified
    local_path = local_file_path if local_file_path else s3_object_name

    try:
        # Save JSON data to local file with proper formatting
        with open(local_path, "w", encoding="utf-8") as f:  # noqa: PTH123
            json.dump(json_data, f, indent=indent, ensure_ascii=ensure_ascii)
        print(f"Successfully saved JSON data to {local_path}")  # noqa: T201

    except OSError as e:
        print(f"Error saving file {local_path}: {e}")  # noqa: T201
        return False
    except (TypeError, ValueError) as e:
        print(f"Error serializing JSON data: {e}")  # noqa: T201
        return False

    try:
        # Upload the file to S3
        success = upload_json_file(local_path, s3_object_name)

        if success and cleanup_local and local_path != s3_object_name:
            # Clean up local file if requested and it's not the same as S3 name
            try:
                os.remove(local_path)  # noqa: PTH107
                print(f"Cleaned up local file {local_path}")  # noqa: T201
            except OSError as e:
                print(f"Warning: Could not delete local file {local_path}: {e}")  # noqa: T201

        return success  # noqa: TRY300

    except Exception as e:  # noqa: BLE001
        print(f"Error uploading {local_path} to S3: {e}")  # noqa: T201
        return False


def list_bucket_objects() -> None:
    """List all objects in the bucket."""
    try:
        objects = client.list_objects(bucket_name, recursive=True)
        print(f"\nObjects in bucket '{bucket_name}':")  # noqa: T201
        for obj in objects:
            print(f"  - {obj.object_name} ({obj.size} bytes)")  # noqa: T201
    except Exception as e:  # noqa: BLE001
        print(f"Error listing objects: {e}")  # noqa: T201


def download_json_file(s3_object_name: str, local_file_path: str) -> bool:
    """Download a JSON file from S3 bucket."""
    try:
        # Download the file
        client.fget_object(bucket_name, s3_object_name, local_file_path)
        print(f"Successfully downloaded {s3_object_name} to {local_file_path}")  # noqa: T201
        return True  # noqa: TRY300
    except Exception as e:  # noqa: BLE001
        print(f"Error downloading {s3_object_name}: {e}")  # noqa: T201
        return False


def get_json_from_s3(
    s3_object_name: str,
    return_data: bool = False,  # noqa: FBT001, FBT002
) -> dict[str, Any] | list[Any] | Any | None:  # noqa: ANN401
    """Get JSON data from S3 bucket.

    Args:
        s3_object_name (str): The S3 object name/path
        return_data (bool): If True, return the JSON data as Python object
                            If False, return the raw response object

    Returns:
        dict/list: JSON data if return_data=True, otherwise response object

    """
    try:
        # Get the object
        response = client.get_object(bucket_name, s3_object_name)

        if return_data:
            # Read and parse JSON data
            json_data = json.loads(response.read().decode("utf-8"))
            response.close()
            print(f"Successfully retrieved JSON data from {s3_object_name}")  # noqa: T201
            return json_data
        print(f"Successfully retrieved object {s3_object_name}")  # noqa: T201
        return response  # noqa: TRY300

    except Exception as e:  # noqa: BLE001
        print(f"Error getting {s3_object_name}: {e}")  # noqa: T201
        return None


def get_generic_file_from_s3(s3_object_name: str) -> Any | None:  # noqa: ANN401
    """Get generic data from S3 bucket.

    Args:
        s3_object_name (str): The S3 object name/path
        return_data (bool): If True, return the data as Python object
                            If False, return the raw response object

    Returns:
        response object

    """
    try:
        # Get the object
        response = client.get_object(bucket_name, s3_object_name)
        print(f"Successfully retrieved object {s3_object_name}")  # noqa: T201
        return response  # noqa: TRY300

    except Exception as e:  # noqa: BLE001
        print(f"Error getting {s3_object_name}: {e}")  # noqa: T201
        return None


def list_json_files() -> list[dict[str, Any]]:
    """List all JSON files in the bucket."""
    try:
        objects = client.list_objects(bucket_name, recursive=True)
        json_files = []

        for obj in objects:
            if obj.object_name.endswith(".json"):
                json_files.append(  # noqa: PERF401
                    {
                        "name": obj.object_name,
                        "size": obj.size,
                        "last_modified": obj.last_modified,
                    },
                )

        print(f"\nJSON files in bucket '{bucket_name}':")  # noqa: T201
        for file_info in json_files:
            print(f"  - {file_info['name']} ({file_info['size']} bytes)")  # noqa: T201

        return json_files  # noqa: TRY300

    except Exception as e:  # noqa: BLE001
        print(f"Error listing JSON files: {e}")  # noqa: T201
        return []
