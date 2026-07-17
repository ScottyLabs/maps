import type { Pois } from "@cmumaps/common";

import { floorDataApiSlice } from "../../api/floorDataApiSlice.ts";
import type {
  CreatePoiArg,
  DeletePoiArg,
  UpdatePoiArg,
} from "../../api/poiApiSlice.ts";
import type { AppDispatch, RootState } from "../../store.ts";
import type { Edit, EditPair } from "./historyTypes.ts";

const getPois = async (
  floorCode: string,
  getStore: () => RootState,
  dispatch: AppDispatch,
): Promise<Pois> => {
  let pois = floorDataApiSlice.endpoints.getFloorPois.select(floorCode)(
    getStore(),
  ).data;

  if (!pois) {
    pois = await dispatch(
      floorDataApiSlice.endpoints.getFloorPois.initiate(floorCode),
    ).unwrap();
  }

  return pois;
};

export const buildCreatePoiEditPair = (
  batchId: string,
  arg: CreatePoiArg,
): EditPair => {
  const { floorCode, poiId } = arg;
  const edit: Edit = {
    endpoint: "createPoi",
    arg: { ...arg, batchId: null },
  };
  const reverseEdit: Edit = {
    endpoint: "deletePoi",
    arg: { floorCode, poiId, batchId: null },
  };
  return { batchId, edit, reverseEdit };
};

export const buildDeletePoiEditPair = async (
  batchId: string,
  arg: DeletePoiArg,
  getStore: () => RootState,
  dispatch: AppDispatch,
): Promise<EditPair> => {
  const { floorCode, poiId } = arg;
  const edit: Edit = {
    endpoint: "deletePoi",
    arg: { ...arg, batchId: null },
  };

  const pois = await getPois(floorCode, getStore, dispatch);
  const reverseEdit: Edit = {
    endpoint: "createPoi",
    arg: { floorCode, poiId, poiInfo: pois[poiId], batchId: null },
  };

  return { batchId, edit, reverseEdit };
};

export const buildUpdatePoiEditPair = async (
  batchId: string,
  arg: UpdatePoiArg,
  getStore: () => RootState,
  dispatch: AppDispatch,
): Promise<EditPair> => {
  const { floorCode, poiId } = arg;
  const edit: Edit = {
    endpoint: "updatePoi",
    arg: { ...arg, batchId: null },
  };

  const pois = await getPois(floorCode, getStore, dispatch);
  const reverseEdit: Edit = {
    endpoint: "updatePoi",
    arg: { floorCode, poiId, poiType: pois[poiId].type, batchId: null },
  };

  return { batchId, edit, reverseEdit };
};
