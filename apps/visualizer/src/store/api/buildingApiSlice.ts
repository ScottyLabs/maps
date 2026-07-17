import type { Building, BuildingMetadata, Buildings } from "@cmumaps/common";
import { apiSlice } from "./apiSlice.ts";

export const buildingApiSlice = apiSlice.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getBuildings: builder.query<Buildings, void>({
      query: () => "buildings",
    }),
    getBuilding: builder.query<Building, string>({
      query: (id) => `buildings/${id}`,
    }),
    getBuildingsMetadata: builder.query<BuildingMetadata[], void>({
      query: () => "buildings/metadata",
    }),
    getBuildingName: builder.query<string, string>({
      query: (id) => `buildings/${id}/name`,
    }),
    getDefaultFloor: builder.query<string, string>({
      query: (id) => `buildings/${id}/defaultFloor`,
    }),
    getBuildingFloors: builder.query<string[], string>({
      query: (id) => `buildings/${id}/floors`,
    }),
  }),
});

export const {
  useGetBuildingsQuery,
  useGetBuildingQuery,
  useGetBuildingsMetadataQuery,
  useGetBuildingNameQuery,
  useGetDefaultFloorQuery,
  useGetBuildingFloorsQuery,
} = buildingApiSlice;
