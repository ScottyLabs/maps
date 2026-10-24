# Data pipeline work queue

Checkpoint: **2026-10-24 12:00 EDT** · branch `hotfix` · status: **paused**.

Read the [detailed handoff](handoffs/2026-10-24_1200-EDT-data-pipeline.md) for the
verified state, source findings, commands and limitations. The
[v1 specification](Data-Pipeline-Spec.md) defines acceptance. This is the live task
list; mark completion here and leave the dated handoff as a historical snapshot.

## How to take a task

Choose an unassigned item, replace its owner below, and follow its dependencies.
Implement through the shared CLI/visualizer pipeline. Finish with a Conventional
Commit and record the tested workspace/revision and validation evidence under the
task. Keep raw campus data and credentials outside Git. A completed fixture alone
does not replace the applicable source-to-app acceptance check.

Owners are intentionally unassigned; no external tickets or messages were created.
No tasks are currently running. Resume a task explicitly after this pause.

## Task index

| ID | Priority | Task | Owner | Depends on |
| --- | --- | --- | --- | --- |
| DP-01 | P1 | Capture and join FMS room inventory | Unassigned | CMU/FMS access |
| DP-02 | P1 | Verify floor D alignment and physical floor ordering | Unassigned | Saved capture; floor metadata as needed |
| DP-03 | P1 | Generate evidence-backed indoor walkable graphs | Unassigned | DP-01 source classification/evidence |
| DP-04 | P1 | Connect floors and implement accessible-route semantics | Unassigned | DP-02, DP-03 |
| DP-05 | P1 | Connect verified entrances to outdoor paths | Unassigned | DP-03 |
| DP-06 | P2 | Complete indoor and area-based POI coverage | Unassigned | DP-01; DP-03 for navigable associations |
| DP-07 | P1 | Save and restore named workspaces through temporary S3 | Unassigned | Storage access and destination policy |
| DP-08 | P2 | Expand preview activation/recovery checks | Unassigned | Existing preview loader |
| DP-09 | P2 | Validate another real building and encountered formats | Unassigned | DP-01 adapter when ready; authorized source access |
| DP-10 | P2 | Verify Linux/WSL startup and lightweight dependency installs | Unassigned | Native development setup |
| DP-11 | P1 | Close the first-building v1 acceptance case | Unassigned | DP-01–DP-09 as applicable |

DP-01, DP-02, DP-07, DP-08 and DP-10 can be investigated independently. Coordinate
changes to shared working models before parallel implementation. Sharing this
checkout's writable JSON or database between agents can invalidate another run;
use separate workspace names and explicitly coordinate activation of the one
local preview environment.

## DP-01 — FMS inventory and source-linked classification

- [ ] **Deliver:** a reusable authenticated capture of the selected building's room
  records, with verified pagination, source IDs, reported areas and FICM semantics.
- **Start:** `scraper/fms/`, `processor/working.py`, `workspace.py`, and the handoff's
  FMS investigation. The Room Details List showed 167 Ansys records after Building
  Code `116` / EqualTo filtering. This source has not been captured into the pipeline.
- **Implement:** join by verified building/floor/room identifiers and handles where
  available; retain raw classification/provenance and map to the existing room-type
  vocabulary. Surface ambiguous/unmatched records in the same visualizer. Preserve
  saved corrections on ordinary replay; make replacement explicit. Inspect the
  login waiter's dependency on expanded `.rtIn` navigation.
- **Done when:** all selected inventory pages are accounted for, no unrelated
  building/personnel records are retained, and a fresh capture or saved replay
  produces reviewed labels/types through build → load → verify → app inspection.
  Show at least one previously missing/ambiguous label or unknown type improved by
  source evidence, while unresolved joins remain visible.
- **Evidence:** *Not started.*

## DP-02 — Complete alignment and floor ordering

- [ ] **Deliver:** source-backed registration for D and a verified interpretation
  of the drawing levels' physical ordering.
- **Start:** `processor/frames.py`, saved raw drawings and the FMS Floor Details
  List. Five floors share verified footprints; D has only one reliable match.
