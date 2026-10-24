# Data visualizer

## Fresh-source working JSON

Start the [native stack](Setup.md), then open
[the workspace selector](http://localhost:5174/workspaces) and sign in with Keycloak.
This is part of the existing visualizer application. Source processing lives in
the same Python engine used by the CLI.

1. [Capture selected FMS floors](FMS-Capture.md#run) under
   `uploads/pipeline/<workspace-name>`. Names use letters, digits, hyphens or
   underscores. Source files and working JSON remain ignored by Git.
2. Select that workspace. The engine verifies and normalizes the capture on first
   open. Reopening reads saved working JSON and preserves edits.
3. Select a floor and space. Edit names/types, choose a source tag after checking
   it, drag polygon vertices, or move the red label marker. Yellow spaces and
   warnings identify unresolved source evidence.
4. Click **Save working JSON**. The editor saves a whole working revision
   atomically. A stale editor receives a conflict rather than overwriting a newer
   save. Reloading discards unsaved edits; ordinary saves do not populate PostgreSQL.
5. Fetch public building metadata, then choose **Place reference floor**. The
   initial position is a draft centred on the freshly fetched CMU GIS footprint.
   Use the existing map placement controls to align one floor. Click the map to
   move the drawing, adjust angle/scale, then **Save placement to JSON**.
6. Optionally choose **Fetch outdoor paths and POIs** after fetching building metadata.
   This saves the public source snapshot to the same working JSON.
7. Return to **Working drawing**, then **Build candidate**. Review the counts and
   source warnings. Unsaved edits must be saved first.
8. Choose **Load preview in app**. The backend validates the candidate, imports it
   into a separate local schema, and prepares search and routing caches before
   selecting it. The browser opens a fresh app page for that revision.

The map controls use the app's existing coordinate conversion. Normalized source
coordinates are metres with y up; the visualizer's drawing coordinates use y down.
A saved building anchor records the reference floor, physical origin, geographic
centre, angle, and scale. Do not treat merely similar SVG crops as verified floor
alignment. Unverified floors are excluded with warnings. Indoor door/connector generation remains incomplete; a preview being viewable
does not verify those routes. Public path and point POI generation is available.

The app shows its workspace/revision and preserves that context in room and route
URLs. An older page gets a reload prompt after another preview activates. Failed
loads keep the previous preview selected. Saving JSON alone leaves it unchanged.
See [preview loading](FMS-Capture.md#load-the-candidate) for CLI commands and how
to return to the preserved shared-source import.

Apple's basemap needs a valid `MAPKIT_TOKEN` in OpenBao. If it expires, the GIS
footprint and floor overlays can still render over a blank map grid. Refresh the
token and run `python3 scripts/dev/dev.py secrets`, then restart the app process.
The pipeline never embeds identity or S3 credentials in the browser.

The public metadata stage is also available without the visualizer:

```sh
devenv shell -- bash scripts/dev/pipeline.sh public --workspace uploads/pipeline/ansys-v1
```

It joins the selected FMS identifiers to the public CMU Buildings layer, discovers
its advertised layer ID, saves the source GeoJSON, and keeps the requested app
building codes. It does not need old processed building JSON. Saved metadata can
be reused offline. `--refresh-source` explicitly fetches it again and replaces
that building metadata; ordinary room corrections are retained.

The October 24, 2026 source identifies FMS building `116` as ANSYS Hall with
abbreviation `AH`. The selected workspace keeps its requested app code `AN`.
This difference is source metadata, not a reason to join buildings by guesswork.

The local API bridge is enabled by the native helper's `PIPELINE_ROOT` and uses
the same Keycloak session as the app. It restricts selection to named directories
under that root and invokes the pipeline command; it does not implement a second
extractor. Production starts without this root and cannot use the local bridge.

## Existing database editor

The original floor/map editor remains available for inspecting previously imported
data while the fresh-source workflow is being completed. Its writes target the
database and are separate from the selected source workspace. Use the workspace
editor for the agreed JSON-first pipeline. Database mutations are blocked while
a generated preview is selected; restore the baseline before using the old editor.

[Original visualizer documentation](https://wiki-scottylabs.notion.site/CMU-Maps-Data-Visualizer-Documentation-20396192554c80ac9daee627cd3f852b?pvs=74).
