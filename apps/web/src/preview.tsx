/** A dataset change always starts a fresh app context, including URL selections. */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { env } from "./env";

export interface PreviewInfo {
  workspace: string;
  revision: string;
  appUrl: string;
  warnings: string[];
  counts: Record<string, number>;
}
const changedEvent = "maps-preview-changed";
// Pin requests to the page's dataset even while React Router changes the URL.
const initialQuery = new URLSearchParams(window.location.search);
const revision = initialQuery.get("revision");
const workspace = initialQuery.get("workspace");
let selectedPreview: PreviewInfo | null = null;
export const selectedRevision = () => revision ?? "baseline";

export function previewChanged(preview: PreviewInfo | null) {
  window.dispatchEvent(new CustomEvent(changedEvent, { detail: preview }));
}

export async function initializePreviewContext(): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`${env.VITE_SERVER_URL}/preview`, {
      credentials: "include",
    });
  } catch {
    // API revision checks still protect requests if startup metadata is unavailable.
    return true;
  }
  if (!response.ok) return true;
  const preview = (await response.json()) as PreviewInfo | null;
  if (
    preview &&
    (preview.revision !== selectedRevision() || preview.workspace !== workspace)
  ) {
    window.location.replace(preview.appUrl);
    return false;
  }
  selectedPreview = preview;
  if (!preview && revision) {
    window.location.replace("/");
    return false;
  }
  return true;
}

export function PreviewStatus() {
  const [changed, setChanged] = useState<{ preview: PreviewInfo | null }>();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!workspace || !revision) return;
    const query = new URLSearchParams(location.search);
    if (
      query.get("workspace") === workspace &&
      query.get("revision") === revision
    )
      return;
    query.set("workspace", workspace);
    query.set("revision", revision);
    void navigate(
      { ...location, search: `?${query.toString()}` },
      { replace: true },
    );
  }, [location, navigate]);
  useEffect(() => {
    const change = (event: Event) =>
      setChanged({
        preview: (event as CustomEvent<PreviewInfo | null>).detail,
      });
    window.addEventListener(changedEvent, change);
    return () => window.removeEventListener(changedEvent, change);
  }, []);
  if (changed)
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Preview changed"
        className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/60"
      >
        <div className="max-w-md space-y-4 rounded bg-white p-6 text-slate-900">
          <h2 className="font-semibold text-xl">A new preview is ready</h2>
          <p>
            {changed.preview
              ? `${changed.preview.workspace} · ${changed.preview.revision.slice(0, 8)}`
              : "The shared source dataset is active"}
            . Reload to use its rooms, floors and routes.
          </p>
          <button
            type="button"
            className="rounded bg-blue-700 px-4 py-2 text-white"
            onClick={() =>
              window.location.assign(changed.preview?.appUrl ?? "/")
            }
          >
            Open new preview
          </button>
        </div>
      </div>
    );
  if (!workspace || !revision) return null;
  return (
    <div className="absolute top-2 left-1/2 z-40 -translate-x-1/2 rounded border bg-white/95 px-3 py-1 text-xs text-slate-900">
      Preview: {workspace} · {revision.slice(0, 8)} ·{" "}
      <a
        className="underline"
        href={`http://localhost:5174/workspaces/${encodeURIComponent(workspace)}`}
      >
        Edit working JSON
      </a>
      {selectedPreview && (
        <details className="mt-1 max-w-md">
          <summary className="cursor-pointer">
            {selectedPreview.warnings.length} source warnings · routes
            unverified
          </summary>
          <ul className="max-h-48 list-inside list-disc overflow-y-auto pt-2">
            {selectedPreview.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
