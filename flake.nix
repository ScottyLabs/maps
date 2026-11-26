{
  description = "CMU Maps";

  nixConfig = {
    extra-substituters = [ "https://cache.scottylabs.org" ];
    extra-trusted-public-keys = [
      "deploy-01.scottylabs.org-1:TtFRYjsx76lUXkCDvobNkTFZGOeLZFKTzdKX9oyiCcY="
    ];
  };

  inputs = {
    scottylabs.url = "git+https://git.cmu.dev/ScottyLabs/kennel";
    nixpkgs.follows = "scottylabs/nixpkgs";
    flake-parts.follows = "scottylabs/flake-parts";
  };

  outputs =
    inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ inputs.scottylabs.flakeModules.default ];
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      perSystem =
        {
          lib,
          pkgs,
          helpers,
          ...
        }:
        let
          web = helpers.buildDenoTask {
            src = ./.;
            cwd = "apps/web";
            pname = "cmumaps-web";
          };

          visualizer = helpers.buildDenoTask {
            src = ./.;
            cwd = "apps/visualizer";
            pname = "cmumaps-visualizer";
          };
        in
        {
          scottylabs = {
            project.name = "maps";

            deno = {
              enable = true;
              react.enable = true;
            };
            python = {
              enable = true;
              dir = "apps/dataflow";
              package = pkgs.python312;
            };
            postgres.enable = true;

            ricochet = {
              enable = true;
              appUrl = "http://localhost:5173";
            };

            processes = {
              server = {
                run = "exec secretspec run -- deno task dev:server";
                depends = [ "postgres-setup" ];
              };
              web.run = "exec secretspec run -- deno task dev:web";
              visualizer.run = "exec secretspec run -- deno task dev:visualizer";
            };

            shell = {
              packages = [ pkgs.zensical ];
              scripts.docs = "cd docs && zensical serve";
            };
          };

          treefmt.settings.global.excludes = [
            "apps/server/src/generated/**"
            "apps/visualizer/src/routeTree.gen.ts"
            ".forgejo/ISSUE_TEMPLATE/*"
          ];

          services.server = {
            package = lib.addMetaAttrs { mainProgram = "cmumaps-server"; } (
              helpers.buildDenoTask {
                src = ./.;
                cwd = "apps/server";
                pname = "cmumaps-server";
                entrypoint = "src/index.ts";
                compile = true;
              }
            );
            customDomain = "cmumaps.com";
            env = {
              STATIC_DIR = "${web}";
              VISUALIZER_DIR = "${visualizer}";
            };
          };

          sites.docs.package = helpers.buildZensical {
            src = ./docs;
            name = "cmumaps-docs";
          };
        };
    };
}
