import type { Placement } from "@cmumaps/common";
import { toast } from "react-toastify";
import { useUpdateFloorPlacementMutation } from "@/store/api/floorDataApiSlice";

interface Props {
  floorCode: string;
  onSave?: () => void;
  placement: Placement;
  setPlacement: (placement: Placement) => void;
}

const PlacementPanel = ({
  floorCode,
  placement,
  setPlacement,
  onSave,
}: Props) => {
  const [updateFloorPlacement] = useUpdateFloorPlacementMutation();

  const renderSliderAndInput = (
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  ) => {
    return (
      <div className="flex w-full items-center gap-2">
        {label}:{" "}
        <input
          className="w-fit cursor-pointer rounded-lg bg-blue-200 px-1"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className="h-2 w-full cursor-pointer justify-center rounded-lg"
        />
      </div>
    );
  };

  const renderScaleControl = () => {
    return renderSliderAndInput("Scale", 1e-9, 2, 1e-9, placement.scale, (e) =>
      setPlacement({
        ...placement,
        scale: Number.parseFloat(e.target.value),
      }),
    );
  };

  const renderAngleControl = () => {
    return renderSliderAndInput("Angle", 0, 360, 0.1, placement.angle, (e) =>
      setPlacement({
        ...placement,
        angle: Number.parseFloat(e.target.value),
      }),
    );
  };

  const renderCenterControl = () => {
    const handleLatitudeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setPlacement({
        ...placement,
        geoCenter: {
          latitude: Number.parseFloat(e.target.value),
          longitude: placement.geoCenter.longitude,
        },
      });
    };

    const handleLongitudeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setPlacement({
        ...placement,
        geoCenter: {
          latitude: placement.geoCenter.latitude,
          longitude: Number.parseFloat(e.target.value),
        },
      });
    };

    const renderInput = (
      label: string,
      value: number,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    ) => {
      return (
        <div>
          {label}:{" "}
          <input
            type="number"
            step={0.000001}
            value={value}
            onChange={onChange}
            className="cursor-pointer rounded-lg bg-blue-200 px-1"
          />
        </div>
      );
    };

    return (
      <>
        {renderInput(
          "Latitude",
          placement.geoCenter.latitude,
          handleLatitudeChange,
        )}
        {renderInput(
          "Longitude",
          placement.geoCenter.longitude,
          handleLongitudeChange,
        )}
      </>
    );
  };

  const renderConfirmButton = () => {
    return (
      <button
        type="button"
        className="cursor-pointer rounded-lg bg-blue-500 px-4 py-2 text-base text-white"
        onClick={() => {
          if (onSave) {
            onSave();
            return;
          }
          toast.info("Saving placement...");
          updateFloorPlacement({
            floorCode: floorCode,
            placement: placement,
          });
        }}
      >
        {onSave ? "Save placement to JSON" : "Confirm Placement"}
      </button>
    );
  };

  return (
    <div className="fixed top-1/2 z-50 -translate-y-1/2">
      <div className="h-66 w-fit rounded-lg border bg-slate-400 shadow-lg">
        <h1 className="pt-2 text-center text-xl underline">Placement</h1>
        <div className="mt-3 flex flex-col gap-3 px-2 text-lg">
          {renderScaleControl()}
          {renderAngleControl()}
          {renderCenterControl()}
          {renderConfirmButton()}
        </div>
      </div>
    </div>
  );
};

export default PlacementPanel;
