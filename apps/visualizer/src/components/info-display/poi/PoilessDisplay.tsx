import {
  extractBuildingCode,
  extractFloorLevel,
  pdfCoordsToGeoCoords,
  type PoiInfo,
} from "@cmumaps/common";
import { v4 as uuidv4 } from "uuid";

import {
  useGetFloorGraphQuery,
  useGetFloorPlacementQuery,
} from "../../../store/api/floorDataApiSlice.ts";
import { useCreatePoiMutation } from "../../../store/api/poiApiSlice.ts";
import InfoDisplayButton from "../shared/InfoDisplayButton.tsx";

interface Props {
  floorCode: string;
  nodeId: string;
}

const PoilessDisplay = ({ floorCode, nodeId }: Props) => {
  const [createPoi] = useCreatePoiMutation();
  const { data: graph } = useGetFloorGraphQuery(floorCode);
  const { data: placement } = useGetFloorPlacementQuery(floorCode);

  const handleCreatePoi = async () => {
    const node = graph?.[nodeId];
    if (!node || !placement) {
      return;
    }
    const { latitude, longitude } = pdfCoordsToGeoCoords(placement)(node.pos);
    const poiId = uuidv4();
    const poiInfo: PoiInfo = {
      type: "",
      latitude,
      longitude,
      buildingCode: extractBuildingCode(floorCode),
      floorLevel: extractFloorLevel(floorCode),
    };
    const batchId = uuidv4();
    await createPoi({ floorCode, poiId, poiInfo, batchId });
  };

  return <InfoDisplayButton text="Create POI" handleClick={handleCreatePoi} />;
};

export default PoilessDisplay;
