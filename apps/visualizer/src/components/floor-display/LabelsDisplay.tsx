import type { Graph, RoomInfo, Rooms } from "@cmumaps/common";
import { useNavigate } from "@tanstack/react-router";
import type Konva from "konva";
import { useMemo } from "react";
import { TfiLocationPin } from "react-icons/tfi";
import { Group, Path, Rect, Text } from "react-konva";
import { v4 as uuidv4 } from "uuid";
import useValidatedFloorParams from "../../hooks/useValidatedFloorParams";
import { useUpdateRoomMutation } from "../../store/api/roomApiSlice";
import { useAppSelector } from "../../store/hooks";
import { setCursor } from "../../utils/canvasUtils";

interface Props {
  floorCode: string;
  graph: Graph;
  rooms: Rooms;
  scale: number;
}

// Label sizes in screen pixels, independent of zoom
const PIN_HEIGHT = 24;
const FONT_SIZE = 12;

const LabelsDisplay = ({ floorCode, rooms, scale }: Props) => {
  const navigate = useNavigate({ from: "/floors/$floorCode" });
  const { roomId: selectedRoomId } = useValidatedFloorParams(floorCode);

  const [updateRoom] = useUpdateRoomMutation();

  const editRoomLabel = useAppSelector((state) => state.ui.editRoomLabel);
  const showLabels = useAppSelector((state) => state.visibility.showLabels);

  // label icon
  const { width, height, path } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const viewBox = TfiLocationPin({}).props.attr.viewBox.split(" ");
    const width = Number(viewBox[2]);
    const height = Number(viewBox[3]);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const path = TfiLocationPin({}).props.children[1].props.d;

    return { width, height, path };
  }, []);

  // The pin icon is drawn at its native size, so scale it to PIN_HEIGHT
  const pinScale = PIN_HEIGHT / height;
  const pinWidth = width * pinScale;

  return Object.entries(rooms).map(([roomId, room]) => {
    // selected if it is edit label mode and it is the label of the selected room
    // or the room of the label is connected by the selected door
    const selected = editRoomLabel && selectedRoomId === roomId;
    //   (idSelected.type == DOOR &&
    //     doors[idSelected.id].roomIds.includes(roomId));

    const draggable = editRoomLabel && selected;

    // don't show label when not showing all labels and not selected
    if (!showLabels && !selected) {
      return null;
    }

    const handleOnDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      // The group is positioned at the tip of the pin
      const roomInfo: Partial<RoomInfo> = {
        labelPosition: {
          x: Number(e.target.x().toFixed(2)),
          y: Number(e.target.y().toFixed(2)),
        },
      };
      updateRoom({ floorCode, roomId, roomInfo, batchId: uuidv4() });
    };

    return (
      // Counter the stage zoom so one group unit is one screen pixel
      <Group
        x={room.labelPosition.x}
        y={room.labelPosition.y}
        scaleX={1 / scale}
        scaleY={1 / scale}
        key={roomId}
        onMouseEnter={(e) => setCursor(e, "pointer")}
        onMouseLeave={(e) => setCursor(e, "default")}
        onClick={() => navigate({ to: ".", search: { roomId } })}
        draggable={draggable}
        onDragEnd={handleOnDragEnd}
      >
        <Path
          fill={selected ? "orange" : "indigo"}
          data={path}
          x={-pinWidth / 2}
          y={-PIN_HEIGHT}
          scaleX={pinScale}
          scaleY={pinScale}
        />
        <Rect
          x={-pinWidth / 2}
          y={-PIN_HEIGHT}
          width={pinWidth}
          height={PIN_HEIGHT}
        />
        <Text
          text={room.name}
          x={-pinWidth / 2}
          y={2}
          fontSize={FONT_SIZE}
        />
      </Group>
    );
  });
};

export default LabelsDisplay;
