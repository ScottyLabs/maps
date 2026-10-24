import type { Buildings, GeoCoordinate, RoomType } from "@cmumaps/common";
import { prisma } from "../../../prisma/index.ts";
import { buildingService } from "../../services/buildingService.ts";
import { parseQuery } from "./parse.ts";
import type { Document, FloorPlans, SearchIndex } from "./types.ts";

export function buildingToDocument({
  id,
  name,
  code,
  labelPosition,
}: {
  id: string;
  name: string;
  code: string;
  labelPosition: GeoCoordinate;
}): { doc: Document; terms: string[] } {
  const doc: Document = {
    id,
    nameWithSpace: name,
    fullNameWithSpace: name,
    labelPosition,
    type: "building",
    alias: code,
    numTerms: 0,
  };
  const terms = [
    ...parseQuery(name),
    ...parseQuery(code),
    ...parseQuery(id),
    ...parseQuery(doc.alias),
    ...parseQuery(doc.nameWithSpace),
    ...parseQuery(doc.fullNameWithSpace),
  ];
  doc.numTerms = terms.length;
  return { doc, terms };
}

export function roomToDocument({
  id,
  name,
  buildingName,
  buildingCode,
  alias,
  labelPosition,
  roomType,
}: {
  id: string;
  name: string;
  buildingName: string;
  buildingCode: string;
  alias: string;
  labelPosition: GeoCoordinate;
  roomType: RoomType;
}): { doc: Document; terms: string[] } {
  const doc: Document = {
    id,
    nameWithSpace: `${buildingCode} ${name}`,
    fullNameWithSpace: `${buildingName} ${name}`,
    labelPosition,
    type: "room",
    roomType,
    alias,
    numTerms: 0,
  };
  const terms = [
    ...parseQuery(name),
    ...parseQuery(alias),
    ...parseQuery(id),
    ...parseQuery(doc.alias),
    ...parseQuery(doc.nameWithSpace),
    ...parseQuery(doc.fullNameWithSpace),
  ];
  doc.numTerms = terms.length;
  return { doc, terms };
}

export function floorToDocument({
  buildingCode,
  buildingName,
  floorLevel,
  labelPosition,
}: {
  buildingCode: string;
  buildingName: string;
  floorLevel: string;
  labelPosition: GeoCoordinate;
}): { doc: Document; terms: string[] } {
  const floorCode = `${buildingCode}-${floorLevel}`;
  const doc: Document = {
    id: floorCode,
    nameWithSpace: `${buildingCode} ${floorLevel}`,
    fullNameWithSpace: `${buildingName} Floor ${floorLevel}`,
    labelPosition,
    type: "floor",
    floor: {
      buildingCode,
      level: floorLevel,
    },
    alias: floorCode,
    numTerms: 0,
  };

  const terms = [
    ...parseQuery(floorLevel),
    ...parseQuery(floorCode),
    ...parseQuery(`floor ${floorLevel}`),
    ...parseQuery(`${buildingCode} floor ${floorLevel}`),
    ...parseQuery(`${buildingName} floor ${floorLevel}`),
    ...parseQuery(doc.alias),
    ...parseQuery(doc.nameWithSpace),
    ...parseQuery(doc.fullNameWithSpace),
  ];

  doc.numTerms = terms.length;
  return { doc, terms };
}

export async function getFloorplans(database = prisma): Promise<FloorPlans> {
  const allRooms = await database.room.findMany({
    include: {
      aliases: true,
    },
  });

  const floorplans: FloorPlans = {};

  for (const room of allRooms) {
    const { buildingCode, floorLevel } = room;

    // Skip rooms without building code or floor level
    if (!(buildingCode && floorLevel)) continue;

    // Initialize building if not exists
    if (!floorplans[buildingCode]) {
      floorplans[buildingCode] = {};
    }

    // Initialize floor level if not exists
    if (!floorplans[buildingCode][floorLevel]) {
      floorplans[buildingCode][floorLevel] = {};
    }

    // Map room data to the expected structure
    floorplans[buildingCode][floorLevel][room.roomId] = {
      name: room.name,
      labelPosition: {
        latitude: room.labelLatitude,
        longitude: room.labelLongitude,
      },
      type: room.type as RoomType,
      id: room.roomId,
      floor: {
        buildingCode,
        level: floorLevel,
      },
      alias: room.aliases.map((a) => a.alias),
    };
  }

  return floorplans;
}

