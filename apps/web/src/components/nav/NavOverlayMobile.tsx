/** biome-ignore-all lint/style/useNamingConvention: TODO: use right naming convention */
import { useEffect, useRef, useState } from "react";
import enterIcon from "@/assets/icons/nav/nav-overlay/header-instructions/enter.svg";
import exitIcon from "@/assets/icons/nav/nav-overlay/header-instructions/exit.svg";
import forwardArrowIcon from "@/assets/icons/nav/nav-overlay/header-instructions/forward-arrow.svg";
import leftArrowIcon from "@/assets/icons/nav/nav-overlay/header-instructions/left-arrow.svg";
import rightArrowIcon from "@/assets/icons/nav/nav-overlay/header-instructions/right-arrow.svg";
import { DraggableSheet } from "@/components/info-cards/wrapper/DraggableSheet.tsx";
import { NavCard } from "@/components/nav/NavCard.tsx";
import { NavDirectionsList } from "@/components/nav/NavDirectionsList.tsx";
import { NavHeader } from "@/components/nav/NavHeader.tsx";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useBoundStore } from "@/store/index.ts";
import { metresToFeet } from "@/utils/distanceUtils";

interface NavOverlayMobileProps {
  isNavigating: boolean;
  startNav: () => void;
  mapRef: React.RefObject<mapkit.Map | null>;
}

const NavOverlayMobile = ({
  isNavigating,
  startNav,
  mapRef,
}: NavOverlayMobileProps) => {
  const [listShown, setListShown] = useState(false);

  const { dstShortName } = useNavPaths();

  const [yControl, setYControl] = useState(300);

  const instructions = useBoundStore((state) => state.navInstructions) ?? [];
  const instructionIndex = useBoundStore((state) => state.navInstructionIndex);

  const distance = metresToFeet(instructions[instructionIndex]?.distance ?? 0);
  const action = instructions[instructionIndex]?.action;

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

  const scrollRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: must adjust scroll position once the direction list is shown
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = 44 * (instructionIndex - 1);
  }, [instructionIndex, listShown]);

  useEffect(() => {
    setYControl(isNavigating ? 28 : 0);
  }, [isNavigating]);

  return (
    <>
      <div
        className={`${isNavigating ? "inset-x-3 top-3 rounded-[20px]" : "inset-x-[14px] top-5 rounded-[10px]"} btn-shadow fixed overflow-hidden bg-white`}
      >
        <NavHeader
          isNavigating={isNavigating}
          startNav={startNav}
          listShown={listShown}
          mapRef={mapRef}
        />
      </div>
      {/** biome-ignore lint/nursery/noLeakedRender: TODO: fix the leaked render */}
      {listShown && (
        <>
          <DraggableSheet
            snapPoints={[1, -window.innerHeight]}
            onClose={() => setListShown(false)}
            onCollapse={() => setListShown(false)}
          >
            <div className="mx-4 flex flex-col rounded-xl bg-button-green">
              <div className="flex h-[111px] gap-4 px-8 pt-4 pb-3">
                <img
                  src={instructionIcons[action || "Forward"]}
                  alt="forward"
                  className="my-2"
                />
                <div className="w-full flex-col">
                  <div className="font-inter font-lato font-semibold text-[36px] text-white">
                    {distance === 0
                      ? "<1ft"
                      : `${action === "Forward" ? "for" : ""} ${distance} ft`}
                  </div>
                  <div className="-translate-y-2 pl-[2px] font-lato font-semibold text-[16px] text-white">
                    {instructionTitles[action || "Forward"]}
                  </div>
                </div>
                <div className="flex self-center pb-5 font-inter font-semibold text-[22px] text-white">
                  {dstShortName}
                </div>
              </div>
            </div>
            <div
              className="mb-30 h-auto overflow-y-scroll pb-2"
              ref={scrollRef}
            >
              <NavDirectionsList />
            </div>
          </DraggableSheet>
          <div
            className={`${listShown ? "bg-white" : "bg-transparent"} fixed inset-x-0 bottom-0 h-30`}
          >
            <div className="h-full w-full rounded-t-xl shadow-[0px_-10px_15px_-3px_rgba(0,0,0,0.1)]" />
          </div>
        </>
      )}
      <div
        className={`${isNavigating ? "bottom-10" : "bottom-0"} fixed inset-x-[14px] transition duration-300 ease-in-out`}
        style={{ transform: `translateY(${yControl}px)` }}
      >
        <NavCard
          isNavigating={isNavigating}
          startNav={startNav}
          toggleListShown={() => {
            setListShown(!listShown);
          }}
          listShown={listShown}
        />
      </div>
      ;
    </>
  );
};

export { NavOverlayMobile };
