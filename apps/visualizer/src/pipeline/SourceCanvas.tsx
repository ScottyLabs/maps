import { useRef, useState } from "react";
import type { Point, WorkingFloor } from "./api";

interface Props {
  floor: WorkingFloor;
  selected: string;
  select: (id: string) => void;
  moveLabel: (point: Point) => void;
  moveVertex: (ring: number, vertex: number, point: Point) => void;
}

export default function SourceCanvas({
  floor,
  selected,
  select,
  moveLabel,
  moveVertex,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<"label" | [number, number] | null>(null);
  const spaces = Object.values(floor.spaces);
  const points = spaces.flatMap((room) => room.rings.flat());
  const [bounds] = useState(() => {
    const minX = Math.min(...points.map((p) => p.x)) - 2;
    const maxY = Math.max(...points.map((p) => p.y)) + 2;
    const width = Math.max(...points.map((p) => p.x)) - minX + 2;
    const height = maxY - Math.min(...points.map((p) => p.y)) + 2;
    return `${minX} ${-maxY} ${width} ${height}`;
  });
  const toPoint = (event: React.PointerEvent): Point | undefined => {
    const matrix = svg.current?.getScreenCTM()?.inverse();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix,
    );
    return { x: point.x, y: -point.y };
  };
  if (!points.length)
    return <p>No valid space boundaries. Inspect capture warnings.</p>;
  return (
    <svg
      ref={svg}
      aria-label="Source drawing in metres"
      role="img"
      viewBox={bounds}
      className="h-[75vh] w-full touch-none rounded border bg-slate-50"
      onPointerMove={(event) => {
        if (drag === null) return;
        const point = toPoint(event);
        if (!point) return;
        if (drag === "label") moveLabel(point);
        else moveVertex(drag[0], drag[1], point);
      }}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      {spaces.map((room) => (
        <g key={room.id}>
          <path
            d={room.rings
              .map(
                (ring) => `M${ring.map((p) => `${p.x},${-p.y}`).join(" L")} Z`,
              )
              .join(" ")}
            fill={
              room.id === selected
                ? "#bfdbfe"
                : room.warnings.length
                  ? "#fef3c7"
                  : "#e2e8f0"
            }
            fillRule="evenodd"
            stroke="#64748b"
            strokeWidth={0.04}
            role="button"
            tabIndex={0}
            aria-label={`Select room ${room.name || room.source_handles.join(",") || room.id}`}
            onClick={() => select(room.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") select(room.id);
            }}
          />
          {room.name && (
            <text
              x={room.label_position.x}
              y={-room.label_position.y}
              fontSize={0.35}
              textAnchor="middle"
              pointerEvents="none"
            >
              {room.name}
            </text>
          )}
        </g>
      ))}
      {floor.labels
        .filter((label) => label.candidates.length !== 1)
        .map((label, index) => (
          <text
            key={`${label.source_handle}-${index}`}
            x={label.position.x}
            y={-label.position.y}
            fontSize={0.3}
            fill="#b45309"
            pointerEvents="none"
          >
            {label.text} ?
          </text>
        ))}
      {floor.spaces[selected]?.rings.map((ring, ringIndex) =>
        ring.slice(0, -1).map((point, vertex) => (
          <circle
            key={`${ringIndex}-${vertex}`}
            cx={point.x}
            cy={-point.y}
            r={0.1}
            fill="#2563eb"
            onPointerDown={(event) => {
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDrag([ringIndex, vertex]);
            }}
          />
        )),
      )}
      {floor.spaces[selected] && (
        <circle
          cx={floor.spaces[selected].label_position.x}
          cy={-floor.spaces[selected].label_position.y}
          r={0.2}
          fill="#dc2626"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDrag("label");
          }}
        />
      )}
    </svg>
  );
}
