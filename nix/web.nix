# Static build of apps/web for kennel. Kennel builds a site once and promotes
# the same output through every environment, so per-environment values
# (the PostHog key) are read at runtime from /_kennel/env.json instead.
{
  lib,
  stdenv,
  bun,
  nodejs,
  autoPatchelfHook,
  serverUrl ? "https://api.maps.invalid",
  # Kennel releases before public values cannot serve /_kennel/env.json, so
  # a project key given here is inlined instead. It ships in every page anyway.
  posthogKey ? "",
}:

let
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../bun.lock
      ../tsconfig.json
      ../apps/server/package.json
      ../apps/visualizer/package.json
      ../apps/web
      ../packages
    ];
  };

  # bun.lock pins every package, so the installed tree is fixed; update the
  # hash whenever bun.lock changes
  nodeModules = stdenv.mkDerivation {
    pname = "maps-web-node-modules";
    version = "0";
    inherit src;

    nativeBuildInputs = [ bun ];
    dontConfigure = true;
    dontFixup = true;

    buildPhase = ''
      runHook preBuild
      export HOME=$TMPDIR
      bun install --frozen-lockfile --ignore-scripts --no-progress --filter '@cmumaps/web'
      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall
      mkdir -p $out
      find . -type d -name node_modules -prune -print0 \
        | xargs -0 -I{} cp -a --parents {} $out
      # bun links package binaries inconsistently between runs, and the
      # build calls vite's entry point directly, so drop them for a stable hash
      find $out -type d -name .bin -prune -exec rm -rf {} +
      runHook postInstall
    '';

    outputHashMode = "recursive";
    outputHashAlgo = "sha256";
    outputHash = "sha256-OknEoxKuv8c9HsciY3608332JUBzFDa7g0jUQENaNZM=";
  };
in
stdenv.mkDerivation {
  pname = "maps-web";
  version = "0";
  inherit src;

  nativeBuildInputs = [
    bun
    nodejs
    autoPatchelfHook
  ];
  # Native addons (rollup, lightningcss, tailwind oxide) link against libstdc++
  buildInputs = [ stdenv.cc.cc.lib ];

  buildPhase = ''
    runHook preBuild
    cp -a ${nodeModules}/. .
    chmod -R u+w .
    # Only the glibc builds of native addons can run here, as in kennel's deno helper
    find node_modules -type d -name '*musl*' -prune -exec rm -rf {} +
    autoPatchelf node_modules
    cd apps/web
    VITE_SERVER_URL=${serverUrl} VITE_PUBLIC_POSTHOG_KEY=${posthogKey} \
      node node_modules/vite/bin/vite.js build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    cp -r dist $out
    runHook postInstall
  '';

  dontFixup = true;

  passthru = { inherit nodeModules; };
}