- **Implement:** obtain another independent landmark or metadata relationship.
  If a human must review it, add comparison/review in the existing visualizer and
  persist that evidence in working JSON. Do not lower the threshold simply to
  include D. Distinguish 2D alignment, floor order and elevation.
- **Done when:** all six captured levels are either verified or explicitly
  unsupported with actionable evidence; generated placements survive replay and
  render correctly in the app; the order used by vertical routes/floor switching
  is justified independently of lexical floor codes.
- **Evidence:** *Not started.*

## DP-03 — Indoor geometry, doors and walkable links

- [ ] **Deliver:** useful intra-floor routes grounded in physical openings and
  walkable spaces, retaining the existing graph JSON format.
- **Start:** current `processor/generate.py` produces isolated room nodes. Tested
  architectural door/wall layer requests returned empty geometry. Investigate
  alternate drawings, inventory handles or actual structured architectural data.
- **Implement:** separate FMS source pieces from physical rooms; model verified
  portals and walkable corridor geometry. Support holes/concave shapes. If source
  evidence is unavailable, make reviewed links editable in the same JSON workflow.
  Shared polygon boundaries alone do not establish a door.
- **Done when:** independently known room-to-corridor and room-to-room routes work
  in the app, segments remain inside supported walkable geometry, and a no-door
  shared-wall case cannot become a shortcut. Record disconnected components and
  coverage gaps. Run the affected saved-source → build → load → verify → app loop.
- **Evidence:** *Not started.*

## DP-04 — Vertical connections and accessibility

- [ ] **Deliver:** verified stair/elevator/ramp identities across floors and an
  accessible route mode whose graph and API retain the required semantics.
- **Start:** no cross-floor links exist. Current application JSON can carry neighbor
  metadata, but the database Edge table and importer currently preserve only node
  endpoints. The API currently returns Fastest/Inside; Accessible is disabled.
- **Implement:** retain source-backed connection/access information through JSON,
  conversion, database, cache, pathfinding and UI. Verify elevations/order where
  required. Keep unsupported/unknown access explicit.
- **Done when:** a known stair route and elevator route work between verified
  floors, an accessible route excludes stairs, and unavailable accessible routes
  are reported accurately. Validate the complete path through the app rather than
  treating a visible mode selector as implementation.
- **Evidence:** *Not started.*

## DP-05 — Entrances and indoor/outdoor continuity

- [ ] **Deliver:** verified building entrance links to the freshly captured outdoor
  network.
- **Start:** `processor/outdoor.py` and the indoor portal work. Outdoor routing
  already works; indoor nodes are intentionally disconnected from it.
- **Implement:** identify the entrance, its building/floor and supported walking
  connection. Preserve OSM grade-separated crossings and access restrictions.
  Treat pedestrian areas as areas rather than routing along their perimeter.
- **Done when:** a known outdoor location → entrance → indoor destination route
  works without crossing walls or inventing an entrance; a restricted/non-entrance
  case is rejected. Run and inspect the complete candidate in the app.
- **Evidence:** *Not started.*

## DP-06 — POI completeness and review

- [ ] **Deliver:** source-backed indoor amenities and reviewed locations for useful
  area/relation POIs, deduplicated with the existing 34 point POIs.
- **Start:** FMS inventory/assets, `scraper/outdoor.py`, `models/pois.py`, and existing
  visualizer POI vocabulary. Room use alone does not prove an AED/printer exists.
- **Implement:** preserve provenance and verified building/floor associations.
  Expose uncertain locations/types for review in the same working-JSON editor.
- **Done when:** supported POIs survive generate/import/API verification and appear
  on the correct app floor/outside layer, duplicates are accounted for, and valid
  zero-result sources remain distinct from failed capture.
- **Evidence:** *Not started.*

## DP-07 — Named workspace synchronization with S3

- [ ] **Deliver:** explicit upload/download of a coherent named workspace and its
  generated revision using `TEMP_DEV_S3`.
- **Start:** `clients/_s3_client.py`, `processor/store.py`, the spec's workspace
  section and the handoff's storage inventory. Fresh Ansys data currently exists
  only under ignored local `uploads/pipeline/ansys-v1`.
