import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { pipeline, type WorkspaceView } from "../../pipeline/api";
import WorkspaceEditor from "../../pipeline/WorkspaceEditor";

export const Route = createFileRoute("/workspaces/$workspace")({
  component: Workspace,
});

function Workspace() {
  const { workspace } = Route.useParams();
  const { data, error } = useQuery({
    queryKey: ["pipeline", workspace],
    queryFn: () => pipeline<WorkspaceView>("normalize", workspace),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  if (error)
    return (
      <p role="alert" className="p-8">
        {error.message}
      </p>
    );
  if (!data) return <p className="p-8">Opening saved source…</p>;
  return (
    <WorkspaceEditor key={workspace} workspace={workspace} initial={data} />
  );
}
