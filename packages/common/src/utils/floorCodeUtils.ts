/**
 * Extract the building code associated with the floor code.
 *
 * @param floorCode (e.g: GHC-4)
 * @returns The building code associated with the floor code (e.g: GHC)
 */
export const extractBuildingCode = (floorCode: string) => floorCode.split("-")[0];

/**
 * Extract the floor level associated with the floor code.
 *
 * @param floorCode (e.g: GHC-4)
 * @returns The floor level associated with the floor code (e.g: 4)
 */
export const extractFloorLevel = (floorCode: string) => floorCode.split("-")[1];
