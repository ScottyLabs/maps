import type { Pois } from "@cmumaps/common";

import CopyIdRow from "../shared/CopyIdRow.tsx";
import TableLayout from "../shared/TableLayout.tsx";
import PoiDeleteButton from "./PoiDeleteButton.tsx";
import PoiEditTypeRow from "./PoiEditTypeRow.tsx";

interface Props {
  floorCode: string;
  poiId: string;
  pois: Pois;
}

const PoiInfoDisplay = ({ floorCode, poiId, pois }: Props) => {
  const poiInfo = pois[poiId];

  return (
    <>
      <TableLayout>
        <CopyIdRow text="POI ID" id={poiId} />
        <PoiEditTypeRow floorCode={floorCode} poiId={poiId} poiInfo={poiInfo} />
      </TableLayout>
      <PoiDeleteButton floorCode={floorCode} poiId={poiId} />
    </>
  );
};

export default PoiInfoDisplay;
