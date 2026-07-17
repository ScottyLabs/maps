import type { ErrorCode } from "@cmumaps/common";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import ErrorHandler from "../../components/shared/ErrorHandler.tsx";
import Loader from "../../components/shared/Loader.tsx";
import { useGetDefaultFloorQuery } from "../../store/api/buildingApiSlice.ts";

export const Route = createFileRoute("/buildings/$buildingCode")({
  component: Building,
});

function Building() {
  const { buildingCode } = Route.useParams();
  const {
    data: floorLevel,
    isLoading,
    error,
  } = useGetDefaultFloorQuery(buildingCode);

  if (isLoading) {
    return <Loader loadingText="Fetching building floors" />;
  }

  if (error) {
    if ("data" in error && "code" in (error.data as object)) {
      const errorCode = (error.data as { code: ErrorCode }).code;
      return <Navigate to="/" search={{ errorCode }} />;
    }
    return <ErrorHandler error={error} />;
  }

  if (!floorLevel) {
    return <Navigate to="/" />;
  }

  return (
    <Navigate
      to="/floors/$floorCode"
      params={{ floorCode: `${buildingCode}-${floorLevel}` }}
    />
  );
}
