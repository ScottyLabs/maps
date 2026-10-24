{ inputs, lib, ricochet, ... }:
{
  imports = [ inputs.scottylabs.devenvModules.default ];

  scottylabs = {
    enable = true;
    project.name = "maps";

    garage.enable = false;

    ricochet = {
      enable = true;
      appUrl = "http://localhost";
    };

    claude.enable = false;
    conventionalCommits.enable = false;
    secrets.enable = false;
    security.osvScanner.enable = false;
    security.semgrep.enable = false;
    kennel.previewDeployments = false;
  };

  # Use Kennel's pinned relay package, listening on the Docker interface.
  # Compose publishes it only on the host's loopback address.
  processes.ricochet.exec = lib.mkForce
    "RICOCHET_DEV=1 RICOCHET_BIND=0.0.0.0:8090 ${ricochet}/bin/ricochet";

  # Enable only the services needed for local development.
  treefmt.enable = lib.mkForce false;
  git-hooks.enable = lib.mkForce false;
  cachix = {
    enable = false;
    pull = lib.mkForce [ ];
    push = lib.mkForce null;
  };
}
