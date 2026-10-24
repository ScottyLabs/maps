import { v4 as uuidv4 } from "uuid";

import { useDeletePoiMutation } from "../../../store/api/poiApiSlice.ts";
import InfoDisplayButton from "../shared/InfoDisplayButton.tsx";
import { RED_BUTTON_STYLE } from "../shared/TableCell.tsx";

interface Props {
  floorCode: string;
  poiId: string;
}

const PoiDeleteButton = ({ floorCode, poiId }: Props) => {
  const [deletePoi] = useDeletePoiMutation();
  const deletePoiHelper = () => deletePoi({ floorCode, poiId, batchId: uuidv4() });

  return (
    <div className="mt-2 flex flex-row-reverse">
      <InfoDisplayButton
        text="Delete POI"
        handleClick={deletePoiHelper}
        style={`${RED_BUTTON_STYLE} text-base`}
      />
    </div>
  );
};

export default PoiDeleteButton;
