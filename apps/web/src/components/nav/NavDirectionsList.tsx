/** biome-ignore-all lint/style/useNamingConvention: TODO: use right naming convention */
import enterIconBlack from "@/assets/icons/nav/directions-list/enter-black.svg";
import enterIconGrey from "@/assets/icons/nav/directions-list/enter-grey.svg";
import enterIconWhite from "@/assets/icons/nav/directions-list/enter-white.svg";
import exitIconBlack from "@/assets/icons/nav/directions-list/exit-black.svg";
import exitIconGrey from "@/assets/icons/nav/directions-list/exit-grey.svg";
import exitIconWhite from "@/assets/icons/nav/directions-list/exit-white.svg";
import forwardArrowIconBlack from "@/assets/icons/nav/directions-list/forward-arrow-black.svg";
import forwardArrowIconGrey from "@/assets/icons/nav/directions-list/forward-arrow-grey.svg";
import forwardArrowIconWhite from "@/assets/icons/nav/directions-list/forward-arrow-white.svg";
import leftArrowIconBlack from "@/assets/icons/nav/directions-list/left-arrow-black.svg";
import leftArrowIconGrey from "@/assets/icons/nav/directions-list/left-arrow-grey.svg";
import leftArrowIconWhite from "@/assets/icons/nav/directions-list/left-arrow-white.svg";
import rightArrowIconBlack from "@/assets/icons/nav/directions-list/right-arrow-black.svg";
import rightArrowIconGrey from "@/assets/icons/nav/directions-list/right-arrow-grey.svg";
import rightArrowIconWhite from "@/assets/icons/nav/directions-list/right-arrow-white.svg";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useBoundStore } from "@/store/index.ts";
import { metresToFeet } from "@/utils/distanceUtils";

interface DirectionIconSet {
  Black: string;
  Green: string;
  Grey: string;
}

const DirectionIcons: Record<string, DirectionIconSet> = {
  Forward: {
    Black: forwardArrowIconBlack,
    Green: forwardArrowIconWhite,
    Grey: forwardArrowIconGrey,
  },
  Left: {
    Black: leftArrowIconBlack,
    Green: leftArrowIconWhite,
    Grey: leftArrowIconGrey,
  },
  Right: {
    Black: rightArrowIconBlack,
    Green: rightArrowIconWhite,
    Grey: rightArrowIconGrey,
  },
  Enter: {
    Black: enterIconBlack,
    Green: enterIconWhite,
    Grey: enterIconGrey,
  },
  Exit: {
    Black: exitIconBlack,
    Green: exitIconWhite,
    Grey: exitIconGrey,
  },
};

const textColors = {
  Black: "text-black",
  Green: "text-button-green-600",
  Grey: "text-light-grey",
};

const NavDirectionsList = () => {
  interface DirectionProps {
    distance: number;
    action: string;
    id: string;
  }

  const instructions = useBoundStore((state) => state.navInstructions) ?? [];
  const instructionIndex = useBoundStore((state) => state.navInstructionIndex);
  const selectedPath = useBoundStore((state) => state.selectedPath);

  const { navPaths } = useNavPaths();

  const renderDirectionEntry = (
    { distance, action, id }: DirectionProps,
    i: number,
  ) => {
    const color =
      instructionIndex === i
        ? "Green"
        : i > instructionIndex
          ? "Black"
          : "Grey";

    const buildingCode = navPaths?.[selectedPath]?.path.path.find(
      (n) => n.id === id,
    )?.floor?.buildingCode;

    const buildingName = buildingCode === "outside" ? "Outside" : buildingCode;

    return (
      <>
        {i === instructionIndex && (
          <div className="mx-1 mt-2 h-[3px] rounded-full bg-button-green" />
        )}
        <div className="flex items-center px-3 pt-2" key={i}>
          <img
            src={DirectionIcons[action]?.[color]}
            alt="forward"
            width={26}
            height={26}
            className="mr-5"
          />
          <div
            className={`mr-5 font-inter font-medium text-[1.5rem] ${textColors[color]}`}
          >
            {metresToFeet(distance)} ft
          </div>

          <div
            className={`ml-auto font-inter font-medium text-[1.125rem] ${textColors[color]}`}
          >
            {buildingName}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col px-[14px]">
      {instructions.map(
        (instruction, i) =>
          i < instructions.length - 1 &&
          renderDirectionEntry(
            {
              distance: instruction.distance,
              action: instruction.action,
              id: instruction.nodeId,
            },
            i,
          ),
      )}
    </div>
  );
};

export { NavDirectionsList };
