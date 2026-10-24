{
  inputs,
  lib,
  pkgs,
  ...
}:
{
  imports = [ inputs.scottylabs.devenvModules.default ];

  scottylabs = {
    enable = true;
    project.name = "maps";

    garage.enable = false;
    postgres = {
      enable = true;
      extensions = _: [ ];
    };

    ricochet = {
      enable = true;
      appUrl = "http://localhost:8080";
    };

    claude.enable = false;
    conventionalCommits.enable = false;
    secrets.enable = false;
    security.osvScanner.enable = false;
    security.semgrep.enable = false;
    kennel.previewDeployments = false;
  };

  packages = [
    pkgs.bashInteractive
    pkgs.bun
    pkgs.nodejs_22
    pkgs.python312
    pkgs.uv
    pkgs.curl
    pkgs.editorconfig-checker
  ];

  # Prisma's downloaded Linux engine needs the matching native shared libraries.
  env = lib.optionalAttrs pkgs.stdenv.isLinux {
    LD_LIBRARY_PATH = lib.makeLibraryPath [
      pkgs.openssl
      pkgs.stdenv.cc.cc.lib
      pkgs.zlib
    ];
  };

  # Kennel supplies a private PostgreSQL socket and the loopback OAuth relay.
  # app.sh waits for both before generating code and applying the local schema.
  processes.app.exec = "bash scripts/dev/app.sh";

  # Enable only the services needed for local development.
  treefmt.enable = lib.mkForce false;
  git-hooks.enable = lib.mkForce false;
  cachix = {
    enable = false;
    pull = lib.mkForce [ ];
    push = lib.mkForce null;
  };
}
