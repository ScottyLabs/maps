import { ERROR_CODES } from "@cmumaps/common";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { LOGOUT_URL, useSession } from "../auth.tsx";
import ErrorDisplay from "../components/shared/ErrorDisplay.tsx";
import Loader from "../components/shared/Loader.tsx";
import MyToastContainer from "../components/shared/MyToastContainer.tsx";
import useWebSocket from "../hooks/useWebSocket.ts";
import { useGetBuildingsMetadataQuery } from "../store/api/buildingApiSlice.ts";

const indexSearchSchema = z.object({
  errorCode: z.nativeEnum(ERROR_CODES).optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(indexSearchSchema),
  component: Index,
});

function Index() {
  const user = useSession();
  useWebSocket();

  const { data: buildingsMetadata, isLoading, isError } = useGetBuildingsMetadataQuery();
  const errorCode = Route.useSearch().errorCode;

  if (isLoading) {
    return <Loader loadingText="Fetching building codes" />;
  }

  if (isError || !buildingsMetadata) {
    return <ErrorDisplay errorText="Failed to fetch building codes" />;
  }

  const renderBuildingList = () => (
    <div className="m-5 flex flex-wrap gap-8">
      {[...buildingsMetadata, { buildingCode: "outside", name: "Outside", defaultFloor: true }].map(
        ({ buildingCode, name, defaultFloor }) => (
          <Link
            to={buildingCode === "outside" ? "/map" : "/floors/$floorCode"}
            params={{ floorCode: `${buildingCode}-${defaultFloor}` }}
            key={buildingCode}
            disabled={!defaultFloor}
            className={`rounded-lg border border-gray-300 p-4 shadow-md ${
              defaultFloor
                ? "cursor-pointer bg-gray-100 transition duration-200 ease-in-out hover:scale-105 hover:shadow-lg"
                : "bg-gray-300"
            }`}
          >
            {name}
          </Link>
        ),
      )}
    </div>
  );

  return (
    <>
      <header className="m-2 flex flex-row-reverse items-center gap-4">
        <a
          href={LOGOUT_URL}
          className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-1 shadow-md transition duration-200 ease-in-out hover:shadow-lg"
        >
          Sign out
        </a>
        <span className="text-gray-700">{user.name}</span>
      </header>
      {renderBuildingList()}
      <MyToastContainer errorCode={errorCode} />
    </>
  );
}

export default Index;
