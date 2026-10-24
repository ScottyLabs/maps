import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import env from "../../env";

export interface BaseMutationArg {
  floorCode: string;
  batchId: string | null;
  // batchId is for undo/redo a group of edits
  // if null, it won't be added to the history
}

export const apiSlice = createApi({
  reducerPath: "api",
  tagTypes: ["Graph", "Rooms", "Pois"],
  baseQuery: fetchBaseQuery({
    baseUrl: `${env.VITE_SERVER_URL}/`,
    credentials: "include",
  }),
  endpoints: () => ({}),
});
