# Data pipeline handoff — 2026-10-24 12:00 EDT

Created: **October 24, 2026, 12:00 EDT (UTC−04:00)**. Branch: `hotfix`.
This is a dated checkpoint, not the specification or a claim that v1 is complete.
The user requested a detailed handoff, a member-ready task list, branch cleanup,
and a pause. Pipeline implementation is paused; cleanup and validation are the only work
authorized for this checkpoint.

## Start here

1. Read [the work queue](../Data-Pipeline-TODO.md) and claim a task there.
2. Read [the agreed specification](../Data-Pipeline-Spec.md) for acceptance criteria.
3. Use [Setup](../Setup.md) for services/auth and [FMS Capture](../FMS-Capture.md)
   for pipeline commands. This handoff records the facts and limitations behind them.
4. Preserve the local workspace before re-extracting or moving the checkout.
   A fresh clone does **not** contain the captured campus data or placement.
5. Recheck the active revision with `GET http://localhost:8080/preview` before
   testing. The revision below was verified at this checkpoint; another operator
   may subsequently select a different candidate.

The working checkout was `/Users/siddharthr/Documents/CMU/ScottyLabs/maps` on macOS.
Git uses `ssh://forgejo@git.cmu.dev/ScottyLabs/maps.git`. Changes are committed
locally; the most recent user instruction is to keep the work local and pause.
The old Docker worktree/volume is not the native database.

## Intended workflow and decisions already made

```text
Interactive CMU/Duo login -> discover selected FMS floors -> capture source
  -> normalize source-frame geometry and labels -> editable working JSON
  -> visualizer placement/corrections -> explicit canonical JSON build
  -> validate and convert through the existing JSON-to-table importers
  -> transaction in an isolated local schema -> warm search/graph caches
  -> activate revision -> fresh app page -> inspect -> edit/rebuild/reload
```

The user wants a useful, repeatable v1 pipeline, not permanent orchestration.
Working JSON is authoritative; the database is a derived preview. Saving or
moving a visualizer vertex must not import the database. CLI and visualizer use
one Python implementation. Keep the five existing application JSON contracts.
Existing processed campus data is not a required input to fresh generation.

One reference floor may be placed manually. Other floors need verified common
coordinates before reusing that anchor. A source space is not automatically a
physical room, and a shared boundary is not a doorway. Incomplete but valid
candidates may load with explicit warnings. Production promotion is outside v1.

The local runtime is native Kennel/devenv on macOS, Linux, or WSL2. Docker/Colima
are no longer development dependencies. Kennel provides PostgreSQL and Ricochet;
Garage is disabled because the branch uses the temporary hosted S3 bucket.
The Nix scaffold and committed lock are retained for eventual Kennel migration.

## Verified state at pause

| Item | State |
| --- | --- |
| Workspace | `uploads/pipeline/ansys-v1` (ignored by Git) |
| Building | ANSYS Hall, app code `AN`, FMS building `116` |
| Public GIS abbreviation | `AH`; intentionally does not replace selected app code `AN` |
| Captured floors | `1`, `2`, `A`, `B`, `C`, `D` |
| Normalized source pieces | 165; 115 have unambiguous names |
| Included generated floors | `1`, `2`, `A`, `B`, `C` |
| Included indoor pieces | 145; this is not a verified physical-room count |
| Graph | 1,155 nodes: 145 isolated indoor room nodes and 1,010 outdoor nodes |
| Directed edges | 2,114, currently outdoor only |
| POIs | 34 public point POIs |
| Source warnings | 161; includes classification gaps, excluded D and missing indoor connectivity |
| Baseline | Preserved separately; restore check returned 74 buildings |
| Fresh S3 upload | Not implemented/performed for this workspace |

Generated revision:

```text
e053b4ff24f1b72f1632b09ee9bfea2c95ec0f3ef56c69d9d994fadd8613fb87
```

Saved working revision used by that build:

```text
cc6569199604999dc677cf89e16ae11673f7e5ec2b9950f0ae594199e92e2ba2
```

The user saved the manual anchor on floor `1`; it is in
`working.json -> anchors.AN`. Preserve that file. A meaningful label edit was
saved through the visualizer, verified after reload, then restored before the
current build. The app was inspected at room `AN-205`; room `AN-101` also passed
search/selection checks. The app URL carries `workspace` and `revision`.

