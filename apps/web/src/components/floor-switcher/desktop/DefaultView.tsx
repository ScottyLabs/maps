import type { Building, Floor } from "@cmumaps/common";
import { IoIosArrowDown, IoIosArrowUp } from "react-icons/io";
import { DefaultViewButton } from "@/components/floor-switcher/desktop/DefaultViewButton.tsx";
import { useBoundStore } from "@/store/index.ts";

interface Props {
  building: Building;
  floor: Floor;
  setShowFloorPicker: (show: boolean) => void;
}

const DefaultView = ({ building, floor, setShowFloorPicker }: Props) => {
  const focusFloor = useBoundStore((state) => state.focusFloor);
  const floorIndex = building.floors.indexOf(floor.level);

  const renderDownArrow = () => {
    const canGoDown = floorIndex > 0;
    const handleClick = () => {
      const floorLevel = building.floors[floorIndex - 1];
      if (floorLevel) {
        focusFloor({ buildingCode: building.code, level: floorLevel });
      }
    };

    return (
      <DefaultViewButton disabled={!canGoDown} handleClick={handleClick}>
        <IoIosArrowDown />
      </DefaultViewButton>
    );
  };

  const renderFloorLevelCell = () => {
    const renderEllipses = () => (
      <div className="flex justify-center">
        {building.floors.map((floorLevel) => (
          <div
            key={floorLevel}
            className={`m-0.25 h-1 w-1 rounded-full ${floorLevel === floor.level ? "bg-black" : "bg-gray-400"}`}
          />
        ))}
      </div>
    );

    const disabled = building.floors.length === 1;
    const handleClick = () => {
      setShowFloorPicker(true);
    };

    return (
      <DefaultViewButton disabled={disabled} handleClick={handleClick}>
        <div>
          {building.floors[floorIndex]}
          {renderEllipses()}
        </div>
      </DefaultViewButton>
    );
  };

  const renderUpArrow = () => {
    const canGoUp = floorIndex < building.floors.length - 1;
    const handleClick = () => {
      const floorLevel = building.floors[floorIndex + 1];
      if (floorLevel) {
        focusFloor({ buildingCode: building.code, level: floorLevel });
      }
    };

    return (
      <DefaultViewButton disabled={!canGoUp} handleClick={handleClick}>
        <IoIosArrowUp />
      </DefaultViewButton>
    );
  };

  return (
    <>
      <p className="mx-2 flex items-center">{building.name}</p>
      {renderDownArrow()}
      {renderFloorLevelCell()}
      {renderUpArrow()}
    </>
  );
};

export { DefaultView };
