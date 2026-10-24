import { isMobile } from "react-device-detect";
import navStackIcon from "@/assets/icons/nav/nav-stack.svg";
import accessibleAvailableIcon from "@/assets/icons/nav/route-selection/accessibleAvailable.svg";
import accessibleSelectedIcon from "@/assets/icons/nav/route-selection/accessibleSelected.svg";
import accessibleUnavailableIcon from "@/assets/icons/nav/route-selection/accessibleUnavailable.svg";
import fastestAvailableIcon from "@/assets/icons/nav/route-selection/fastestAvailable.svg";
import fastestSelectedIcon from "@/assets/icons/nav/route-selection/fastestSelected.svg";
import fastestUnavailableIcon from "@/assets/icons/nav/route-selection/fastestUnavailable.svg";
import indoorAvailableIcon from "@/assets/icons/nav/route-selection/indoorAvailable.svg";
import indoorSelectedIcon from "@/assets/icons/nav/route-selection/indoorSelected.svg";
import indoorUnavailableIcon from "@/assets/icons/nav/route-selection/indoorUnavailable.svg";
import outdoorAvailableIcon from "@/assets/icons/nav/route-selection/outdoorAvailable.svg";
import outdoorSelectedIcon from "@/assets/icons/nav/route-selection/outdoorSelected.svg";
import outdoorUnavailableIcon from "@/assets/icons/nav/route-selection/outdoorUnavailable.svg";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useBoundStore } from "@/store/index.ts";
import { metresToFeet } from "@/utils/distanceUtils";

interface NavHeaderProps {
  isNavigating: boolean;
  startNav: () => void;
  toggleListShown?: () => void;
  listShown: boolean;
}

const NavCard = ({
  isNavigating,
  startNav,
  toggleListShown,
  listShown,
}: NavHeaderProps) => {
  const navigationOptions: {
    id: "Fastest" | "Accessible" | "Inside" | "Outside";
    selectedIcon: string;
    availableIcon: string;
    unavailableIcon: string;
  }[] = [
    {
      id: "Fastest",
      selectedIcon: fastestSelectedIcon,
      availableIcon: fastestAvailableIcon,
      unavailableIcon: fastestUnavailableIcon,
    },
    {
      id: "Accessible",
      selectedIcon: accessibleSelectedIcon,
      availableIcon: accessibleAvailableIcon,
      unavailableIcon: accessibleUnavailableIcon,
    },
    {
      id: "Inside",
      selectedIcon: indoorSelectedIcon,
      availableIcon: indoorAvailableIcon,
      unavailableIcon: indoorUnavailableIcon,
    },
    {
      id: "Outside",
      selectedIcon: outdoorSelectedIcon,
      availableIcon: outdoorAvailableIcon,
      unavailableIcon: outdoorUnavailableIcon,
    },
  ];

  const selectedPath = useBoundStore((state) => state.selectedPath);
  const setSelectedPath = useBoundStore((state) => state.setSelectedPath);

  const { navPaths, setSrc, setDst } = useNavPaths();

  const distance = metresToFeet(navPaths?.[selectedPath]?.path.distance ?? 0);
  const time = Math.round((navPaths?.[selectedPath]?.path.distance ?? 0) / 100);
  const endTime = new Date(Date.now() + time * 60 * 1000).toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
  );

  const renderPathInfo = () => (
    <div className="h-9">
      <div className="flex gap-7">
        <div className="flex-col">
          <div className="w-full font-bold text-[min(1.25rem,5vw)] text-black">
            {endTime}
          </div>
          <div className="w-full -translate-y-2">arrival</div>
        </div>
        <div className="flex-col">
          <div className="w-full font-bold text-[min(1.25rem,5vw)] text-black">
            {time}
          </div>
          <div className="w-full -translate-y-2">min</div>
        </div>
        <div className="flex-col">
          <div className="w-full font-bold text-[min(1.25rem,5vw)] text-black">
            {distance}
          </div>
          <div className="w-full -translate-y-2">ft</div>
        </div>
      </div>
    </div>
  );

  const renderChooseCard = () => (
    <div className="relative flex w-full flex-col items-start self-stretch bg-background-brand-secondary-pressed">
      <div className="flex w-full items-center justify-center gap-8 self-stretch px-6 pt-[6px] pb-[6px]">
        {navigationOptions.map((option) => {
          const isAvailable = Boolean(navPaths?.[option.id]);
          const isSelected = option.id === selectedPath;
          return (
            <button
              type="button"
              disabled={!isAvailable}
              onClick={
                isAvailable && !isSelected
                  ? () => setSelectedPath(option.id)
                  : // biome-ignore lint/suspicious/noEmptyBlockStatements: TODO: fix the empty block
                    () => {}
              }
              key={option.id}
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl pt-2 pb-1 ${isSelected ? "bg-[rgba(182,223,253,0.71)]" : ""}`}
            >
              <img
                className="relative h-6 w-6"
                alt={option.id}
                src={
                  isSelected
                    ? option.selectedIcon
                    : isAvailable
                      ? option.availableIcon
                      : option.unavailableIcon
                }
              />

              <div
                className={`relative self-stretch pb-px text-center font-medium text-[10px] text-inter ${
                  isSelected
                    ? "text-[#156588]"
                    : isAvailable
                      ? "text-black"
                      : "text-foreground-neutral-tertiary"
                }`}
              >
                {option.id}
              </div>
            </button>
          );
        })}
      </div>

      <div className="relative flex w-full justify-between self-stretch bg-white pt-6 pr-5 pb-6 pl-5">
        {navPaths?.[selectedPath] ? (
          renderPathInfo()
        ) : (
          <div className="h-9 text-black text-xl">Path unavailable...</div>
        )}

        <button
          type="button"
          className={`${navPaths ? "bg-button-green" : "bg-primary-grey"} inline-flex h-12 w-20 items-center justify-center rounded-full font-medium text-sm`}
          disabled={!navPaths?.[selectedPath]}
          onClick={() => {
            startNav();
          }}
        >
          <span className="text-center font-inter font-semibold text-[20px] text-white">
            GO
          </span>
        </button>
      </div>
    </div>
  );

  const renderNavCard = () => (
    <div className="ml-9 flex justify-between py-6">
      {renderPathInfo()}
      <button
        type="button"
        className="mr-5 inline-flex h-12 w-20 items-center justify-center rounded-full bg-primary-red font-medium text-sm"
        onClick={() => {
          setDst(null);
          setSrc(null);
        }}
      >
        <span className="text-center font-inter font-semibold text-[20px] text-white">
          End
        </span>
      </button>
    </div>
  );

  return (
    <>
      {/** biome-ignore lint/nursery/noLeakedRender: TODO: fix the leaked render */}
      {isNavigating && isMobile && (
        <div className="flex justify-end p-4">
          <button
            type="button"
            hidden={isMobile && listShown}
            className="btn-shadow flex h-12 w-12 rounded-full bg-button-green"
            onClick={toggleListShown}
          >
            <img src={navStackIcon} alt="directions list" className="m-auto" />
          </button>
        </div>
      )}
      <div
        className={`${
          isMobile ? (isNavigating ? "rounded-xl" : "rounded-t-xl") : ""
        } overflow-auto bg-white ${!listShown && "btn-shadow"}`}
      >
        {isNavigating ? renderNavCard() : renderChooseCard()}
      </div>
    </>
  );
};

export { NavCard };
