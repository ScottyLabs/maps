/**
 * Building codes that are publicly accessible without authentication.
 * Currently only CUC (Cohon University Center) is publicly accessible.
 */
const PUBLIC_BUILDING_CODES = ["CUC"];

/**
 * Checks if a building is publicly accessible without authentication.
 * @param buildingCode - The building code to check
 * @returns true if the building is publicly accessible
 */
export const isPublicBuilding = (buildingCode: string | undefined | null): boolean => {
  if (!buildingCode) return false;
  return PUBLIC_BUILDING_CODES.includes(buildingCode);
};
