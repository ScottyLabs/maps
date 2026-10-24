import type { CreatePoiPayload, DeletePoiPayload, UpdatePoiPayload } from "@cmumaps/websocket";

import { toast } from "react-toastify";

import {
  buildCreatePoiEditPair,
  buildDeletePoiEditPair,
  buildUpdatePoiEditPair,
} from "../features/history/historyPoiUtils.ts";
import { addEditToHistory } from "../features/history/historySlice.ts";
import { getSocketId } from "../middleware/webSocketMiddleware.ts";
import type { AppDispatch, RootState } from "../store.ts";
import { apiSlice, type BaseMutationArg } from "./apiSlice.ts";
import { handleQueryError } from "./errorHandler.ts";
import { floorDataApiSlice } from "./floorDataApiSlice.ts";

export type CreatePoiArg = BaseMutationArg & CreatePoiPayload;
export type DeletePoiArg = BaseMutationArg & DeletePoiPayload;
export type UpdatePoiArg = BaseMutationArg & UpdatePoiPayload;

export const createPoi =
  (floorCode: string, { poiId, poiInfo }: CreatePoiPayload) =>
  (dispatch: AppDispatch) =>
    dispatch(
      floorDataApiSlice.util.updateQueryData("getFloorPois", floorCode, (draft) => {
        draft[poiId] = poiInfo;
      }),
    );

export const deletePoi =
  (floorCode: string, { poiId }: DeletePoiPayload) =>
  (dispatch: AppDispatch) =>
    dispatch(
      floorDataApiSlice.util.updateQueryData("getFloorPois", floorCode, (draft) => {
        delete draft[poiId];
      }),
    );

export const updatePoi =
  (floorCode: string, { poiId, poiType }: UpdatePoiPayload) =>
  (dispatch: AppDispatch) =>
    dispatch(
      floorDataApiSlice.util.updateQueryData("getFloorPois", floorCode, (draft) => {
        draft[poiId].type = poiType;
      }),
    );

export const poiApiSlice = apiSlice.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    createPoi: builder.mutation<Response, CreatePoiArg>({
      query: ({ poiId, poiInfo }) => ({
        url: `/pois/${poiId}`,
        method: "POST",
        body: { poiInfo },
        headers: { "X-Socket-ID": getSocketId() },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { floorCode, poiId, poiInfo, batchId } = arg;
          // add to history
          if (batchId) {
            const editPair = buildCreatePoiEditPair(batchId, arg);
            dispatch(addEditToHistory(editPair));
          }
          // optimistic update
          const { undo } = dispatch(createPoi(floorCode, { poiId, poiInfo }));
          handleQueryError(queryFulfilled, undo);
        } catch (e) {
          toast.error("Check the Console for detailed error.");
          console.error(e);
        }
      },
    }),

    deletePoi: builder.mutation<Response, DeletePoiArg>({
      query: ({ poiId }) => ({
        url: `/pois/${poiId}`,
        method: "DELETE",
        headers: { "X-Socket-ID": getSocketId() },
      }),
      async onQueryStarted(arg, { getState, dispatch, queryFulfilled }) {
        try {
          const { floorCode, poiId, batchId } = arg;
          // add to history
          if (batchId) {
            const getStore = getState as () => RootState;
            const editPair = await buildDeletePoiEditPair(batchId, arg, getStore, dispatch);
            dispatch(addEditToHistory(editPair));
          }
          // optimistic update
          const { undo } = dispatch(deletePoi(floorCode, { poiId }));
          handleQueryError(queryFulfilled, undo);
        } catch (e) {
          toast.error("Check the Console for detailed error.");
          console.error(e);
        }
      },
    }),
    updatePoi: builder.mutation<Response, UpdatePoiArg>({
      query: ({ poiId, poiType }) => ({
        url: `/pois/${poiId}/type`,
        method: "PUT",
        body: { poiType },
        headers: { "X-Socket-ID": getSocketId() },
      }),
      async onQueryStarted(arg, { getState, dispatch, queryFulfilled }) {
        try {
          const { floorCode, poiId, poiType, batchId } = arg;
          // add to history
          if (batchId) {
            const getStore = getState as () => RootState;
            const editPair = await buildUpdatePoiEditPair(batchId, arg, getStore, dispatch);
            dispatch(addEditToHistory(editPair));
          }
          // optimistic update
          const { undo } = dispatch(updatePoi(floorCode, { poiId, poiType }));
          handleQueryError(queryFulfilled, undo);
        } catch (e) {
          toast.error("Check the Console for detailed error.");
          console.error(e);
        }
      },
    }),
  }),
});

export const { useCreatePoiMutation, useDeletePoiMutation, useUpdatePoiMutation } = poiApiSlice;