| Captured floor | Source pieces | Unambiguous names | Current generation |
| --- | ---: | ---: | --- |
| 1 | 21 | 15 | Manual reference |
| 2 | 45 | 32 | Two matches against 1, spanning 4.83 m |
| A | 28 | 16 | Nine matches against 1, spanning 24.48 m |
| B | 22 | 16 | Two matches against 2, spanning 4.71 m |
| C | 29 | 19 | Four matches against 1, spanning 6.57 m |
| D | 20 | 17 | Excluded: only one reliable shared footprint |

This proves useful 2D registration evidence, not physical floor ordering,
elevation, stair/elevator connectivity, or accessibility. The public GIS lists
two floors while FMS exposes six drawing levels; resolve that distinction from
source records instead of assuming a floor-code sort is a vertical ordering.

## Local artifacts and S3 are different states

The workspace contains `capture.json`, `working.json`, `.working.lock`, `raw/`,
`generated.json`, and immutable candidate directories under `generated/<revision>/`.
The five outputs are under the candidate's `floorplans/` directory:

| JSON | Consumer |
| --- | --- |
| `buildings.json` | Names, geographic footprints, building/floor metadata |
| `placements.json` | Per-floor geographic placement |
| `floorplans.json` | Source-linked room IDs, labels, types and polygon rings |
| `all-graph.json` | Node-ID dictionary and neighbor dictionaries, not node/edge arrays |
| `osm-pois.json` | Existing POI dictionary contract; valid empty dictionaries are supported |

All five were generated locally and their records imported into the selected
local preview. Raw JSON files are not simply stored as database blobs. The
existing converters create the seven map tables: Building, Floor, Room, Alias,
Node, Edge and Poi. `verify` checks what the actual app APIs return.

The temporary bucket is `categorized-lockerbox-v9qy6t` at
`https://t3.storageapi.dev`, region `auto`. The latest read-only S3 check found
only the root prefix `floorplans/` and the following baseline objects. None of
the four existing objects matched the fresh candidate's size/ETag.

| Key under `floorplans/` | Bytes | Last modified (UTC) |
| --- | ---: | --- |
| `buildings.json` | 207,889 | 2026-10-24 04:11:40 |
| `floorplans.json` | 43,520,467 | 2026-10-24 04:11:43 |
| `placements.json` | 45,171 | 2026-10-24 04:11:48 |
| `all-graph.json` | 18,322,777 | 2026-10-24 04:11:49 |
| `osm-pois.json` | Missing (`NoSuchKey`) | — |

The fresh captures, working JSON, generated revision and report remain local.
A teammate cannot pull them from S3 yet. Named-workspace synchronization is an
open task, not an existing command. Preserve the old baseline while designing
that operation; a single-building preview should not overwrite the shared
campus dataset accidentally. Keep detailed campus drawings out of Git/public
screenshots, and verify the destination's access policy before copying raw FMS
artifacts. No credentials or authenticated browser profiles belong in a workspace.

## Implementation map

Dataflow module paths below are relative to `apps/dataflow/src`; other paths are
repository-relative. Follow them rather than rebuilding a second workflow in UI
code or reviving the retired standalone generators.

| Area | Entry points and behavior |
| --- | --- |
| Native startup/secrets | `scripts/dev/dev.py`, `app.sh`, `devenv.nix`; startup applies schema but never imports map data |
| FMS acquisition | `scripts/dev/fms.sh`, `apps/dataflow/src/scraper/fms/{cli,browser,capture}.py` |
| Public building records | `scraper/public.py`; discovers the ArcGIS Buildings layer and joins selected numeric FMS IDs |
| Public outdoor snapshot | `scraper/outdoor.py`; bounded HTTPS Overpass query, checksum-addressed raw files and saved normalized snapshot |
| Source normalization | `processor/svg.py`, `workspace.py`; transforms, physical units, holes/curves/fill rules, duplicate geometry and label containment |
| Working state | `processor/working.py`, `store.py`; constrained workspace root, atomic saves, optimistic revision conflicts and source-frame validation |
| Frame evidence | `processor/frames.py`; one-to-one footprint agreement propagated from the anchored floor |
| Canonical generation | `processor/generate.py`, `outdoor.py`; emits all five contracts together, checks output and writes the successful manifest last |
| Candidate conversion | `clients/dataset.py`, `deserializer/bundle.py`, `preflight.py`, `tables/`; reuse existing converters without HTTP writes in the worker |
| CLI/API bridge | `processor/__main__.py`, `bridge.py`, `scripts/dev/pipeline.sh`; same engine as visualizer actions |
| App verification | `processor/verify.py`; authenticated reads of buildings, all floor polygons/labels, nodes/links and POIs |
| Preview activation | `apps/server/src/services/previewService.ts`, `lib/pipeline.ts`, `lib/runPipeline.ts` |
| Request consistency | `apps/server/prisma/index.ts`, `lib/mapRuntime.ts`, `lib/previewGate.ts`; database/cache snapshot per request |
| Source editor | `apps/visualizer/src/pipeline/`, `routes/workspaces/`; existing visualizer, shared Keycloak session |
| App context | `apps/web/src/preview.tsx`, `api/client.ts`; revision header, URL context and stale-preview reload prompt |
| App consumer fixes | Floor service, floorplan/POI overlays, navigation components and `utils/distanceUtils.ts` |

