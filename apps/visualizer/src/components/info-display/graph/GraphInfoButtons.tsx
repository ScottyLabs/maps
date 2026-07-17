import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";

import { useDeleteNodeMutation } from "../../../store/api/nodeApiSlice.ts";
import {
  ADD_EDGE,
  DELETE_EDGE,
  setMode,
} from "../../../store/features/modeSlice.ts";
import { useAppDispatch } from "../../../store/hooks.ts";
import InfoDisplayButton from "../shared/InfoDisplayButton.tsx";
import { RED_BUTTON_STYLE } from "../shared/TableCell.tsx";

interface Props {
  floorCode: string;
  nodeId: string;
}

const GraphInfoButtons = ({ floorCode, nodeId }: Props) => {
  const dispatch = useAppDispatch();
  const [deleteNode] = useDeleteNodeMutation();

  const copyNodeId = () => {
    navigator.clipboard.writeText(nodeId);
    toast.success("Copied!");
  };

  const deleteNodeHelper = () => {
    const batchId = uuidv4();
    deleteNode({ floorCode, nodeId, batchId });
  };

  return (
    <div className="space-y-2">
      <div className="flex space-x-4">
        <InfoDisplayButton text="Copy Node ID" handleClick={copyNodeId} />
        <InfoDisplayButton
          text="Delete Node"
          handleClick={deleteNodeHelper}
          style={RED_BUTTON_STYLE}
        />
      </div>
      <div className="flex space-x-4">
        <InfoDisplayButton
          text="Add Edge"
          handleClick={() => dispatch(setMode(ADD_EDGE))}
        />
        <InfoDisplayButton
          text="Delete Edge"
          handleClick={() => dispatch(setMode(DELETE_EDGE))}
        />
      </div>
    </div>
  );
};

export default GraphInfoButtons;