- **Implement:** agree a prefix layout for capture, raw/working data and immutable
  generated revisions. Verify destination access rules for detailed FMS data.
  Validate checksums/completeness before selecting a remote revision; exclude env
  files, tokens, cookies and profiles. Preserve the existing root baseline objects.
- **Done when:** a separate clean workspace can retrieve a complete revision and
  reproduce build/load/verify without the original machine's cache; interrupted
  transfers do not advertise partial revisions. Document and run the operation
  against the temporary bucket with appropriately scoped authorization.
- **Evidence:** *Not started. No new workspace uploaded; baseline has four older
  objects and no `osm-pois.json`.*

## DP-08 — Activation, failure and recovery coverage

- [ ] **Deliver:** repeatable checks for the consistency guarantees that extend
  beyond the already exercised corrupt-input/baseline/stale-client cases.
- **Start:** `previewService.ts`, `previewGate.ts`, `mapRuntime.ts`, `preview.tsx`,
  `processor/verify.py`. Keep tests at the agreed source-to-app boundary.
- **Implement:** exercise a failure during staging/cache construction, overlapping
  load requests/readers, process restart and old-page reload behavior. Include two
  workspaces containing identical JSON and a working edit followed by rebuild.
- **Done when:** failure leaves the prior complete preview usable, restart restores
  the selected revision with ready caches, and old clients never mix database,
  search or graph state. Record the test command and what it detects.
- **Evidence:** *Not started; earlier success cases are listed in the handoff.*

## DP-09 — Another selection and source format

- [ ] **Deliver:** a second real building selection through the same engine, and
  explicit coverage of the source format it exposes.
- **Start:** parameterized FMS discovery and public numeric-ID join. Current live
  acceptance is Ansys only; fixtures exercise different crops and arbitrary names.
- **Implement:** discover rather than hardcode filenames, layer roles, floor IDs
  and app/GIS abbreviations. Add a unit adapter only after verifying an encountered
  format; the current normalizer explicitly rejects Revit coordinates.
- **Done when:** a bounded real selection captures, resumes offline, normalizes,
  accepts a saved placement, builds, loads and renders without code changes for
  that building. Unsupported formats remain explicit incomplete results.
- **Evidence:** *Not started.*

## DP-10 — Native platform verification

- [ ] **Deliver:** observed Linux/WSL results and a reproducible lightweight tool
  installation after removal of obsolete GIS dependencies.
- **Start:** `scripts/dev/`, native CI workflow and the running guide. macOS was
  exercised locally; platform-independent launcher tests and CI definitions exist.
- **Implement:** verify private socket selection, unprivileged API port, Prisma
  shared libraries, relay callback and graphical CMU login prerequisites. Run in
  WSL on the Linux filesystem; ordinary Windows PowerShell is not a Nix runtime.
- **Done when:** record actual platform/check results, fix platform-specific
  startup failures, and update setup instructions with observed requirements.
  Leave system Nix/devenv/Bao installation to the developer.
- **Evidence:** *Not started on Linux/WSL in this session.*

## DP-11 — First-building v1 acceptance

- [ ] **Deliver:** one documented end-to-end run covering the agreed first-building
  routes, labels, floor alignment and POIs, followed by a meaningful edit/rebuild.
- **Start:** acceptance checklist in the specification. The current five-floor
  preview/outdoor route is an intermediate milestone, not v1 completion.
- **Done when:** the selected building can be freshly captured, placed once,
  corrected, generated, loaded and inspected repeatedly; independently known
  intra-floor, cross-floor, entrance and accessible routes pass; unresolved source
  limitations remain visible. Complete checks with the same working pipeline,
  preserve the old preview on a deliberate failed load, and record exact revisions.
- **Evidence:** *Not started as a full acceptance case.*

## Outside this queue

Production promotion/public CDN publication, scheduled refreshes, permanent
orchestration, a replacement visualizer and a 3D building model are outside v1.
Existing baseline import and hosted application integrations remain separate
responsibilities. Keep the branch local until the user authorizes a push.