### Coordinates and generation invariants

FMS unit `SF` means drawing lengths in **inches** in the observed client
conversion. Normalize using each floor's bounds and SVG view box, including
ancestor transforms and axis reversal. Working coordinates are metres, x right,
y up. The visualizer's drawing coordinates are y down. The app placement angle
has a 90-degree convention offset. Reuse the existing conversion functions.

Independent checks: floor-1 room 101 is approximately 1,011 sq ft and room 106
approximately 1,117 sq ft, agreeing with CAD annotations and the newly observed
inventory values. Do not rescale drawings into arbitrary image pixels.

Frame matching requires polygons of at least 0.25 m², at least two unambiguous
one-to-one matches spanning at least 3 m, overlap of at least 85%, and centroid
and Hausdorff boundary differences no greater than 0.25 m. D intentionally fails
the evidence threshold. Evidence IDs/errors are in `generated.json -> alignment`.

Generated revision identity includes workspace name, working revision, file
hashes, warnings and alignment evidence. Copied workspaces must receive distinct
identities so staging cannot clear an active schema belonging to another run.
Files already present under a revision may not be changed silently. A working
edit requires an explicit rebuild before load; old generated revisions remain
available for diagnosis.

### Preview isolation and activation

The private database uses Kennel's Unix socket, not TCP `localhost:5432` or a
Docker hostname. `loadPreview` validates `DEVENV_RUNTIME`, the socket path and the
`maps` database before allowing candidate writes. `PIPELINE_ROOT` enables the
local bridge; production does not enable that root.

Each candidate uses a `maps_preview_<revision-prefix>` schema. Rows are staged
in one transaction, then graph/search caches are built against that candidate.
Activation drains in-flight readers, persists `public.PreviewSelection`, swaps
the database/cache set, and disconnects old sockets. Request AsyncLocalStorage
pins database and caches together. Restart initialization reopens the stored
selection and prepares caches before listening.

The ordinary baseline remains in `public`. `baseline` restores it without
removing candidate schemas. Ordinary map mutations and the old importer are
blocked while a generated preview is selected; an empty authorization probe is
allowed. A failed candidate must leave the previous preview selected.

Browser API requests send `X-Maps-Revision`. The page pins its initial revision;
React Router navigation preserves workspace/revision query parameters. Stale
clients receive `409 PREVIEW_CHANGED` and a full-reload prompt. Bootstrap fetches
`/preview` to select the canonical app URL. This avoids retaining old room,
floor, route or React Query state across dataset changes.

### Outdoor data and app behavior

The snapshot contained 272 public path features and 34 recognized point POIs.
Only explicit OSM way-node relationships create links; crossings are not joined
by proximity. Pedestrian direction is retained. Private/no-foot-access paths,
restricted nodes and unlocated indoor/level features are excluded or reported.
Area perimeters are withheld pending a walkable-area generator. Area/relation
POIs need a reviewed point location instead of a guessed bounding-box centre.
The source can succeed with zero results; HTTP/parser/runtime failures preserve
the last successful snapshot.

Indoor graph generation currently adds one representative point per source space
and **no indoor edges**. Classified restrooms can produce POIs, but the observed
FMS inventory classifications have not yet been joined to working spaces.
An existing physical room may contain multiple source pieces; resolve that before
assuming every piece is an independently navigable room.

App fixes verified during this increment:

