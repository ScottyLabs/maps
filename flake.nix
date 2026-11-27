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
      systems = [ "x86_64-linux" ];

      perSystem = {
        scottylabs.project.name = "maps";
      };
    };
}
