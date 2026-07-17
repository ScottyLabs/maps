import {
  type RoomInfo,
  type Rooms,
  type RoomType,
  RoomTypes,
} from "@cmumaps/common";
import { useDispatch } from "react-redux";
import type { SingleValue } from "react-select";
import { v4 as uuidv4 } from "uuid";

import {
  useDeleteRoomMutation,
  useUpdateRoomMutation,
} from "../../../store/api/roomApiSlice.ts";
import {
  selectEditPolygon,
  toggleEditPolygon,
} from "../../../store/features/modeSlice.ts";
import {
  SidePanelTabIndex,
  setSidePanelActiveTabIndex,
  toggleEditRoomLabel,
} from "../../../store/features/uiSlice.ts";
import { useAppSelector } from "../../../store/hooks.ts";
import CopyIdRow from "../shared/CopyIdRow.tsx";
import EditCell from "../shared/EditCell.tsx";
import InfoDisplayButton from "../shared/InfoDisplayButton.tsx";
import SelectTypeCell from "../shared/SelectTypeCell.tsx";
import TableCell, { RED_BUTTON_STYLE } from "../shared/TableCell.tsx";
import TableLayout from "../shared/TableLayout.tsx";

interface Props {
  floorCode: string;
  roomId: string;
  rooms: Rooms;
}

const RoomInfoDisplay = ({ floorCode, roomId, rooms }: Props) => {
  const dispatch = useDispatch();
  const editPolygon = useAppSelector(selectEditPolygon);
  const editRoomLabel = useAppSelector((state) => state.ui.editRoomLabel);

  const room = rooms[roomId];
  const [updateRoom] = useUpdateRoomMutation();
  const [deleteRoom] = useDeleteRoomMutation();

  const handleSaveHelper = (roomInfo: RoomInfo) => {
    const batchId = uuidv4();
    updateRoom({ floorCode, roomId, roomInfo, batchId });
  };

  const renderEditNameRow = () => {
    const handleSaveName = async (editedValue: string | undefined) => {
      if (editedValue) {
        const newRoomInfo = { ...room, name: editedValue };
        handleSaveHelper(newRoomInfo);
      }
    };

    return (
      <tr>
        <TableCell text="Name" />
        <EditCell
          property="name"
          value={room.name}
          handleSave={handleSaveName}
        />
      </tr>
    );
  };

  const renderEditTypeRow = () => {
    const handleChange = (
      newValue: SingleValue<{
        value: string | undefined;
        label: string | undefined;
      }>,
    ) => {
      if (newValue?.value && newValue?.value !== room.type) {
        const newRoomInfo = { ...room, type: newValue.value as RoomType };
        handleSaveHelper(newRoomInfo);
      }
    };

    return (
      <tr>
        <TableCell text="Type" />
        <SelectTypeCell
          key={roomId}
          value={room.type}
          typeList={RoomTypes as readonly string[]}
          handleChange={handleChange}
        />
      </tr>
    );
  };

  const renderToggleEditPolygonButton = () => {
    return (
      <td className="text-center">
        <button
          type="button"
          className="my-2 w-28 rounded bg-slate-500 px-4 py-1 text-sm text-white hover:bg-slate-700"
          onClick={() => {
            dispatch(setSidePanelActiveTabIndex(SidePanelTabIndex.POLYGON));
            dispatch(toggleEditPolygon());
          }}
        >
          {editPolygon ? "Finish Editing" : "Edit Room Polygon"}
        </button>
      </td>
    );
  };

  const renderToggleEditLabelButton = () => {
    return (
      <td className="text-center">
        <button
          type="button"
          className="my-2 w-28 rounded bg-slate-500 px-4 py-1 text-sm text-white hover:bg-slate-700"
          onClick={() => dispatch(toggleEditRoomLabel())}
        >
          {editRoomLabel ? "Finish Editing" : "Edit Room Label"}
        </button>
      </td>
    );
  };

  const deleteRoomHelper = () =>
    deleteRoom({ floorCode, roomId, batchId: uuidv4() });

  return (
    <>
      <TableLayout>
        <CopyIdRow text="Room ID" id={roomId} />
        {renderEditNameRow()}
        {renderEditTypeRow()}
        <tr>
          {renderToggleEditPolygonButton()}
          {renderToggleEditLabelButton()}
        </tr>
      </TableLayout>
      <div className="mt-2 flex flex-row-reverse">
        <InfoDisplayButton
          text="Delete Room"
          handleClick={deleteRoomHelper}
          style={`${RED_BUTTON_STYLE} text-base`}
        />
      </div>
    </>
  );
};

export default RoomInfoDisplay;