- Empty or duplicate names no longer overwrite other polygons in a name-keyed
  floorplan response. Stable IDs retain every polygon; ambiguous/unassigned
  spaces await review rather than acquiring fabricated labels or room links.
- Unnamed spaces are excluded from named-room search results.
- Outdoor POIs are requested independently of the focused indoor floor for
  signed-in users. Existing indoor access behavior is retained.
- Room and route navigation retains the selected preview context.
- Route overlays wait for MapKit instead of crashing on a direct route link.
- API distances are metres; labels convert to feet. Unsupported route modes are
  disabled. Accessible routing itself has not been implemented or verified.

## FMS investigation immediately before pause

A fresh interactive CMU/Duo session successfully opened the FMS homepage. The
following source investigation was performed through the authenticated UI. This
is a newly verified source capability, **not yet a reusable capture adapter**.
No complete structured room-inventory snapshot has been integrated or uploaded.
Future work should not rely on temporary scripts or a still-authenticated browser.

From Home, open **Room Details List**, then **Show Filters**. Filter **Building
Code** to `116` with **EqualTo**. The observed result was **167 records**, paged
25 at a time (seven pages). Do not equate that count to the 165 extracted pieces
or quietly drop unmatched inventory rows.

Observed room view:

```text
https://fmsystems.cmu.edu/FMInteract/NewFormView.aspx?dv_key=_0D090CDCF&act_code=Q
```

Observed columns: Building Code, Building Description, Address, Floor, Room #,
Room Name, Area, C-Level Org, E-Level Org, Dept/Org, Department, Space Class
Description, Space Use (FICM), Description and Philanthropic Name. Prefer an
explicit allowlist of non-personal room/geometry fields when implementing capture.
Department ownership is not evidence of public access.

Selected source examples from the first Ansys page:

| Floor / room | Reported area (sq ft) | FICM | Source description |
| --- | ---: | --- | --- |
| 1 / 101 | 1,010.75 | 210 | Class Laboratory |
| 1 / 102 | 64.51 | 680 | Meeting Room |
| 1 / 102A | 60.62 | 680 | Meeting Room |
| 1 / 103 | 129.89 | Y04 | Utility/Mechanical Space |
| 1 / 104 | 93.53 | Y04 | Utility/Mechanical Space |
| 1 / 105 | 136.64 | Y04 | Utility/Mechanical Space |
| 1 / 106 | 1,116.64 | 210 | Class Laboratory |

Room 105's inventory record is useful evidence for reconciling missing labels,
but area similarity alone does not establish a unique polygon join. Confirm
building/floor identity, room number, handles where exposed, geometry and area.
Keep ambiguous associations reviewable. Derive room types from explicit source
classification through the existing app vocabulary; retain raw FICM semantics
in capture/working metadata rather than extending canonical files ad hoc.

Other homepage links observed, not yet fully inspected:

- Floor Details List: `NewFormView.aspx?dv_key=_A250013AB&act_code=Q`.
- Building Details List: `NewFormView.aspx?dv_key=_SAA1DKIUU&act_code=Q`.
- CMU FICM Classifications: `exagoviewer.aspx?act_code=Q&rep_own=_GLOBAL&report_name=CMU%20FICM%20Classifications&report_code=CMU-S002`.

The room view uses Telerik/ASP.NET filtering and paging. A POST back for a query
is not a room-data edit, but avoid record update/delete actions. Verify complete
paging, selected-building scope and login-expiry detection in the real adapter.
The drawing capture's login waiter recognizes `.rtIn` navigation; the homepage
initially did not expose that tree until Space Management was opened. Investigate
whether this can leave a signed-in user waiting unnecessarily.

### Previously verified drawing API findings

The source base is `https://fmsystems.cmu.edu/FMInteract/`. Preserve AJAX and
Referer headers; several handlers otherwise return HTML with HTTP 200.

| Source / behavior | Evidence or limitation |
| --- | --- |
| `getFloorInfo.ashx` | Floor ID, actual SVG filename, CAD/Revit flag, units and physical bounds |
| `getDefaultLayers.ashx` | Boundary/tag layer roles; use roles rather than assuming layer names |
| `getDefaultLayersData.ashx` | Actual SVG fragment/document; validate before caching |
| `getSvgInfo.ashx` | Requires explicit empty `themeId` in the observed initial view |
| `getLayers.ashx` | Broad configured catalog (415 layers); catalog names do not prove geometry exists |
| `getLayerDataFromSvg.ashx` | Supplemental room-number/area/leader/outline layers where nonempty |
| Tested `ARCH\|A-DOOR`, `ARCH\|A-WALL` | Returned no geometry; no automatic door inference is justified |
| `_INITIAL` `GetGraphicViewData.ashx` and capacities | Empty space/capacity results on inspected floors 1 and 2 |
| Source client handle fields | Potential CadTagHandle/PolylineHandle joins exist in client code; a populated CMU join has not been verified |

