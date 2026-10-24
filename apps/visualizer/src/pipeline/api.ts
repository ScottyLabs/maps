import type { GeoCoordinate, RoomType } from "@cmumaps/common";
import env from "../env";

export interface Point {
  x: number;
  y: number;
}
export interface WorkingSpace {
  id: string;
  source_handles: string[];
  rings: Point[][];
  name: string;
  type: RoomType;
  aliases: string[];
  label_position: Point;
  warnings: string[];
}
export interface WorkingFloor {
  fms_id: string;
  source_unit: string;
  spaces: Record<string, WorkingSpace>;
  labels: {
    text: string;
    position: Point;
    source_handle: string | null;
    candidates: string[];
  }[];
  warnings: string[];
}
export interface ReferencePlacement {
  reference_floor: string;
  origin: Point;
  latitude: number;
  longitude: number;
  angle: number;
  scale: number;
}
export interface WorkingDataset {
  version: 1;
  capture_digest: string;
  floors: Record<string, Record<string, WorkingFloor>>;
  anchors: Record<string, ReferencePlacement>;
  buildings: Record<
    string,
    {
      name: string;
      label_position: GeoCoordinate;
      shapes: GeoCoordinate[][];
      source_url: string;
      source_abbreviation: string | null;
    }
  >;
  outdoor: {
    source_url: string;
    query: string;
    artifact_sha256: string;
    artifact_path: string;
    nodes: Record<string, GeoCoordinate>;
    ways: { id: string; nodes: string[]; tags: Record<string, string> }[];
    pois: Record<string, unknown>;
    warnings: string[];
  } | null;
}
export interface WorkspaceView {
  revision: string;
  working: WorkingDataset;
}

export async function pipeline<T>(
  operation: string,
  workspace = "",
  body = {},
): Promise<T> {
  const response = await fetch(`${env.VITE_SERVER_URL}/pipeline`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, workspace, ...body }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.message ?? result.error ?? "Pipeline request failed",
    );
  return result;
}

export interface BuildReport {
  revision: string;
  working_revision: string;
  directory: string;
  warnings: string[];
  counts: Record<string, number>;
  alignment: Record<
    string,
    {
      reference_floor: string;
      span_metres: number;
      matches: {
        reference_space: string;
        candidate_space: string;
        overlap: number;
        boundary_error_metres: number;
      }[];
    }
  >;
}
