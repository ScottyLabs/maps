import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import MyToastContainer from "../../components/shared/MyToastContainer.tsx";
import FloorSwitcher from "../../components/ui-layout/FloorSwitcher.tsx";
import HelpInfo from "../../components/ui-layout/HelpInfo.tsx";
import LiveUserCount from "../../components/ui-layout/LiveUserCount.tsx";
import MainDisplay from "../../components/ui-layout/MainDisplay.tsx";
import ModeDisplay from "../../components/ui-layout/ModeDisplay.tsx";
import NavBar from "../../components/ui-layout/NavBar.tsx";
import ViewSwitch from "../../components/ui-layout/ViewSwitch.tsx";

const floorSearchSchema = z.object({
  nodeId: z.string().optional(),
  roomId: z.string().optional(),
  poiId: z.string().optional(),
});

export const Route = createFileRoute("/floors/$floorCode")({
  validateSearch: zodValidator(floorSearchSchema),
  component: Floor,
});

function Floor() {
  const { floorCode } = Route.useParams();
  return (
    <>
      <NavBar floorCode={floorCode} />
      <LiveUserCount />
      <ViewSwitch floorCode={floorCode} />
      <MainDisplay floorCode={floorCode} />
      <ModeDisplay />
      <FloorSwitcher floorCode={floorCode} />
      <HelpInfo />
      <MyToastContainer />
    </>
  );
}

export default Floor;
