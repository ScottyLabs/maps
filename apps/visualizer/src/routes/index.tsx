import { auth } from "../auth";
import { ERROR_CODES } from "@cmumaps/common";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import ErrorDisplay from "../components/shared/ErrorDisplay";
import Loader from "../components/shared/Loader";
import MyToastContainer from "../components/shared/MyToastContainer";
import useWebSocket from "../hooks/useWebSocket";
import { useGetBuildingsMetadataQuery } from "../store/api/buildingApiSlice";

const indexSearchSchema = z.object({
  errorCode: z.nativeEnum(ERROR_CODES).optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(indexSearchSchema),
  component: Index,
});

function Index() {
  useWebSocket();

  const {
    data: buildingsMetadata,
    isLoading,
    isError,
  } = useGetBuildingsMetadataQuery();
  const errorCode = Route.useSearch().errorCode;

  if (isLoading) {
    return <Loader loadingText="Fetching building codes" />;
  }

  if (isError || !buildingsMetadata) {
    return <ErrorDisplay errorText="Failed to fetch building codes" />;
  }

  const renderBuildingList = () => (
    <div className="m-5 flex flex-wrap gap-8">
      {[
        ...buildingsMetadata,
        { buildingCode: "outside", name: "Outside", defaultFloor: true },
      ].map(({ buildingCode, name, defaultFloor }) => (
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
      ))}
    </div>
  );

  return (
    <>
      <header className="m-2 flex flex-row-reverse">
        <button
          type="button"
          onClick={() => {
            void auth.signOut();
          }}
        >
          Sign out
        </button>
      </header>
      <section className="m-5 rounded border border-blue-300 bg-blue-50 p-5">
        <h1 className="font-semibold text-xl">Fresh-source pipeline</h1>
        <p>
          Place and edit captured drawings in working JSON before loading a
          preview.
        </p>
        <Link to="/workspaces" className="text-blue-700 underline">
          Open source workspaces
        </Link>
      </section>
      <h2 className="m-5 font-semibold">Existing database editor</h2>
      {renderBuildingList()}
      <MyToastContainer errorCode={errorCode} />
    </>
  );
}

export default Index;
