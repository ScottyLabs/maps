# Fresh FMS capture

This is the implemented acquisition stage of the
[fresh-source pipeline](Data-Pipeline-Spec.md). It captures source drawings and
metadata into a local workspace. Normalization and [workspace editing](Data-Visualizer-Wiki.md) are available
offline. Generation and candidate activation are subsequent stages; capture alone does not replace the app's dataset.

## Run

After the [native setup](Setup.md#prerequisites), install Google Chrome for the
interactive CMU login. Linux/WSL users need a graphical browser in that Linux
environment. Selenium manages its compatible driver; the script does not install
Chrome or ask for a CMU password in the terminal.

From the repository root:

```sh
devenv shell -- bash scripts/dev/fms.sh --workspace uploads/pipeline/ansys-v1 --building AN=116
```

Complete Andrew login and Duo in the isolated Chrome window. The command then
discovers all floors for the selected building, transfers the authenticated FMS
session into HTTPS requests, captures source data, and closes the browser/profile.
OpenBao login and application Keycloak login are separate from this CMU login.

`AN=116` means application building code `AN`, source FMS building ID `116`.
Use the building ID from FMS's Sites navigation URL. Repeat `--building` for
multiple buildings. This mapping selects source records; it does not require an
old building JSON or a hand-maintained floor-ID/filename list.

To capture a bounded floor selection into a different workspace:

```sh
devenv shell -- bash scripts/dev/fms.sh --workspace uploads/pipeline/ansys-two-floors --building AN=116 --floor 1 --floor 2
```

`--site` defaults to `MAIN`. A missing requested building/floor fails explicitly.
Repeating the same command resumes an interrupted selection and reuses verified
artifacts. A complete capture can be reused without opening Chrome or contacting
FMS. Changed selection flags require a new workspace; dropping a floor flag must
not make a bounded capture appear to cover the whole building.

Use a new workspace for a genuinely fresh capture. Ordinary processing should
reuse the saved source. Keep datasets under ignored `uploads/`, not in Git.

## Normalize the saved drawing

Run the offline stage through the same pinned environment:

```sh
devenv shell -- bash scripts/dev/pipeline.sh normalize --workspace uploads/pipeline/ansys-v1
```

This creates `working.json` with source-linked spaces, polygon rings, label
candidates, names where containment is unambiguous, and review warnings. Its
coordinates are metres in the physical drawing frame, with x right and y up.
They are not geographic coordinates. No database writes or S3 uploads occur.

Normalization composes nested SVG transforms with each floor's physical bounds,
removes rendering duplicates, preserves holes and SVG fill rules, and samples
curves at a maximum 2 cm source-frame arc step. Self-touching CAD contours are
split into their filled faces and flagged for review. Degenerate paths are
reported rather than turned into rooms. Source spaces still need review against
physical rooms, doors, and access information.

Re-running uses saved working JSON, preserving room corrections. If intentionally
re-extracting, add `--replace-working`; that explicitly discards working edits.
A changed capture requires that explicit replacement. The next placement/export
stages must consume this same saved data, rather than reimplement extraction.

The live six-floor sample normalizes to 165 source-space pieces, including
115 unambiguous names. These are extraction results, not a claim that the source
contains 165 physical rooms. Multipart entities, unmatched labels and unknown
room types remain visible for review. Automatic cross-floor alignment and
navigation generation still require their source-evidence checks.

As an independent unit check, the extracted areas for spaces labelled `101` and
`106` on floor 1 are approximately 1,011 and 1,117 square feet. These agree with
the captured CAD room-area annotations. The annotations are useful validation
evidence; they do not establish room types or door connectivity.

## Saved data and checks

The workspace contains:

- `capture.json`: requested scope, discovered selected floors, source URLs/IDs,
  physical bounds, drawing format, capture times, status, warnings, and checksums.
- `raw/fms/<building>/<floor>/default.svg`: verified FMS SVG document/group fragment.
- `svg-info.json`: view box and source-reported layer names for that drawing.
- `layer-catalog.json`: the broader configured layer catalog.
- `layer-<encoded-name>.svg`: additional returned CAD layers, including room-number
  and room-area annotations where available.

The manifest records which layers supply room boundaries and tags; downstream
processing must use those roles rather than hardcode `A-AREA` for every format.
Default layers and supplemental source files remain separate so duplicate
boundaries can be identified during normalization.

Requests use certificate verification, timeouts, and bounded GET retries. Login
or error HTML is rejected even with HTTP 200. Missing drawings, denied access,
failed requests, and empty supplemental layers are reported distinctly. Per-floor
checkpoints are atomic; interruption cannot mark a partial retry complete.
Cached files must match their checksums before reuse.

Authentication cookies and browser profiles are never saved in workspace files.
The production command keeps session cookies in memory and removes its temporary
Chrome profile when it exits. Raw FMS captures stay local in this acquisition
increment; the command does not upload them or populate the database.

## Verified source findings

The October 24, 2026 live run discovered and captured six ANSYS floors:
`1`, `2`, `A`, `B`, `C`, and `D`. It used fresh FMS responses and did not read the
old processed JSONs. The native app's imported baseline remains separate until
generation and explicit preview loading are implemented.

| Source information | Verified use or limitation |
| --- | --- |
| Floor ID, SVG filename, CAD/Revit flag | Returned by `getFloorInfo.ashx`; no filename reconstruction |
| `xmin`, `xmax`, `ymin`, `ymax` | Physical drawing bounds, distinct from the SVG crop |
| Native unit code `SF` | FMS's own scale conversion treats drawing lengths as inches, then converts to feet/metres |
| SVG view box and wrapper transform | Needed to undo SVG scaling, translation, and vertical-axis reversal |
| Boundary/tag layer roles | Returned by `getDefaultLayers.ashx`, not assumed |
| Room-number CAD layer | Additional label evidence for room matching and review |
| Room-area CAD layer | Potential area checks and label-to-polygon validation |
| Exterior/interior space outlines and annotation leaders | Potential footprint and label association evidence |
| Configured layer catalog | Lists possible door, wall, equipment and other categories; a name alone does not prove geometry exists |

The unit interpretation follows the conversion in
[FMS's drawing client](https://fmsystems.cmu.edu/FMInteract/js/jquery.fms.svg.dom.js),
not the unit code's name alone.

For floors 1 and 2, SVG crops differ (`8593 x 7903` and `8593 x 7901`) while
physical bounds are close. Normalize using each floor's own bounds and transforms
before testing shared landmarks. These are drawing coordinates, not a verified
latitude/longitude CRS. Common-floor alignment still needs landmark validation.

The tested `ARCH|A-DOOR` and `ARCH|A-WALL` requests returned no geometry. Treat
those as unavailable evidence rather than generate doors from touching space
polygons. FMS may list requested/configured layers whose geometry is empty.
The `_INITIAL` graphical-view query and capacity query returned no space/capacity
records for the two inspected floors; they currently provide no verified join
between label handles, room types, and boundary handles.

Useful next investigations are the authenticated space inventory/room-use reports,
source handle associations, actual architectural exports, connector identities,
and supported amenity/equipment records. Keep personnel assignments out of the
geometry capture. Generic FMS product features are not proof that this account
exposes useful CMU data for each field.

The SVG-info endpoint requires an explicit empty `themeId`; omitting it returned
`{}` during the live test. The source client also requires AJAX headers. These
protocol details are handled by the acquisition code.

## Checks

Fast fixture tests exercise capture through its saved output: login-page
rejection, source metadata/layers, verified offline reuse, interrupted retries,
and selection consistency. Fixtures contain synthetic drawings and no credentials.
See the [dataflow README](../../apps/dataflow/README.md#validation) for commands.
A live capture remains the integration check for CMU authentication and source
navigation; CI does not store CMU passwords or automate Duo.
