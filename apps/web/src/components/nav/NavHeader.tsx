/** biome-ignore-all lint/style/useNamingConvention: TODO: use right naming convention */
import { useEffect, useRef, useState } from "react";
import backButton from "@/assets/icons/nav/nav-overlay/back-button.svg";
import destinationIcon from "@/assets/icons/nav/nav-overlay/destination.svg";
import dotsIcon from "@/assets/icons/nav/nav-overlay/dots.svg";
import enterIcon from "@/assets/icons/nav/nav-overlay/header-instructions/enter.svg";
import exitIcon from "@/assets/icons/nav/nav-overlay/header-instructions/exit.svg";
import forwardArrowIcon from "@/assets/icons/nav/nav-overlay/header-instructions/forward-arrow.svg";
import leftArrowIcon from "@/assets/icons/nav/nav-overlay/header-instructions/left-arrow.svg";
import rightArrowIcon from "@/assets/icons/nav/nav-overlay/header-instructions/right-arrow.svg";
import nextInstructionIcon from "@/assets/icons/nav/nav-overlay/next-instruction.svg";
import startIcon from "@/assets/icons/nav/nav-overlay/start.svg";
import { SearchResults } from "@/components/toolbar/SearchResults.tsx";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useBoundStore } from "@/store/index.ts";
import { metresToFeet } from "@/utils/distanceUtils";

interface NavHeaderProps {
  isNavigating: boolean;
  startNav: () => void;
  listShown: boolean;
  mapRef: React.RefObject<mapkit.Map | null>;
  children?: React.ReactNode;
}

