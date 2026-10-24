import { InfoCard } from "@/components/info-cards/wrapper/InfoCard.tsx";
import { Searchbar } from "@/components/toolbar/Searchbar.tsx";

interface Props {
  mapRef: React.RefObject<mapkit.Map | null>;
}

const MobileToolbar = ({ mapRef }: Props) => (
  <>
    <div style={{ maxHeight: "calc(100dvh - 0.5rem)" }} className="fixed top-8 flex w-full px-5">
      <div className="flex w-full flex-col overflow-hidden py-2">
        <Searchbar mapRef={mapRef} />
      </div>
    </div>
    <div className="fixed w-full">
      <InfoCard mapRef={mapRef} />
    </div>
  </>
);

export { MobileToolbar };
