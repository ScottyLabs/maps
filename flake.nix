{
  description = "CMU Maps";

  nixConfig = {
    extra-substituters = [ "https://scottylabs.cachix.org" ];
    extra-trusted-public-keys = [
      "scottylabs.cachix.org-1:hajjEX5SLi/Y7yYloiXTt2IOr3towcTGRhMh1vu6Tjg="
    ];
  };

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    scottylabs = {
      url = "git+https://codeberg.org/ScottyLabs/kennel";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      scottylabs,
      ...
    }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          helpers = scottylabs.mkLib pkgs;

          web = helpers.buildDenoTask {
            src = ./.;
            cwd = "apps/web";
            pname = "cmumaps-web";
            version = "0.1.0";
          };

          visualizer = helpers.buildDenoTask {
            src = ./.;
            cwd = "apps/visualizer";
            pname = "cmumaps-visualizer";
            version = "0.1.0";
          };

          server =
            (helpers.buildDenoTask {
              src = ./.;
              cwd = "apps/server";
              pname = "cmumaps-server";
              entrypoint = "src/index.ts";
              compile = true;
            }).overrideAttrs
              (old: {
                nativeBuildInputs = (old.nativeBuildInputs or [ ]) ++ [ pkgs.makeWrapper ];
                postInstall = ''
                  wrapProgram $out/bin/cmumaps-server \
                    --set STATIC_DIR ${web} \
                    --set VISUALIZER_DIR ${visualizer}
                '';
              });
        in
        {
          inherit server web visualizer;
        }
      );
    };
}
