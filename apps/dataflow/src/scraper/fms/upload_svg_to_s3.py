"""Upload all floorplan SVG files to S3."""

import argparse
from pathlib import Path

from utils.s3_utils import bucket_name, client

# Path to local floorplan_svg folder
LOCAL_SVG_FOLDER = Path("floorplan_svg")
# S3 destination path
S3_DESTINATION = "floorplan_svg"


def upload_all_svg_files(
    local_svg_folder: Path = LOCAL_SVG_FOLDER,
    s3_destination: str = S3_DESTINATION,
) -> None:
    """Upload SVGs from a building-folder tree to an S3 prefix."""
    success_count = 0
    fail_count = 0

    if not local_svg_folder.is_dir():
        msg = f"Local SVG folder not found: {local_svg_folder}"
        raise FileNotFoundError(msg)

    # Iterate through building folders
    for building_path in local_svg_folder.iterdir():
        # Skip if not a directory
        if not building_path.is_dir():
            continue

        building = building_path.name

        # Iterate through SVG files in building folder
        for svg_file in building_path.iterdir():
            if svg_file.suffix != ".svg":
                continue

            s3_object_name = f"{s3_destination}/{building}/{svg_file.name}"

            try:
                client.fput_object(
                    bucket_name,
                    s3_object_name,
                    str(svg_file),
                    content_type="image/svg+xml",
                )
                success_count += 1
            except Exception as e:  # noqa: BLE001
                print(f"Failed to upload {svg_file}: {e}")  # noqa: T201
                fail_count += 1

    print(f"\nUpload complete: {success_count} succeeded, {fail_count} failed")  # noqa: T201


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=LOCAL_SVG_FOLDER,
        help="Building-folder SVG source (default: floorplan_svg)",
    )
    parser.add_argument(
        "--s3-prefix",
        default=S3_DESTINATION,
        help="Destination prefix (default: floorplan_svg)",
    )
    args = parser.parse_args()
    upload_all_svg_files(args.source, args.s3_prefix)
