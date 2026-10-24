import type { Graph, Rooms } from "@cmumaps/common";
import { useNavigate } from "@tanstack/react-router";

import { BiHide } from "react-icons/bi";
import { toast } from "react-toastify";

import { setMst } from "../../store/features/dataSlice.ts";
import { ADD_DOOR_NODE, ADD_NODE, setMode } from "../../store/features/modeSlice.ts";
import { useAppDispatch } from "../../store/hooks.ts";
import { calcMst } from "../../utils/graphUtils.ts";
import QuestionCircle from "../shared/QuestionCircle.tsx";
import SidePanelButton from "./SidePanelButton.tsx";
import NodeSizeSlider from "./SizeSlider.tsx";

interface Props {
  floorCode: string;
  graph: Graph;
  rooms: Rooms;
}

const GraphTab = ({ graph, rooms }: Props) => {
  const navigate = useNavigate({ from: "/floors/$floorCode" });
  const dispatch = useAppDispatch();

  const renderAddNodeButtonsRow = () => (
    <>
      <SidePanelButton text="Add Node" handleClick={() => dispatch(setMode(ADD_NODE))} />
      <SidePanelButton text="Add Door Node" handleClick={() => dispatch(setMode(ADD_DOOR_NODE))} />
    </>
  );

  const renderDoorAsGraphRow = () => (
    <div className="flex">
      <p className="py-1">Doors are</p>
      <SidePanelButton
        text="Nodes"
        handleClick={() => toast.warn("Unimplemented!")}
        style="ml-2 px-2 py-1 border"
      />
      <SidePanelButton
        text="Edges"
        handleClick={() => toast.warn("Unimplemented!")}
        style="ml-2 px-2 py-1 border"
      />
    </div>
  );

  const renderMstRow = () => (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-2">
        <SidePanelButton
          text="Calculate MST"
          handleClick={() => calcMst(graph, rooms, navigate, dispatch)}
        />
        <BiHide
          size={25}
          className="cursor-pointer text-gray-600 hover:text-gray-800"
          onClick={() => dispatch(setMst(null))}
        />
      </div>
      <QuestionCircle
        url="https://en.wikipedia.org/wiki/Minimum_spanning_tree"
        style="text-blue-900"
      />
    </div>
  );

  return (
    <div className="mr-2 ml-2 space-y-4">
      {renderAddNodeButtonsRow()}
      {renderDoorAsGraphRow()}
      {renderMstRow()}
      <SidePanelButton
        text="Remove Overlapping Nodes"
        handleClick={() => toast.warn("Unimplemented!")}
      />
      <NodeSizeSlider text="Node" />
    </div>
  );
};

export default GraphTab;
