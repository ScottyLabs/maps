import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { pipeline } from "../../pipeline/api";

export const Route = createFileRoute("/workspaces/")({ component: Workspaces });

function Workspaces() {
  const { data, error, isPending } = useQuery({
    queryKey: ["pipeline-workspaces"],
    queryFn: () => pipeline<{ workspaces: string[] }>("list"),
  });
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="font-semibold text-3xl">Fresh-source workspaces</h1>
      <p>
        Open a saved capture to inspect rooms, place a reference floor, and save
        working JSON. Saving edits does not import the database.
      </p>
      {isPending && <p>Loading workspaces…</p>}
      {error && <p role="alert">{error.message}</p>}
      <ul className="space-y-3">
        {data?.workspaces.map((name) => (
          <li key={name}>
            <Link
              className="text-blue-700 underline"
              to="/workspaces/$workspace"
              params={{ workspace: name }}
            >
              {name}
            </Link>
          </li>
        ))}
      </ul>
      {data?.workspaces.length === 0 && (
        <p>No captures found. Run the FMS capture command first.</p>
      )}
      <p className="text-sm text-slate-600">
        Create captures with scripts/dev/fms.sh; they appear here under
        uploads/pipeline/.
      </p>
      <Link to="/">Back to visualizer</Link>
    </main>
  );
}