/**
 * Convert all buildings to documents and collect their search terms.
 */
export function buildingsToDocuments(buildingMap: Buildings): {
  documents: Record<string, Document>;
  termsByDoc: Record<string, string[]>;
} {
  const documents: Record<string, Document> = {};
  const termsByDoc: Record<string, string[]> = {};

  for (const [buildingCode, building] of Object.entries(buildingMap)) {
    const { doc, terms } = buildingToDocument({
      id: buildingCode,
      name: building.name,
      code: building.code,
      labelPosition: {
        latitude: building.labelLatitude,
        longitude: building.labelLongitude,
      },
    });

    documents[buildingCode] = doc;
    termsByDoc[buildingCode] = terms;
  }

  return { documents, termsByDoc };
}

function insertTerms(index: SearchIndex, terms: string[], docId: string): void {
  // Count term frequencies
  const termFreqs = new Map<string, number>();
  for (const term of terms) {
    termFreqs.set(term, (termFreqs.get(term) || 0) + 1);
  }

  // Insert each term into the index
  for (const [term, freq] of termFreqs.entries()) {
    if (!index[term]) {
      index[term] = [];
    }
    index[term].push([docId, freq]);
  }
}

export function buildSearchIndex(
  floorplans: FloorPlans,
  buildingMap: Buildings,
) {
  const startTime = Date.now();
  const index: SearchIndex = {};

  // Process buildings first using batch function
  const { documents, termsByDoc } = buildingsToDocuments(buildingMap);
  for (const [docId, terms] of Object.entries(termsByDoc)) {
    insertTerms(index, terms, docId);
  }
  console.log(`Built ${Object.keys(documents).length} building documents`);

  // Add floor documents so users can navigate directly to a floor.
  let floorDocumentCount = 0;
  for (const [buildingCode, building] of Object.entries(buildingMap)) {
    for (const floorLevel of building.floors) {
      const { doc, terms } = floorToDocument({
        buildingCode,
        buildingName: building.name,
        floorLevel,
        labelPosition: {
          latitude: building.labelLatitude,
          longitude: building.labelLongitude,
        },
      });
      const docId = `floor:${doc.id}`;
      documents[docId] = doc;
      insertTerms(index, terms, docId);
      floorDocumentCount++;
    }
  }
  console.log(`Built ${floorDocumentCount} floor documents`);

  // Iterate over buildings in floorplans
  for (const [buildingCode, buildingPlan] of Object.entries(floorplans)) {
    const buildingInfo = buildingMap[buildingCode];
    const buildingName = buildingInfo?.name || "Outside";

    // Iterate over floors
    for (const [floorId, roomPlan] of Object.entries(buildingPlan)) {
      // Iterate over rooms
      for (const [roomId, room] of Object.entries(roomPlan)) {
        const { doc, terms } = roomToDocument({
          id: roomId,
          name: room.name,
          buildingName,
          buildingCode,
          alias: room.alias.join(", "),
          labelPosition: room.labelPosition,
          roomType: room.type,
        });

        const docId = `${buildingCode}-${floorId}-${roomId}`;
        documents[docId] = doc;
        insertTerms(index, terms, docId);
      }
    }
  }

  const elapsedTime = Date.now() - startTime;
  console.log(`Search index built in ${elapsedTime}ms`);
  console.log(`Built ${Object.keys(documents).length} documents`);

  return {
    index,
    documents,
  };
}

export async function getSearchContext(database = prisma) {
  const [buildings, floorplans] = await Promise.all([
    buildingService.getBuildings(database),
    getFloorplans(database),
  ]);
  const { index, documents } = await buildSearchIndex(floorplans, buildings);
  return { index, documents, buildings, floorplans };
}
