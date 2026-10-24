import { $api } from "@/api/client.ts";
import { ButtonsRow } from "@/components/info-cards/shared/buttons-row/ButtonsRow.tsx";
import { InfoCardImage } from "@/components/info-cards/shared/media/InfoCardImage.tsx";
import { useIsMobile } from "@/hooks/useIsMobile.ts";
import { useLocationParams } from "@/hooks/useLocationParams.ts";
import { useBoundStore } from "@/store/index.ts";

interface Props {
  mapRef: React.RefObject<mapkit.Map | null>;
}

const BuildingCard = ({ mapRef: _mapRef }: Props) => {
  const isMobile = useIsMobile();
  const isCardCollapsed = useBoundStore((state) => state.isCardCollapsed());
  const { buildingCode } = useLocationParams();
  const { data: buildings } = $api.useQuery("get", "/api/buildings");

  if (!(buildingCode && buildings)) {
    return;
  }

  const building = buildings[buildingCode];
  if (!building) {
    return;
  }

  const renderBuildingImage = () => {
    const url = `/location_images/building_room_images/${building.code}/${building.code}.jpg`;
    return <InfoCardImage url={url} alt={`${building.name} Image`} />;
  };

  return (
    <>
      {!(isCardCollapsed && isMobile) && renderBuildingImage()}
      <h2 className="ml-3 pt-2">
        {building.name} ({building.code})
      </h2>
      <ButtonsRow />
    </>
  );
};

export { BuildingCard };