const NavHeader = ({ isNavigating, mapRef, children }: NavHeaderProps) => {
  const setSearchTarget = useBoundStore((state) => state.setSearchTarget);
  const searchTarget = useBoundStore((state) => state.searchTarget);

  const instructionIcons: Record<string, string> = {
    Left: leftArrowIcon,
    Right: rightArrowIcon,
    Forward: forwardArrowIcon,
    Enter: enterIcon,
    Exit: exitIcon,
  };

  const instructionTitles: Record<string, string> = {
    Left: "Turn Left",
    Right: "Turn Right",
    Forward: "Stay Straight",
    Arrive: "Arrived",
    Enter: "Enter",
    Exit: "Exit",
  };

  const {
    isNavOpen,
    srcName,
    dstName,
    dstShortName,
    srcType,
    dstType,
    setSrc,
  } = useNavPaths();

  const instructions = useBoundStore((state) => state.navInstructions) ?? [];
  const instructionIndex = useBoundStore((state) => state.navInstructionIndex);

  const setInstructionIndex = useBoundStore(
    (state) => state.setNavInstructionIndex,
  );

  const distance = metresToFeet(instructions[instructionIndex]?.distance ?? 0);
  const action = instructions[instructionIndex]?.action;

  const srcInputRef = useRef<HTMLInputElement>(null);
  const dstInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isNavOpen) {
      setSearchTarget(undefined);
    }
  });

  const renderChooseHeader = () => (
    <div className="bg-white">
      <div className="flex gap-2 px-4 pt-5">
        <button
          type="button"
          onClick={() => {
            setSrc(null);
          }}
        >
          <img src={backButton} alt="back" />
        </button>
        <span className="flex items-center pb-0.5 font-inter font-semibold text-[0.875rem] text-foreground-neutral-tertiary">
          Navigation
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 px-4 pb-6">
        <div className="flex flex-col items-center gap-1">
          <img src={startIcon} alt="start" />
          <img src={dotsIcon} alt="nav-selection" />
          <img src={destinationIcon} alt="dest" />
        </div>
        <div className="flex w-full flex-col gap-[10px]">
          <input
            className={`${srcType === "User" ? "text-background-brand-primary-enabled" : "text-foreground-neutral-primary"} h-10 w-full rounded-[10px] border border-stroke-neutral-1 px-4 font-inter font-semibold text-[0.875rem]`}
            placeholder="Starting Location"
            defaultValue={srcName}
            onFocus={(event) => {
              setSearchTarget("nav-src");
              setSearchQuery(event.target.value);
            }}
            onClick={() => {
              srcInputRef.current?.select();
            }}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            ref={srcInputRef}
            value={searchTarget === "nav-src" ? searchQuery : srcName}
          />
          <input
            className={`${dstType === "User" ? "text-background-brand-primary-enabled" : "text-foreground-neutral-primary"} h-10 w-full rounded-[10px] border border-stroke-neutral-1 px-4 font-inter font-semibold text-[0.875rem]`}
            placeholder="Destination"
            defaultValue={dstName}
            onFocus={(event) => {
              setSearchTarget("nav-dst");
              setSearchQuery(event.target.value);
            }}
            onClick={() => {
              dstInputRef.current?.select();
            }}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            ref={dstInputRef}
            value={searchTarget === "nav-dst" ? searchQuery : dstName}
          />
        </div>
      </div>
    </div>
  );

  const renderNavigateHeader = () =>
    action === "Arrive" ? renderArrivedHeader() : renderInstructionHeader();

  const renderInstructionHeader = () => (
    <div className="flex flex-col bg-button-green">
      <div className="flex h-[111px] gap-4 px-8 pt-5 pb-3">
        <img
          src={instructionIcons[action || "Forward"]}
          alt="forward"
          className="my-2"
        />
        <div className="w-full flex-col">
          <div className="font-inter font-lato font-semibold text-[2.25rem] text-white">
            {distance === 0
              ? "<1ft"
              : `${action === "Forward" ? "for" : ""} ${distance} ft`}
          </div>
          <div className="-translate-y-2 pl-[2px] font-lato font-semibold text-[15px] text-white">
            {instructionTitles[action || "Forward"]}
          </div>
        </div>
        <div className="flex self-center pb-5 font-inter font-semibold text-[17px] text-white">
          {dstShortName}
        </div>
      </div>
      <div className="flex justify-between bg-[#0C8436] px-5 py-4">
        <button
          className={`flex ${instructionIndex > 0 ? "" : "disabled opacity-0"}`}
          type="button"
          onClick={() => {
            setInstructionIndex(Math.max(0, instructionIndex - 1));
          }}
        >
          <img
            className="w-6 rotate-180"
            src={nextInstructionIcon}
            alt="next instruction"
          />
          <div className="px-2 font-inter font-semibold text-[1rem] text-white">
            Prev
          </div>
        </button>
        <button
          className={`flex ${instructionIndex < instructions.length - 1 ? "" : "disabled opacity-0"}`}
          type="button"
          onClick={() => {
            setInstructionIndex(
              Math.min(instructions.length - 1, instructionIndex + 1),
            );
          }}
        >
          <div className="px-2 font-inter font-semibold text-[1rem] text-white">
            Next
          </div>
          <img
            src={nextInstructionIcon}
            className="w-6"
            alt="next instruction"
          />
        </button>
      </div>
    </div>
  );

  const renderArrivedHeader = () => (
    <div className="flex flex-col bg-background-brand-primary-enabled">
      <div className="flex h-[111px] justify-center bg-background-brand-primary-enabled px-8 pt-6 pb-3">
        <div className="flex-col">
          <div className="flex justify-center font-lato font-semibold text-[2rem] text-white">
            You Have Arrived
          </div>
          <div className="flex justify-center font-lato font-semibold text-[1rem] text-white">
            Near {dstName}
          </div>
        </div>
      </div>
      <div className="flex justify-between bg-blue-brand-700 px-5 py-4">
        <button
          className={`flex ${instructionIndex > 0 ? "" : "disabled opacity-0"}`}
          type="button"
          onClick={() => {
            setInstructionIndex(Math.max(0, instructionIndex - 1));
          }}
        >
          <img
            className="rotate-180"
            src={nextInstructionIcon}
            alt="next instruction"
          />
          <div className="px-2 font-bold font-lato text-[1rem] text-white">
            Prev
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isNavigating ? renderNavigateHeader() : renderChooseHeader()}
      {children}
      {!isNavigating && searchTarget && searchQuery.length > 0 && (
        <>
          <hr className="mb-2 border-stroke-neutral-1" />
          <div className="h-100 overflow-y-scroll">
            <SearchResults mapRef={mapRef} searchQuery={searchQuery} />
          </div>
        </>
      )}
    </>
  );
};

export { NavHeader };
