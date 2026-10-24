import {
  RoomTypes,
  type Building,
  type Placement,
  type Rooms,
} from "@cmumaps/common";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import MapDisplay from "../components/map-view/MapDisplay";
import PlacementPanel from "../components/map-view/PlacementPanel";
import {
  pipeline,
  type Point,
  type WorkingDataset,
  type WorkspaceView,
} from "./api";
import SourceCanvas from "./SourceCanvas";

interface Props {
  workspace: string;
  initial: WorkspaceView;
}

export default function WorkspaceEditor({ workspace, initial }: Props) {
  const [view, setView] = useState(initial);
  const [draft, setDraft] = useState(initial.working);
  const [building, setBuilding] = useState(Object.keys(draft.floors)[0]);
  const [level, setLevel] = useState(Object.keys(draft.floors[building])[0]);
  const [selected, setSelected] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mapPlacement, setMapPlacement] = useState<Placement | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const preventDiscard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventDiscard);
    return () => window.removeEventListener("beforeunload", preventDiscard);
  }, [dirty]);
  const floor = draft.floors[building][level];
  const room = floor.spaces[selected];
  const floorCode = `${building}-${level}`;
  const edit = (change: (working: WorkingDataset) => void) => {
    setDraft((previous) => {
      const next = structuredClone(previous);
      change(next);
      return next;
    });
    setDirty(true);
    setMessage("");
  };
  const save = async (working = draft) => {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await pipeline<WorkspaceView>("save", workspace, {
        expected_revision: view.revision,
        working,
      });
      setView(saved);
      setDraft(saved.working);
      setDirty(false);
      setMessage("Working JSON saved. The database preview is unchanged.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const fetchPublic = async () => {
    if (dirty) {
      setMessage("Save your working edits before fetching public sources.");
      return;
    }
    setBusy(true);
    try {
      const saved = await pipeline<WorkspaceView>("public", workspace);
      setView(saved);
      setDraft(saved.working);
      setMessage("Fresh public building metadata is available for placement.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openMap = () => {
    const metadata = draft.buildings[building];
    if (!metadata) {
      setMessage(
        "Fetch public building metadata first to locate this drawing on the map.",
      );
      return;
    }
    const anchor = draft.anchors[building];
    const points = Object.values(floor.spaces).flatMap((space) =>
      space.rings.flat(),
    );
    const origin = anchor?.origin ?? {
      x:
        (Math.min(...points.map((p) => p.x)) +
          Math.max(...points.map((p) => p.x))) /
        2,
      y:
        (Math.min(...points.map((p) => p.y)) +
          Math.max(...points.map((p) => p.y))) /
        2,
    };
    if (!points.length) {
      setMessage("This floor has no valid space geometry to place.");
      return;
    }
    setMessage(
      anchor
        ? "Loaded saved reference placement."
        : "Draft placement: align the drawing before saving.",
    );
    setMapPlacement({
      geoCenter: anchor
        ? { latitude: anchor.latitude, longitude: anchor.longitude }
        : metadata.label_position,
      pdfCenter: { x: origin.x, y: -origin.y },
      scale: anchor?.scale ?? 1,
      angle: ((anchor?.angle ?? 0) + 270) % 360,
    });
  };
  const writeAnchor = (working: WorkingDataset, placement: Placement) => {
    working.anchors[building] = {
      reference_floor: level,
      origin: { x: placement.pdfCenter.x, y: -placement.pdfCenter.y },
      ...placement.geoCenter,
      angle: (placement.angle + 90) % 360,
      scale: placement.scale,
    };
  };
  const changePlacement = (placement: Placement) => {
    setMapPlacement(placement);
    edit((working) => writeAnchor(working, placement));
  };
  const setRoomLabel = (point: Point) =>
    edit((working) => {
      working.floors[building][level].spaces[selected].label_position = point;
    });
  const rooms: Rooms = Object.fromEntries(
    Object.entries(floor.spaces).map(([id, space]) => [
      id,
      {
        name: space.name,
        type: space.type,
        aliases: space.aliases,
        labelPosition: {
          x: space.label_position.x,
          y: -space.label_position.y,
        },
        polygon: {
          type: "Polygon",
          coordinates: space.rings.map((ring) => ring.map((p) => [p.x, -p.y])),
        },
      },
    ]),
  );
  const metadata = draft.buildings[building];
  const mapBuilding: Building | undefined = metadata && {
    code: building,
    name: metadata.name,
    isMapped: true,
    defaultOrdinal: 0,
    defaultFloor: level,
    floors: Object.keys(draft.floors[building]),
    labelLatitude: metadata.label_position.latitude,
    labelLongitude: metadata.label_position.longitude,
    shape: metadata.shapes,
    hitbox: metadata.shapes[0],
  };
  if (mapPlacement && mapBuilding)
    return (
      <main aria-busy={busy} inert={busy}>
        <header className="relative z-50 flex items-center gap-5 bg-white p-3">
          <button type="button" onClick={() => setMapPlacement(null)}>
            ← Working drawing
          </button>
          <strong>
            {workspace} · {floorCode} · reference placement
          </strong>
          <p>
            Click the map to move the drawing; adjust rotation and scale, then
            save JSON.
          </p>
        </header>
        <MapDisplay
          floorCode={floorCode}
          building={mapBuilding}
          rooms={rooms}
          placement={mapPlacement}
          setPlacement={changePlacement}
        />
        <PlacementPanel
          floorCode={floorCode}
          placement={mapPlacement}
          setPlacement={changePlacement}
          onSave={() => {
            const working = structuredClone(draft);
            writeAnchor(working, mapPlacement);
            void save(working);
          }}
        />
        {message && (
          <p
            role="status"
            className="fixed right-5 bottom-5 z-50 max-w-lg rounded border bg-white p-4"
          >
            {message}
          </p>
        )}
      </main>
    );
  return (
    <main className="space-y-4 p-5" aria-busy={busy} inert={busy}>
      <header className="flex flex-wrap items-center gap-4">
        <Link
          to="/workspaces"
          onClick={(event) => {
            if (dirty) {
              event.preventDefault();
              setMessage(
                "Save before switching workspaces. Reload to discard unsaved edits.",
              );
            }
          }}
        >
          ← Workspaces
        </Link>
        <h1 className="font-semibold text-xl">{workspace}</h1>
        <span className="text-sm text-slate-600">
          {dirty ? "Unsaved edits" : `Saved ${view.revision.slice(0, 8)}`}
        </span>
        <button
          type="button"
          disabled={busy || !dirty}
          className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40"
          onClick={() => {
            void save();
          }}
        >
          Save working JSON
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border px-3 py-2"
          onClick={() => {
            void fetchPublic();
          }}
        >
          Fetch public building metadata
        </button>
        <button
          type="button"
          onClick={openMap}
          className="rounded border px-3 py-2"
        >
          Place reference floor
        </button>
      </header>
      <p className="text-sm">
        Source frame in metres. Select a space, edit its details, drag its blue
        polygon vertices or red label marker. Save explicitly; generation and
        database import are separate.
      </p>
      <div className="flex gap-4">
        <label>
          Building{" "}
          <select
            value={building}
            onChange={(event) => {
              const code = event.target.value;
              setBuilding(code);
              setLevel(Object.keys(draft.floors[code])[0]);
              setSelected("");
            }}
          >
            {Object.keys(draft.floors).map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <label>
          Floor{" "}
          <select
            value={level}
            onChange={(event) => {
              setLevel(event.target.value);
              setSelected("");
            }}
          >
            {Object.keys(draft.floors[building]).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <span>
          {Object.keys(floor.spaces).length} spaces · {floor.labels.length}{" "}
          source tags
        </span>
        {draft.anchors[building] && (
          <span>
            Reference saved on floor {draft.anchors[building].reference_floor};
            cross-floor alignment needs verification.
          </span>
        )}
      </div>
      {message && (
        <p role="status" className="rounded border p-3">
          {message}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <SourceCanvas
          key={floorCode}
          floor={floor}
          selected={selected}
          select={setSelected}
          moveLabel={setRoomLabel}
          moveVertex={(ring, vertex, point) =>
            edit((working) => {
              const points =
                working.floors[building][level].spaces[selected].rings[ring];
              points[vertex] = point;
              if (vertex === 0) points[points.length - 1] = point;
            })
          }
        />
        <aside className="space-y-4">
          <label className="block">
            Space{" "}
            <select
              className="w-full rounded border p-2"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Select a space</option>
              {Object.values(floor.spaces).map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name ||
                    `Unassigned ${space.source_handles.join(",") || space.id.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </label>
          {room && (
            <>
              <label className="block">
                Room name{" "}
                <input
                  className="w-full rounded border p-2"
                  value={room.name}
                  onChange={(event) =>
                    edit((working) => {
                      working.floors[building][level].spaces[selected].name =
                        event.target.value;
                    })
                  }
                />
              </label>
              <label className="block">
                Room type{" "}
                <select
                  className="w-full rounded border p-2"
                  value={room.type}
                  onChange={(event) =>
                    edit((working) => {
                      working.floors[building][level].spaces[selected].type =
                        event.target.value as typeof room.type;
                    })
                  }
                >
                  {RoomTypes.map((type) => (
                    <option key={type} value={type}>
                      {type || "Unknown / unassigned"}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm">
                Source handles: {room.source_handles.join(", ") || "none"}
              </p>
              <ul className="list-inside list-disc text-sm text-amber-800">
                {room.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              <label className="block">
                Use source tag{" "}
                <select
                  value=""
                  onChange={(event) => {
                    const label = floor.labels[Number(event.target.value)];
                    if (label)
                      edit((working) => {
                        const space =
                          working.floors[building][level].spaces[selected];
                        space.name = label.text;
                        space.label_position = label.position;
                      });
                  }}
                >
                  <option value="">Choose after inspecting drawing</option>
                  {floor.labels.map((label, index) => (
                    <option
                      key={`${label.source_handle}-${index}`}
                      value={index}
                    >
                      {label.text}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <h2 className="font-semibold">Source coverage</h2>
          <ul className="list-inside list-disc text-sm text-amber-800">
            {floor.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
          <p className="text-sm">
            A source space may span physical rooms or have phantom boundaries.
            Door, connector and POI evidence still needs review.
          </p>
        </aside>
      </div>
    </main>
  );
}
