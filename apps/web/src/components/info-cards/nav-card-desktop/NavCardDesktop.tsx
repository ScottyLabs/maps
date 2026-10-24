import { useEffect, useRef } from "react";
import { NavCard } from "@/components/nav/NavCard.tsx";
import { NavDirectionsList } from "@/components/nav/NavDirectionsList.tsx";
import { NavHeader } from "@/components/nav/NavHeader.tsx";
import { useBoundStore } from "@/store/index.ts";

interface Props {
  mapRef: React.RefObject<mapkit.Map | null>;
}

const NavCardDesktop = ({ mapRef }: Props) => {
  const startNav = useBoundStore((state) => state.startNav);
  const isNavigating = useBoundStore((state) => state.isNavigating);

  const instructionIndex = useBoundStore((state) => state.navInstructionIndex);

  useEffect(() => {
    console.log("rendering directions list");
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 44 * (instructionIndex - 1);
  }, [instructionIndex]);

  const renderCard = () => (
    <NavCard isNavigating={isNavigating} startNav={startNav} listShown={true} />
  );

  return (
    <div className="shrink-0">
      <div
        className="btn-shadow flex flex-col"
        style={{ boxShadow: "0 4px 6px 0 rgba(0, 0, 0, 0.20)" }}
      >
        <NavHeader isNavigating={isNavigating} startNav={startNav} listShown={true} mapRef={mapRef}>
          {renderCard()}
        </NavHeader>
      </div>
      {isNavigating && (
        <div className="mt-2 h-100 overflow-y-scroll bg-white pb-2" ref={scrollRef}>
          <NavDirectionsList />
        </div>
      )}
    </div>
  );
};

export { NavCardDesktop };