Keep cookies in memory in the acquisition process and delete isolated browser
profiles when it ends. Source normalization/build/verify must work offline from
saved inputs. The paused investigation's temporary browser helper is not an
application dependency; expect to authenticate again on resume.

## Credentials and runtime boundaries

Read names/paths here; obtain values through OpenBao. Never copy values into this
handoff, Git, a browser-delivered asset, or a diagnostic transcript.

- Bao mount `secret`, entries `secretspec/maps/dev/<NAME>`, field `value`:
  `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `KEYCLOAK_URL`, `KEYCLOAK_REALM`,
  `MAPKIT_TOKEN`, `OAUTH_RELAY_URL`.
- Grouped `TEMP_DEV_S3` contains `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
  `S3_ACCESS_KEY`, `S3_SECRET_KEY`.
- `dev.py secrets` validates values before replacing ignored env files for
  server, web, visualizer and dataflow. Browser-visible MapKit configuration is
  distinct from identity/storage credentials.
- Browser Keycloak/Better Auth login, developer OpenBao login, and CMU FMS/Duo
  login are three different authentication flows.
- Population uses Keycloak client credentials. Token signature, expiry, issuer
  and `/projects/maps/admins` group are required. Audience was explicitly removed
  at the user's request; do not reintroduce it as an assumed requirement.
- Python candidate conversion is offline. The server boundary checks the
  population client through the existing authorization path. This avoided a
  worker-network failure seen during early Keycloak token requests.
- The replacement MapKit token was verified working and expires November 1,
  2026. Refresh it through OpenBao when necessary; never paste it into docs.

## Resume and validation commands

Use repository-root commands below. The [running guide](../Setup.md) is the
maintained explanation of startup and manual equivalents.

```sh
export BAO_ADDR=https://secrets.scottylabs.org
bao login -method=oidc
python3 scripts/dev/dev.py start
```

With valid local env files, `start --skip-secrets` reuses them. Services are web
5173, visualizer 5174, API 8080, Ricochet 8090 and private socket PostgreSQL.
The app can be left running for inspection at a pause; the scraper session is
separate. Stop deliberately with `python3 scripts/dev/dev.py stop`.

For the existing saved candidate, with the native stack running:

```sh
devenv shell -- bash scripts/dev/pipeline.sh verify --workspace uploads/pipeline/ansys-v1 --revision e053b4ff24f1b72f1632b09ee9bfea2c95ec0f3ef56c69d9d994fadd8613fb87
```

A read-only check should return 5 floors, 145 rooms/source pieces, 1,155 nodes,
2,114 edges and 34 POIs for this checkpoint. It compares polygon coordinates and
labels, graph identities/topology and POIs with actual API responses. Coordinate
comparison allows only tiny JSON/JSONB floating-point round-trip differences.
It does not establish physical correctness, accessibility or complete routes.

For a saved working edit, explicitly build, then load/verify the new full revision
printed by build. It may differ from this handoff's revision:

```sh
devenv shell -- bash scripts/dev/pipeline.sh build --workspace uploads/pipeline/ansys-v1
devenv shell -- bash scripts/dev/pipeline.sh load --workspace uploads/pipeline/ansys-v1 --revision <full-revision>
devenv shell -- bash scripts/dev/pipeline.sh verify --workspace uploads/pipeline/ansys-v1 --revision <full-revision>
```

`baseline` restores the preserved ordinary import. `dev.py populate` imports the
older hosted baseline and is not a substitute for the fresh workspace pipeline.
The older baseline importer is not a single transaction and requires an app
restart for caches. Candidate loading is transactional and prepares caches itself.

### Verification already performed

- Real authenticated six-floor FMS capture, verified offline reuse and fixture
  checks for login HTML, interrupted retries and selection consistency.
- SVG transforms, physical units, duplicate removal, holes, curves, self-touching
  filled shapes and conservative label matching.
