import { usePostHog } from "posthog-js/react";
import { useEffect, useRef } from "react";
import { FloorSwitcher } from "@/components/floor-switcher/FloorSwitcher.tsx";
import { LoginModal } from "@/components/login/LoginModal.tsx";
import { MapDisplay } from "@/components/map-display/MapDisplay.tsx";
import { MapViewSwitcher } from "@/components/map-display/MapViewSwitcher.tsx";
import { Toolbar } from "@/components/toolbar/Toolbar.tsx";
import { IconsDisplay } from "@/components/ui-layout/icons-display/IconsDisplay.tsx";
import { MyToastContainer } from "@/components/ui-layout/MyToastContainer.tsx";
import { useUser } from "@/hooks/useUser.ts";
import { useBoundStore } from "@/store/index.ts";
import { PreviewStatus } from "./preview";
import { NavOverlay } from "./components/nav/NavOverlay.tsx";

const App = () => {
  const mapRef = useRef<mapkit.Map | null>(null);

  // Identify PostHog user with user ID
  const user = useUser();
  const posthog = usePostHog();
  useEffect(() => {
    if (user) {
      posthog?.identify(user.id);
    } else {
      posthog?.reset();
    }
  }, [posthog, user]);

  // Set up user position tracking
  const setUserPosition = useBoundStore((state) => state.setUserPosition);
  useEffect(() => {
    navigator.geolocation.watchPosition((position) => {
      setUserPosition(position);
    });
  }, [setUserPosition]);

  return (
    <main className="relative h-dvh overflow-hidden">
      <MapDisplay mapRef={mapRef} />
      <MapViewSwitcher />
      <LoginModal />
      <IconsDisplay />
      <NavOverlay mapRef={mapRef} />
      <FloorSwitcher />
      <Toolbar mapRef={mapRef} />
      <MyToastContainer />
      <PreviewStatus />
    </main>
  );
};

export { App };
