import type { Floor } from "@cmumaps/common";
import { Annotation } from "mapkit-react";
import { $api } from "@/api/client.ts";
import { getFloorCode } from "@/utils/floorUtils.ts";
import { getPoiTypeStyle } from "./poiTypeStyles.tsx";

interface Props {
  floor: Floor;
}

const PoiOverlay = ({ floor }: Props) => {
  const floorCode = getFloorCode(floor);
  const { data: pois } = $api.useQuery(
    "get",
    "/api/floors/{floorCode}/pois",
    { params: { path: { floorCode: floorCode ?? "" } } },
    { enabled: Boolean(floorCode) },
  );

  if (!pois) {
    return null;
  }

  return Object.entries(pois).map(([poiId, poi]) => {
    const { background, Icon } = getPoiTypeStyle(poi.type);
    return (
      <Annotation
        key={poiId}
        latitude={poi.latitude}
        longitude={poi.longitude}
        displayPriority="required"
      >
        <div
          title={poi.type || "POI"}
          className="flex size-5 items-center justify-center rounded-full text-white shadow"
          style={{ background }}
        >
          <Icon className="size-3" />
        </div>
      </Annotation>
    );
  });
};

export { PoiOverlay };