- Visualizer edit/save/reload, restored original label, manual anchor saved by user.
- Different-crop frame fixture: a matching floor stacks; a shifted frame is excluded.
- Public building metadata joins numeric FMS ID without replacing requested app code.
- Live OSM fetch, including an uncached fetch through the API worker used by the UI.
- Outdoor fixture: private/indoor links excluded, pedestrian area perimeter withheld,
  legitimate offline reuse and failed refresh preserving saved working data.
- Candidate JSON contracts and existing converters, including valid empty POIs.
- Real API `verify`: 5 floors, 145 polygons, 1,155 nodes, 2,114 links, 34 POIs.
- Real app room search/selection, automatically aligned floor 2, outdoor POI display
  and an outdoor route: 39 nodes, about 418.9 m / 1,374 ft, three instructions.
  Route endpoints were `40.4411507,-79.9476156` and `40.4391545,-79.94528`.
- Corrupt candidate rejected before activation, previous preview readable, baseline
  restored to 74 buildings, old-page revision rejected after a new activation.
- 26 Python offline tests, full Python lint/type checks, TypeScript workspace
  checks, both Vite builds, OAuth relay tests and launcher tests passed during work.
  Cross-platform CI execution has not been observed in this local session.

Remaining acceptance gaps include indoor and cross-floor/entrance routes,
accessibility, D, complete inventory/POI associations, remote workspace recovery,
a second real building/format and more activation failure/concurrency cases.
See the work queue for independently claimable tasks and completion criteria.

## Branch cleanup and retained responsibilities

The pause cleanup removes the superseded standalone ESIM/OSM scripts, Ansys-only
neighbor/graph prototypes, their unused eager S3 utility, unused dependencies,
the obsolete Vault-mount sync submodule, nonexistent package entries and stale
developer documentation. `bun run secrets:pull` now delegates to the maintained
development secret loader. Git history retains
those experiments for reference. They are not the supported route generator.

The remaining workflow has one source adapter per source, one working store, one
canonical generator, and the existing table converters. The baseline S3 importer
and original database editor remain intentional compatibility paths; database
editing is blocked while a generated preview is selected. Production Dockerfiles,
other application integrations, local env files, raw datasets, generated candidates
and native database state are retained.

Useful implementation commits before cleanup:

| Commit | Increment |
| --- | --- |
| `1a64b5de` | Agreed fresh-source specification |
| `eae3dd94` | Native development migration |
| `99e541de` | Authenticated FMS capture |
| `f87e28f9` | Geometry and label normalization |
| `6662b21b` | Shared visualizer Keycloak session |
| `4ce31848` | Workspaces and public building metadata |
| `e22d7a0d` | Source editor and reference placement |
| `3c264ef8` | Canonical candidate export |
| `0aad0241` | Shared candidate-to-table conversion |
| `d8adff62` | Isolated preview activation and ready caches |
| `de74db78` | Visualizer build/load and app revision context |
| `4fd2291c` | Verified frames, public outdoor data, API verification |
| `e764472a` | App geometry, POI, route readiness and distance fixes |

Continue with small Conventional Commits and relevant end-to-end checks. Keep
production publication separate from completing the development pipeline.

### Cleanup revalidation — 2026-10-24 12:19 EDT

The cleanup reduced the Python lock from 99 to 45 packages without changing the
versions of retained packages. Eighteen superseded Python files and the obsolete Vault sync submodule
were removed from the checkout. Its upstream repository was not changed. Existing raw/working/generated data, env files and database schemas
were preserved. The temporary FMS investigation process ended; no background
capture job or reusable authenticated session is retained.

The following checks passed against the cleaned working tree:

- 26 offline pipeline/population tests; Ruff, mypy and ty across 59 Python files.
- API/database code generation and TypeScript checks across all six packages.
- Five OAuth relay tests (38 assertions) and 12 host launcher tests.
- EditorConfig, syncpack, Markdown lint and local Markdown target checks.
- Live read-only `pipeline.sh verify`: the same 5 floors, 145 polygons,
  1,155 nodes, 2,114 edges and 34 POIs.

The native app stack remains available for inspection; no dataset was rebuilt,
activated, uploaded or reset by cleanup. Frontend bundles were last built during
the preceding implementation increment; their source code did not change in
this cleanup. CI definitions were updated, but hosted CI has not been run here.
