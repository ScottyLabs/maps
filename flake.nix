{
  description = "CMU Maps";

  nixConfig = {
    extra-substituters = [ "https://scottylabs.cachix.org" ];
    extra-trusted-public-keys = [
      "scottylabs.cachix.org-1:hajjEX5SLi/Y7yYloiXTt2IOr3towcTGRhMh1vu6Tjg="
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
        { pkgs, ... }:
        let
          web = pkgs.callPackage ./nix/web.nix { };
        in
        {
          scottylabs = {
            project.name = "maps";
            # Each pull request gets maps-pr-<number>.scottylabs.net
            previewDeployments = true;
          };

          sites.web = {
            package = web;
            spa = true;
          };

          packages.web = web;
        };
    };
}
