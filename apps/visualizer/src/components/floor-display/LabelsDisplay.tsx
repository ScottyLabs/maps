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
}

const LabelsDisplay = ({ floorCode, rooms }: Props) => {
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

  return Object.entries(rooms).map(([roomId, room]) => {
    // selected if it is edit label mode and it is the label of the selected room or the room of the label is connected by the selected door
    const selected = editRoomLabel && selectedRoomId === roomId;
    //   (idSelected.type == DOOR &&
    //     doors[idSelected.id].roomIds.includes(roomId));

    const draggable = editRoomLabel && selected;

    // don't show label when not showing all labels and not selected
    if (!showLabels && !selected) {
      return null;
    }

    const handleOnDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      const roomInfo: Partial<RoomInfo> = {
        labelPosition: {
          x: Number((e.target.x() + width / 2).toFixed(2)),
          y: Number((e.target.y() + height).toFixed(2)),
        },
      };
      updateRoom({ floorCode, roomId, roomInfo, batchId: uuidv4() });
    };

    return (
      <Group
        x={room.labelPosition.x - width / 2}
        y={room.labelPosition.y - height}
        key={roomId}
        onMouseEnter={(e) => setCursor(e, "pointer")}
        onMouseLeave={(e) => setCursor(e, "default")}
        onClick={() => navigate({ to: ".", search: { roomId } })}
        draggable={draggable}
        onDragEnd={handleOnDragEnd}
      >
        <Path fill={selected ? "orange" : "indigo"} data={path} />
        <Rect width={Number(width)} height={Number(height)} />
        <Text text={room.name} y={height + 2} />
      </Group>
    );
  });
};

export default LabelsDisplay;
