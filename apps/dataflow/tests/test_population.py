# ruff: noqa: PT009, PT027
"""Regression tests for configuration and preflight before database reset."""

import importlib
import os
import unittest
from contextlib import ExitStack
from unittest.mock import Mock, patch

from clients._api_client import ApiClient
from clients._s3_client import S3Client
from clients.dataset import HostedDataset

population = importlib.import_module("deserializer.main")


class S3ConfigurationTests(unittest.TestCase):
    """Local URLs and legacy hostnames keep their intended transport."""

    def setUp(self) -> None:
        """Use test credentials rather than reading the developer's env file."""
        patcher = patch(
            "clients._s3_client.dotenv_values",
            return_value={
                "S3_ENDPOINT": "https://t3.storageapi.dev",
                "S3_REGION": "auto",
                "S3_BUCKET": "categorized-lockerbox-v9qy6t",
                "S3_ACCESS_KEY": "temporary-test-key",
                "S3_SECRET_KEY": "temporary-test-secret",
            },
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_pinned_bucket_overrides_legacy_environment(self) -> None:
        """Ambient legacy storage settings cannot change the branch's source."""
        with (
            patch.dict(
                os.environ,
                {
                    "S3_ENDPOINT": "http://localhost:9000",
                    "S3_BUCKET": "old-bucket",
                    "S3_REGION": "us-east-1",
                    "S3_ACCESS_KEY": "stale-key",
                },
                clear=True,
            ),
            patch("clients._s3_client.Minio") as minio,
        ):
            client = S3Client()
            self.assertEqual(client.bucket_name, "categorized-lockerbox-v9qy6t")
            self.assertEqual(minio.call_args.args, ("t3.storageapi.dev",))
            self.assertTrue(minio.call_args.kwargs["secure"])
            self.assertEqual(minio.call_args.kwargs["region"], "auto")
            self.assertEqual(minio.call_args.kwargs["access_key"], "temporary-test-key")

    def test_missing_credentials_fail_without_environment_fallback(self) -> None:
        """Old CDN or shell credentials must not silently be reused."""
        with (
            patch.dict(os.environ, {"S3_ACCESS_KEY": "old", "S3_SECRET_KEY": "old"}),
            patch("clients._s3_client.dotenv_values", return_value={}),
            self.assertRaisesRegex(ValueError, "TEMP_DEV_S3"),
        ):
            S3Client()

    def test_cached_snapshot_and_response_cleanup(self) -> None:
        """Imports reuse the checked bytes instead of refetching changing objects."""
        with (
            patch.dict(os.environ, {"S3_ENDPOINT": "localhost:9000"}, clear=True),
            patch(
                "clients._s3_client.Minio",
            ) as minio,
        ):
            response = minio.return_value.get_object.return_value
            response.read.return_value = b'{"sample": {"value": 1}}'
            client = S3Client()
            data = client.preload_json_file("sample.json")
            self.assertIs(client.get_json_file("sample.json"), data)
            minio.return_value.get_object.assert_called_once()
            response.close.assert_called_once()
            response.release_conn.assert_called_once()


class PopulationTests(unittest.TestCase):
    """Failures must stop before reset, and reset failure must stop writes."""

    def setUp(self) -> None:
        """Replace clients and table population with isolated mocks."""
        self.api = Mock()
        self.api.drop_tables.return_value = True
        stack = ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(patch("sys.argv", ["populate-database", "--skip-pois"]))
        self.mocks = [
            stack.enter_context(
                patch.object(
                    population,
                    "get_api_client_singleton",
                    return_value=self.api,
                ),
            ),
            stack.enter_context(patch.object(population, "validate_sources")),
            stack.enter_context(patch.object(population, "populate_table")),
        ]
        self.storage = stack.enter_context(
            patch.object(population, "get_s3_client_singleton"),
        ).return_value

    def test_missing_or_invalid_source_prevents_reset(self) -> None:
        """Input failure prevents any backend mutation."""
        self.mocks[1].side_effect = ValueError("missing source")
        with self.assertRaises(ValueError):
            population.main()
        self.api.drop_tables.assert_not_called()
        self.mocks[2].assert_not_called()

    def test_auth_failure_prevents_reset(self) -> None:
        """An unauthorized client cannot trigger population."""
        self.api.preflight.side_effect = RuntimeError("unauthorized")
        with self.assertRaises(RuntimeError):
            population.main()
        self.api.drop_tables.assert_not_called()
        self.mocks[2].assert_not_called()

    def test_failed_reset_prevents_population(self) -> None:
        """Do not append data after the reset is rejected."""
        self.api.drop_tables.return_value = False
        with self.assertRaises(RuntimeError):
            population.main()
        self.mocks[2].assert_not_called()

    def test_check_never_resets(self) -> None:
        """Check mode authenticates but stops before writes."""
        with patch("sys.argv", ["populate-database", "--check", "--skip-pois"]):
            population.main()
        self.api.preflight.assert_called_once()
        self.api.drop_tables.assert_not_called()
        self.mocks[2].assert_not_called()

    def test_explicit_poi_skip(self) -> None:
        """The local archive can import with POIs deliberately omitted."""
        population.main()
        self.assertTrue(self.mocks[1].call_args.kwargs["skip_pois"])
        self.assertEqual(
            self.mocks[1].call_args.kwargs["source"].prefix, "datasets/new/",
        )
        self.api.drop_tables.assert_called_once_with(population.ALL_TABLE_NAMES)
        self.assertEqual(
            [call.args[0] for call in self.mocks[2].call_args_list],
            ["Building", "Floor", "Room", "Alias", "Node", "Edge"],
        )

    def test_pois_required_by_default(self) -> None:
        """The general importer continues requiring the POI source by default."""
        with patch("sys.argv", ["populate-database"]):
            population.main()
        self.assertFalse(self.mocks[1].call_args.kwargs["skip_pois"])
        self.assertEqual(self.mocks[2].call_args.args[0], "Poi")

    def test_selected_snapshot_is_shared_by_preflight_and_every_converter(self) -> None:
        """Changing the dataset must not validate old data and then import new data."""
        with patch(
            "sys.argv", ["populate-database", "--dataset", "old", "--skip-pois"],
        ):
            population.main()
        source = self.mocks[1].call_args.kwargs["source"]
        self.assertEqual(source.prefix, "datasets/old/")
        for call in self.mocks[2].call_args_list:
            self.assertIs(call.args[1].keywords["source"], source)


class HostedDatasetTests(unittest.TestCase):
    """A missing selected object must never silently mix the old and new data."""

    def test_named_snapshots_use_distinct_cached_object_keys(self) -> None:
        """Both reads and preflight retain the same explicit dataset prefix."""
        client = Mock(spec=S3Client)
        for name in ("old", "new"):
            source = HostedDataset(client, name)
            source.preload_json_file("floorplans/buildings.json")
            source.get_json_file("floorplans/all-graph.json")
            client.preload_json_file.assert_called_with(
                f"datasets/{name}/floorplans/buildings.json",
            )
            client.get_json_file.assert_called_with(
                f"datasets/{name}/floorplans/all-graph.json",
            )

    def test_missing_selected_snapshot_fails_without_fallback(self) -> None:
        """The preflight error propagates instead of trying another dataset."""
        client = Mock(spec=S3Client)
        client.preload_json_file.side_effect = ValueError("Missing dataset")
        source = HostedDataset(client, "old")
        with self.assertRaisesRegex(ValueError, "Missing dataset"):
            source.preload_json_file("floorplans/buildings.json")
        client.preload_json_file.assert_called_once_with(
            "datasets/old/floorplans/buildings.json",
        )
        client.get_json_file.assert_not_called()


class AuthorizationTests(unittest.TestCase):
    """Probe the actual protected route with an empty batch."""

    def test_preflight_uses_empty_batch(self) -> None:
        """No rows are created to test credentials and server authorization."""
        with (
            patch.dict(
                os.environ,
                {
                    "SERVER_URL": "http://localhost/",
                    "AUTH_CLIENT_ID": "test",
                    "AUTH_CLIENT_SECRET": "test",
                    "AUTH_ISSUER": "https://idp.example/realm",
                },
                clear=True,
            ),
            patch.object(ApiClient, "_get_token", return_value="test"),
            patch(
                "clients._api_client.requests.post",
            ) as post,
        ):
            post.return_value.status_code = 200
            client = ApiClient()
            client.preflight()
            self.assertEqual(
                post.call_args.args[0],
                "http://localhost/populate-table/building",
            )
            self.assertEqual(post.call_args.kwargs["json"], [])
            self.assertEqual(
                client.token_url,
                "https://idp.example/realm/protocol/openid-connect/token",
            )


class LocalTargetTests(unittest.TestCase):
    """The hosted bucket must never change the database write destination."""

    def test_local_mode_forces_backend_and_loads_only_auth(self) -> None:
        """Environment and dotenv API URLs cannot redirect a local reset."""
        with (
            patch.dict(
                os.environ,
                {"SERVER_URL": "https://remote.example.com"},
                clear=True,
            ),
            patch.object(
                population.dotenv,
                "dotenv_values",
                return_value={
                    "AUTH_CLIENT_ID": "test",
                    "AUTH_CLIENT_SECRET": "test",
                    "AUTH_ISSUER": "https://idp.example/realm",
                    "SERVER_URL": "https://remote.example.com",
                    "UNRELATED": "ignored",
                },
            ),
        ):
            population.configure_local()
            self.assertEqual(os.environ["SERVER_URL"], "http://localhost:8080")
            self.assertNotIn("UNRELATED", os.environ)
