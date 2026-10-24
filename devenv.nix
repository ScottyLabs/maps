{ inputs, ... }:

{
  imports = [
    inputs.scottylabs.devenvModules.default
  ];

  scottylabs = {
    enable = true;
    project.name = "maps";

    deno = {
      enable = true;
      react.enable = true;
    };
    python.enable = true;
    postgres.enable = true;
    ricochet = {
      enable = true;
      appUrl = "http://localhost:5173";
    };

    kennel.services.server.customDomain = "cmumaps.com";
  };

  # setup-postgres copies postgresql.conf out of the nix store, so it lands
  # read-only and the next `devenv up` cannot overwrite it.
  enterShell = ''
    if [ -f "$PGDATA/postgresql.conf" ]; then
      chmod u+w "$PGDATA/postgresql.conf"
    fi
  '';
}
