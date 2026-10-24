import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { FaArrowDown, FaArrowUp } from "react-icons/fa";
import useFloorInfo from "../../hooks/useFloorInfo.ts";
import { useGetBuildingFloorsQuery } from "../../store/api/buildingApiSlice.ts";

interface Props {
  floorCode: string;
}

const FloorSwitcher = ({ floorCode }: Props) => {
  const [fullDisplayMode, setFullDisplayMode] = useState<boolean>(false);
  const { buildingCode, floorLevel: floorLevelSelected } = useFloorInfo(floorCode);

  const { data: floorLevels } = useGetBuildingFloorsQuery(buildingCode);

  if (!floorLevels) {
    return;
  }

  const renderFullDisplayMode = () =>
    floorLevels.map((floorLevel) => (
      <td key={floorLevel} className="border border-black">
        <Link
          to="/floors/$floorCode"
          params={{ floorCode: `${buildingCode}-${floorLevel}` }}
          className={`cursor-pointer px-4 ${floorLevel === floorLevelSelected ? "font-bold" : ""}`}
          onClick={() => {
            // exit full display mode in case clicking on the same floor level
            setFullDisplayMode(false);
          }}
        >
          {" "}
          {floorLevel}
        </Link>
      </td>
    ));

  const renderNotFullDisplayMode = () => {
    const index = floorLevels.indexOf(floorLevelSelected);

    const renderDownArrow = () => (
      <td className="border-black border-x">
        {index !== 0 ? (
          <Link
            to="/floors/$floorCode"
            params={{ floorCode: `${buildingCode}-${floorLevels[index - 1]}` }}
            className="flex h-full w-full cursor-pointer items-center p-1"
          >
            <FaArrowDown />
          </Link>
        ) : (
          <div className="flex h-full w-full items-center p-1 text-gray-400">
            <FaArrowDown />
          </div>
        )}
      </td>
    );

    const renderFloorLevelCell = () => (
      <td>
        <button
          type="button"
          className="cursor-pointer text-lg"
          onClick={() => setFullDisplayMode(true)}
        >
          <div className="px-2 text-center">{floorLevelSelected}</div>
          <div className="flex justify-center">
            {floorLevels.map((floorLevel) => (
              <div
                key={floorLevel}
                className={`m-[1px] h-1 w-1 rounded-full ${floorLevel === floorLevelSelected ? "bg-black" : "bg-gray-400"}`}
              />
            ))}
          </div>
        </button>
      </td>
    );

    const renderUpArrow = () => (
      <td className="border-black border-l">
        {index !== floorLevels.length - 1 ? (
          <Link
            to="/floors/$floorCode"
            params={{ floorCode: `${buildingCode}-${floorLevels[index + 1]}` }}
            className="flex h-full w-full cursor-pointer items-center p-1"
          >
            <FaArrowUp />
          </Link>
        ) : (
          <div className="flex h-full w-full items-center p-1 text-gray-400">
            <FaArrowUp />
          </div>
        )}
      </td>
    );

    return (
      <>
        <td className="flex border-black p-1">
          <p className="m-0 flex items-center px-1">Floor Switcher:</p>
        </td>
        {renderDownArrow()}
        {renderFloorLevelCell()}
        {renderUpArrow()}
      </>
    );
  };

  return (
    <div className="fixed bottom-2 left-1/2 z-50 -translate-x-1/2">
      <div className="rounded border border-black bg-gray-50">
        <table>
          <tbody>
            <tr className="flex">
              {fullDisplayMode ? renderFullDisplayMode() : renderNotFullDisplayMode()}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FloorSwitcher;
