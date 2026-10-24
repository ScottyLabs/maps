import { extractBuildingCode } from "@cmumaps/common";
import { Link } from "@tanstack/react-router";
import { useGetBuildingNameQuery } from "../../store/api/buildingApiSlice.ts";

interface Props {
  floorCode: string;
}

const NavBar = ({ floorCode }: Props) => {
  const buildingCode = extractBuildingCode(floorCode);
  const { data: name } = useGetBuildingNameQuery(buildingCode);

  return (
    <nav className="absolute inset-0 z-50 h-min bg-gray-800 p-4">
      <div className="flex justify-between">
        <div className="font-bold text-white text-xl">CMU Maps Data Visualization</div>
        <div className="absolute top-4 left-1/2 h-7 -translate-x-1/2 text-white text-xl">
          {name ? name : floorCode}
        </div>
        <Link to="/" className="mr-2 cursor-pointer text-lg text-white hover:text-gray-400">
          Back
        </Link>
      </div>
    </nav>
  );
};

export default NavBar;
