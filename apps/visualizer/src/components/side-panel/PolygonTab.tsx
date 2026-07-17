import type { Polygon, Rooms } from "@cmumaps/common";
import { simplify } from "@turf/simplify";

import { toast } from "react-toastify";

import useSavePolygonEdit from "../../hooks/useSavePolygonEdit.ts";
import useValidatedFloorParams from "../../hooks/useValidatedFloorParams.ts";
import {
  POLYGON_ADD_VERTEX,
  POLYGON_DELETE_VERTEX,
  setMode,
} from "../../store/features/modeSlice.ts";
import { setRingIndex } from "../../store/features/polygonSlice.ts";
import { useAppDispatch, useAppSelector } from "../../store/hooks.ts";
import { RED_BUTTON_STYLE } from "../info-display/shared/TableCell.tsx";
import SidePanelButton from "./SidePanelButton.tsx";
import NodeSizeSlider from "./SizeSlider.tsx";

interface Props {
  floorCode: string;
  rooms: Rooms;
}

const PolygonTab = ({ floorCode, rooms }: Props) => {
  const dispatch = useAppDispatch();

  const ringIndex = useAppSelector((state) => state.polygon.ringIndex);
  const { roomId } = useValidatedFloorParams(floorCode);

  const savePolygonEdit = useSavePolygonEdit(floorCode, roomId);

  if (!roomId) {
    return null;
  }

  const polygon = rooms[roomId].polygon;

  const renderInteriorButton = () => {
    const addHole = async () => {
      const newPolygon: Polygon = JSON.parse(JSON.stringify(polygon));
      newPolygon.coordinates.push([]);
      await savePolygonEdit(newPolygon);
      dispatch(setRingIndex(newPolygon.coordinates.length - 1));
    };

    const deleteHole = () => {
      const newPolygon: Polygon = JSON.parse(JSON.stringify(polygon));
      newPolygon.coordinates.splice(ringIndex, 1);
      dispatch(setRingIndex(ringIndex - 1));
      savePolygonEdit(newPolygon);
    };

    if (ringIndex === 0) {
      return (
        <SidePanelButton
          text="Add Hole"
          handleClick={() => addHole()}
          style="px-2 py-1"
        />
      );
    }

    return (
      <SidePanelButton
        text="Delete Hole"
        handleClick={() => deleteHole()}
        style="px-2 py-1"
      />
    );
  };

  const simplifyPolygon = async () => {
    const newPolygon: Polygon = simplify(polygon, {
      tolerance: 5,
      highQuality: true,
    });
    await savePolygonEdit(newPolygon);
    toast.success("Polygon simplified!");
  };

  const deletePolygon = async () => {
    const newPolygon: Polygon = {
      type: "Polygon",
      coordinates: [[]],
    };
    savePolygonEdit(newPolygon);
  };

  return (
    <div className="mr-2 ml-2 space-y-4">
      <div className="flex space-x-3">
        <select
          value={ringIndex}
          onChange={(e) => dispatch(setRingIndex(Number(e.target.value)))}
          className="rounded bg-white"
        >
          {polygon.coordinates.map((_, index) => (
            <option value={index} key={index}>
              {index === 0 ? "Exterior" : `Hole ${index}`}
            </option>
          ))}
        </select>

        {renderInteriorButton()}
      </div>

      <SidePanelButton
        text="Add Vertex"
        handleClick={() => dispatch(setMode(POLYGON_ADD_VERTEX))}
      />

      <SidePanelButton
        text="Delete Vertex"
        handleClick={() => dispatch(setMode(POLYGON_DELETE_VERTEX))}
      />

      <SidePanelButton
        text="Simplify Polygon"
        handleClick={() => simplifyPolygon()}
      />

      <NodeSizeSlider text="Vertex" />

      <SidePanelButton
        text="Delete Polygon"
        handleClick={() => deletePolygon()}
        style={RED_BUTTON_STYLE}
      />
    </div>
  );
};

export default PolygonTab;
