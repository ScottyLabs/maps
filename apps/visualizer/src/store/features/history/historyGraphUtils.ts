import type { Graph } from "@cmumaps/common";

import type {
  CreateEdgeAcrossFloorsArg,
  CreateEdgeArg,
  DeleteEdgeAcrossFloorsArg,
  DeleteEdgeArg,
} from "../../api/edgeApiSlice.ts";
import { floorDataApiSlice } from "../../api/floorDataApiSlice.ts";
import type { CreateNodeArg, DeleteNodeArg, UpdateNodeArg } from "../../api/nodeApiSlice.ts";
import type { AppDispatch, RootState } from "../../store.ts";
import type { Edit, EditPair } from "./historyTypes.ts";

const getGraph = async (
  floorCode: string,
  getStore: () => RootState,
  dispatch: AppDispatch,
): Promise<Graph> => {
  let nodes = floorDataApiSlice.endpoints.getFloorGraph.select(floorCode)(getStore()).data;

  if (!nodes) {
    nodes = await dispatch(floorDataApiSlice.endpoints.getFloorGraph.initiate(floorCode)).unwrap();
  }

  return nodes;
};

export const buildCreateNodeEditPair = (batchId: string, arg: CreateNodeArg): EditPair => {
  const { floorCode, nodeId } = arg;
  const edit: Edit = {
    endpoint: "createNode",
    arg: { ...arg, batchId: null },
  };
  const reverseEdit: Edit = {
    endpoint: "deleteNode",
    arg: { floorCode, nodeId, batchId: null },
  };
  return { batchId, edit, reverseEdit };
};

export const buildDeleteNodeEditPair = async (
  batchId: string,
  arg: DeleteNodeArg,
  getStore: () => RootState,
  dispatch: AppDispatch,
): Promise<EditPair> => {
  const { floorCode, nodeId } = arg;
  const edit: Edit = {
    endpoint: "deleteNode",
    arg: { ...arg, batchId: null },
  };

  const nodes = await getGraph(floorCode, getStore, dispatch);
  const reverseEdit: Edit = {
    endpoint: "createNode",
    arg: { floorCode, nodeId, nodeInfo: nodes[nodeId], batchId: null },
  };

  return { batchId, edit, reverseEdit };
};

export const buildUpdateNodeEditPair = async (
  batchId: string,
  arg: UpdateNodeArg,
  getStore: () => RootState,
  dispatch: AppDispatch,
): Promise<EditPair> => {
  const { floorCode, nodeId } = arg;
  const edit: Edit = {
    endpoint: "updateNode",
    arg: { ...arg, batchId: null },
  };

  const nodes = await getGraph(floorCode, getStore, dispatch);
  const reverseEdit: Edit = {
    endpoint: "updateNode",
    arg: { floorCode, nodeId, nodeInfo: nodes[nodeId], batchId: null },
  };

  return { batchId, edit, reverseEdit };
};

export const getNodesInRoom = async (
  floorCode: string,
  roomId: string,
  getStore: () => RootState,
  dispatch: AppDispatch,
): Promise<string[]> => {
  const graph = await getGraph(floorCode, getStore, dispatch);
  const nodes = [];
  for (const nodeId in graph) {
    if (graph[nodeId].roomId === roomId) {
      nodes.push(nodeId);
    }
  }

  return nodes;
};

export const buildCreateEdgeEditPair = (batchId: string, arg: CreateEdgeArg): EditPair => {
  const edit: Edit = {
    endpoint: "createEdge",
    arg: { ...arg, batchId: null },
  };
  const reverseEdit: Edit = {
    endpoint: "deleteEdge",
    arg: { ...arg, batchId: null },
  };
  return { batchId, edit, reverseEdit };
};

export const buildDeleteEdgeEditPair = (batchId: string, arg: DeleteEdgeArg): EditPair => {
  const edit: Edit = {
    endpoint: "deleteEdge",
    arg: { ...arg, batchId: null },
  };
  const reverseEdit: Edit = {
    endpoint: "createEdge",
    arg: { ...arg, batchId: null },
  };
  return { batchId, edit, reverseEdit };
};

export const buildCreateEdgeAcrossFloorsEditPair = (
  batchId: string,
  arg: CreateEdgeAcrossFloorsArg,
): EditPair => {
  const edit: Edit = {
    endpoint: "createEdgeAcrossFloors",
    arg: { ...arg, batchId: null },
  };
  const reverseEdit: Edit = {
    endpoint: "deleteEdgeAcrossFloors",
    arg: { ...arg, batchId: null },
  };
  return { batchId, edit, reverseEdit };
};

export const buildDeleteEdgeAcrossFloorsEditPair = (
  batchId: string,
  arg: DeleteEdgeAcrossFloorsArg,
): EditPair => {
  const edit: Edit = {
    endpoint: "deleteEdgeAcrossFloors",
    arg: { ...arg, batchId: null },
  };
  const reverseEdit: Edit = {
    endpoint: "createEdgeAcrossFloors",
    arg: { ...arg, batchId: null },
  };
  return { batchId, edit, reverseEdit };
};
