import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface BaseMutationArg {
  floorCode: string;
  batchId: string | null;
  // batchId is for undo/redo a group of edits if null, it won't be added to the history
}

export const apiSlice = createApi({
  reducerPath: "api",
  tagTypes: ["Graph", "Rooms", "Pois"],
  baseQuery: fetchBaseQuery({ baseUrl: "/api", credentials: "include" }),
  endpoints: () => ({}),
});
