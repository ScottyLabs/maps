"""Host launcher contract tests; no Docker daemon or real credentials required."""

import contextlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "dev", Path(__file__).parents[1] / "dev.py"
)
dev = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dev)


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="maps test ")
        self.root = Path(self.temporary.name).resolve()
        for app in ("server", "web", "dataflow"):
            (self.root / "apps" / app).mkdir(parents=True)
        self.root_patch = patch.object(dev, "ROOT", self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.addCleanup(self.temporary.cleanup)
        self.values = {name: "example-" + name.lower() for name in dev.SECRET_NAMES}
        self.storage = {
            "S3_ENDPOINT": "https://t3.storageapi.dev",
            "S3_REGION": "auto",
            "S3_BUCKET": "categorized-lockerbox-v9qy6t",
            "S3_ACCESS_KEY": "test-key",
            "S3_SECRET_KEY": "test-secret",
        }
        self.values["KEYCLOAK_URL"] = "https://idp.example.test/"
        self.values["OAUTH_RELAY_URL"] = "http://localhost:8090/oauth2/callback"

    def mock_bao(self, args, **kwargs):
        if args[1:3] == ["token", "lookup"]:
            return subprocess.CompletedProcess(args, 0)
        name = args[-1].split("/")[-1]
        data = (
            self.storage if name == dev.STORAGE_RECORD else {"value": self.values[name]}
        )
        return subprocess.CompletedProcess(
            args, 0, dev.json.dumps({"data": {"data": data}})
        )

    def test_secret_mapping_and_frontend_separation(self):
        envs = dev.secret_environments(self.values, self.storage)
        self.assertIn('AUTH_CLIENT_SECRET="example-oidc_client_secret"', envs["server"])
        self.assertIn(
            'AUTH_ISSUER="https://idp.example.test/realms/example-keycloak_realm"',
            envs["server"],
        )
        self.assertNotIn("AUTH_CLIENT", envs["web"])
        self.assertNotIn("example-oidc_client_secret", envs["web"])
        self.assertEqual(len(envs["web"].splitlines()), 2)
        self.assertIn('S3_REGION="auto"', envs["dataflow"])
        self.assertNotIn(self.storage["S3_SECRET_KEY"], envs["web"])
        self.assertNotIn("SERVER_PORT=", envs["server"])

    def test_refresh_creates_both_env_variants_without_logging_secrets(self):
        output = io.StringIO()
        with (
            patch.object(dev, "require_tool"),
            patch.object(dev, "run", side_effect=self.mock_bao),
            contextlib.redirect_stdout(output),
        ):
            dev.pull_secrets()
        self.assertNotIn(self.values["OIDC_CLIENT_SECRET"], output.getvalue())
        for app in ("server", "web", "dataflow"):
            path = self.root / "apps" / app / ".env"
            self.assertEqual(
                path.read_bytes(), path.with_name(".env.local").read_bytes()
            )
            self.assertNotIn(b"\r", path.read_bytes())
            if os.name != "nt":
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_failed_last_secret_preserves_all_existing_files(self):
        for app in ("server", "web", "dataflow"):
            for name in (".env", ".env.local"):
                (self.root / "apps" / app / name).write_text("old\n")
        self.values["OAUTH_RELAY_URL"] = None
        with (
            patch.object(dev, "require_tool"),
            patch.object(dev, "run", side_effect=self.mock_bao),
        ):
            with self.assertRaisesRegex(
                RuntimeError, "Existing env files were not changed"
            ):
                dev.pull_secrets()
        for path in self.root.glob("apps/*/.env*"):
            self.assertEqual(path.read_text(), "old\n")

    def test_unsafe_values_rejected_before_writes(self):
        for value in ("bad\nINJECT=yes", 'bad"quote', "bad\\slash", "bad${EXPAND}"):
            self.values["OIDC_CLIENT_SECRET"] = value
            with (
                patch.object(dev, "require_tool"),
                patch.object(dev, "run", side_effect=self.mock_bao),
            ):
                with self.assertRaises(RuntimeError):
                    dev.pull_secrets()
            self.assertFalse(list(self.root.glob("apps/*/.env*")))

    def test_linux_engine_uses_selected_context_without_switching(self):
        with (
            patch.object(dev, "require_tool"),
            patch.object(
                dev, "run", return_value=subprocess.CompletedProcess([], 0, "linux\n")
            ) as run,
        ):
            dev.docker_ready()
        self.assertEqual(
            run.call_args_list[-1].args[0],
            ["docker", "info", "--format", "{{.OSType}}"],
        )
        self.assertFalse(any("context" in call.args[0] for call in run.call_args_list))

    def test_windows_container_engine_is_rejected(self):
        with (
            patch.object(dev, "require_tool"),
            patch.object(
                dev, "run", return_value=subprocess.CompletedProcess([], 0, "windows\n")
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "Linux containers"):
                dev.docker_ready()

    def test_engine_failure_gives_desktop_and_colima_help(self):
        with (
            patch.object(dev, "require_tool"),
            patch.object(
                dev, "run", side_effect=subprocess.CalledProcessError(1, ["docker"])
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "Colima"):
                dev.docker_ready()

    def test_no_shell_and_space_containing_path(self):
        with patch.object(dev.subprocess, "run") as run:
            dev.run(["docker", "compose", "-f", str(self.root / "compose.yml")])
        args, kwargs = run.call_args
        self.assertIsInstance(args[0], list)
        self.assertEqual(args[0][-1], str(self.root / "compose.yml"))
        self.assertEqual(kwargs["cwd"], self.root)
        self.assertNotIn("shell", kwargs)

    def test_populate_flags_are_forwarded(self):
        with (
            patch.object(dev, "docker_ready"),
            patch.object(dev, "execute_helper") as execute,
        ):
            self.assertEqual(dev.main(["populate", "--check", "--include-pois"]), 0)
        execute.assert_called_once_with("populate.sh", ["--check", "--include-pois"])

    def test_failed_storage_fetch_preserves_existing_credentials(self):
        path = self.root / "apps/dataflow/.env"
        path.write_text('S3_ACCESS_KEY="existing"\n')
        before = path.read_bytes()
        del self.storage["S3_SECRET_KEY"]
        with (
            patch.object(dev, "require_tool"),
            patch.object(dev, "run", side_effect=self.mock_bao),
        ):
            with self.assertRaisesRegex(RuntimeError, "TEMP_DEV_S3"):
                dev.pull_secrets()
        self.assertEqual(path.read_bytes(), before)
        self.assertFalse((self.root / "apps/server/.env").exists())

    def test_readiness_timeout_is_bounded(self):
        with (
            patch.object(dev.time, "monotonic", side_effect=[0, 0, 601]),
            patch.object(dev.time, "sleep"),
            patch.object(
                dev, "run", side_effect=subprocess.TimeoutExpired("docker", 10)
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "logs"):
                dev.wait_services()


if __name__ == "__main__":
    unittest.main()
