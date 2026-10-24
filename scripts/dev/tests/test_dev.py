"""Native launcher contract tests; no Nix builds or real credentials required."""

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
        # Commands are exercised as a supported native host; Windows rejection
        # is checked separately while filesystem tests still use the real OS.
        platform_patch = patch.object(dev.sys, "platform", "linux")
        platform_patch.start()
        self.addCleanup(platform_patch.stop)
        self.temporary = tempfile.TemporaryDirectory(prefix="maps test ")
        self.root = Path(self.temporary.name).resolve()
        for app in ("server", "web", "visualizer", "dataflow"):
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
        self.assertIn('SERVER_PORT="8080"', envs["server"])
        self.assertIn('SERVER_URL="http://localhost:8080"', envs["server"])
        self.assertIn('VITE_SERVER_URL="http://localhost:8080"', envs["web"])
        self.assertNotIn("DATABASE_URL=", envs["server"])

    def test_refresh_creates_both_env_variants_without_logging_secrets(self):
        output = io.StringIO()
        with (
            patch.object(dev, "require_tool"),
            patch.object(dev, "run", side_effect=self.mock_bao),
            contextlib.redirect_stdout(output),
        ):
            dev.pull_secrets()
        self.assertNotIn(self.values["OIDC_CLIENT_SECRET"], output.getvalue())
        for app in ("server", "web", "visualizer", "dataflow"):
            path = self.root / "apps" / app / ".env"
            self.assertEqual(
                path.read_bytes(), path.with_name(".env.local").read_bytes()
            )
            self.assertNotIn(b"\r", path.read_bytes())
            if os.name != "nt":
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_failed_last_secret_preserves_all_existing_files(self):
        for app in ("server", "web", "visualizer", "dataflow"):
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

    def test_start_runs_devenv_up_without_a_container_engine(self):
        for app in ("server", "web"):
            (self.root / "apps" / app / ".env").write_text("configured\n")
        with (
            patch.object(dev, "require_tool"),
            patch.object(dev, "run") as run,
        ):
            self.assertEqual(dev.main(["start", "--skip-secrets"]), 0)
        run.assert_called_once_with(["devenv", "up"])

    def test_missing_devenv_explains_install_without_changing_system(self):
        with (
            patch.object(dev.shutil, "which", return_value=None),
            contextlib.redirect_stderr(io.StringIO()) as output,
        ):
            self.assertEqual(dev.main(["start", "--skip-secrets"]), 1)
        self.assertIn("Install devenv", output.getvalue())

    def test_native_windows_is_directed_to_wsl(self):
        with (
            patch.object(dev.sys, "platform", "win32"),
            contextlib.redirect_stderr(io.StringIO()) as output,
        ):
            self.assertEqual(dev.main(["start"]), 1)
        self.assertIn("WSL2", output.getvalue())

    def test_no_shell_and_space_containing_path(self):
        with patch.object(dev.subprocess, "run") as run:
            dev.run(["devenv", "shell", "--", "python3", str(self.root / "task.py")])
        args, kwargs = run.call_args
        self.assertIsInstance(args[0], list)
        self.assertEqual(args[0][-1], str(self.root / "task.py"))
        self.assertEqual(kwargs["cwd"], self.root)
        self.assertNotIn("shell", kwargs)

    def test_populate_flags_are_forwarded_to_native_shell(self):
        with (
            patch.object(dev, "require_tool"),
            patch.object(dev, "run") as run,
        ):
            self.assertEqual(
                dev.main(["populate", "--dataset", "old", "--check", "--include-pois"]), 0
            )
        run.assert_called_once_with(
            [
                "devenv",
                "shell",
                "--",
                "bash",
                "scripts/dev/populate.sh",
                "--dataset",
                "old",
                "--check",
                "--include-pois",
            ]
        )

    def test_logs_selects_named_process(self):
        with (
            patch.object(dev, "require_tool"),
            patch.object(dev, "run") as run,
        ):
            self.assertEqual(dev.main(["logs", "postgres"]), 0)
        run.assert_called_once_with(["devenv", "processes", "logs", "postgres"])

    def test_stop_preserves_database_and_delegates_lifecycle(self):
        with (
            patch.object(dev, "require_tool"),
            patch.object(dev, "run") as run,
        ):
            self.assertEqual(dev.main(["stop"]), 0)
        run.assert_called_once_with(["devenv", "processes", "down"])

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


if __name__ == "__main__":
    unittest.main()
