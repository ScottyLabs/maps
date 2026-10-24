"""Download all floorplan SVG files from S3 to verify uploads."""

from pathlib import Path

from utils.s3_utils import bucket_name, client

# S3 source path
S3_SOURCE = "floorplan_svg/"
# Local destination folder
LOCAL_DESTINATION = Path("floorplan_svg_downloaded")


def download_all_svg_files() -> None:
    """Download all SVG files from S3 floorplan_svg folder."""
    success_count = 0
    fail_count = 0

    # Create local destination folder if it doesn't exist
    LOCAL_DESTINATION.mkdir(parents=True, exist_ok=True)

    # List all objects in the floorplan_svg folder
    objects = client.list_objects(bucket_name, prefix=S3_SOURCE, recursive=True)

    for obj in objects:
        # Skip if not an SVG file
        if not obj.object_name.endswith(".svg"):
            continue

        # Extract relative path
        relative_path = obj.object_name[len(S3_SOURCE) :]
        local_file_path = LOCAL_DESTINATION / relative_path

        # Create building subfolder if needed
        local_file_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            client.fget_object(bucket_name, obj.object_name, str(local_file_path))
            print(f"Downloaded: {obj.object_name}")  # noqa: T201
            success_count += 1
        except Exception as e:  # noqa: BLE001
            print(f"Failed to download {obj.object_name}: {e}")  # noqa: T201
            fail_count += 1

    print(f"\nDownload complete: {success_count} succeeded, {fail_count} failed")  # noqa: T201
    print(f"Files saved to: {LOCAL_DESTINATION}/")  # noqa: T201


if __name__ == "__main__":
    download_all_svg_files()
