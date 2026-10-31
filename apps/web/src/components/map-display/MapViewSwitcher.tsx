import { toast } from "react-toastify";
import { env } from "@/env.ts";
import { track } from "@/lib/analytics.ts";
import { useBoundStore } from "@/store/index.ts";
import { MAP_VIEW_OPTIONS } from "./mapViewModes.ts";

const MapViewSwitcher = () => {
  const mapViewMode = useBoundStore((state) => state.mapViewMode);
  const setMapViewMode = useBoundStore((state) => state.setMapViewMode);

  const hasGoogle3dKey = Boolean(env.GOOGLE_MAPS_API_KEY);

  return (
    <div className="fixed top-5 right-5 z-50 rounded-xl bg-white p-1 shadow-gray-500 shadow-md">
      <div className="grid grid-cols-2 gap-1 lg:grid-cols-4">
        {MAP_VIEW_OPTIONS.map((option) => {
          const isSelected = option.mode === mapViewMode;
          const isDisabled =
            option.mode === "photorealistic3d" && !hasGoogle3dKey;

          return (
            <button
              key={option.mode}
              type="button"
              className={`rounded-lg px-2 py-1.5 font-medium text-[0.70rem] transition-colors lg:px-3 lg:text-xs ${isSelected ? "bg-background-brand-primary-enabled text-white" : "bg-white text-foreground-neutral-secondary"} ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-background-brand-secondary-enabled"}`}
              onClick={() => {
                if (isDisabled) {
                  toast.error(
                    "Google Maps 3D is unavailable. Set GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY.",
                  );
                  return;
                }
                if (!isSelected) {
                  track("map_view_changed", { mode: option.mode });
                }
                setMapViewMode(option.mode);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { MapViewSwitcher };
