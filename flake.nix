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
          web = pkgs.callPackage ./nix/web.nix {
            # PostHog project key (phc_...); empty keeps analytics off
            posthogKey = "";
          };
        in
        {
          scottylabs = {
            project.name = "maps";
            # Each pull request gets maps-web-pr-<number>.scottylabs.net
            previewDeployments = true;
            # devenv.nix turns formatting hooks off for this repo; existing
            # docs and code are not formatted to them or ASCII-only
            hooksCheck.skip = [
              "treefmt"
              "block-ai-slop"
            ];
          };

          sites.web = {
            package = web;
            spa = true;
          };

          packages.web = web;
        };
    };
}
