import { type PoiInfo, type PoiType, PoiTypes } from "@cmumaps/common";
import type { SingleValue } from "react-select";
import { v4 as uuidv4 } from "uuid";

import { useUpdatePoiMutation } from "../../../store/api/poiApiSlice.ts";
import SelectTypeCell from "../shared/SelectTypeCell.tsx";

interface Props {
  floorCode: string;
  poiId: string;
  poiInfo: PoiInfo;
}

const PoiEditTypeRow = ({ floorCode, poiId, poiInfo }: Props) => {
  const [updatePoi] = useUpdatePoiMutation();

  const handleChange = (
    newValue: SingleValue<{
      value: string | undefined;
      label: string | undefined;
    }>,
  ) => {
    if (newValue?.value && newValue?.value !== poiInfo.type) {
      const poiType = newValue.value as PoiType;
      updatePoi({ floorCode, poiId, poiType, batchId: uuidv4() });
    }
  };

  return (
    <tr>
      <td className="border pr-4 pl-4">Type</td>
      <SelectTypeCell
        key={poiId}
        value={poiInfo.type}
        typeList={PoiTypes as readonly string[]}
        handleChange={handleChange}
      />
    </tr>
  );
};

export default PoiEditTypeRow;
