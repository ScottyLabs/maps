/** Local transport only: every source/JSON/conversion stage lives in dataflow. */
import path from "node:path";
import { HttpError } from "../middleware/errorHandler.ts";

export const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

export async function runPipeline<T>(operation: object): Promise<T> {
  const child = Bun.spawn(
    ["bash", path.join(repositoryRoot, "scripts/dev/pipeline.sh"), "bridge"],
    {
      cwd: repositoryRoot,
      stdin: new Blob([JSON.stringify(operation)]),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [output, errors, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (status !== 0) {
    console.error("Pipeline process failed:", errors);
    throw new HttpError(
      500,
      "Pipeline could not run; inspect the development process log",
    );
  }
  const result = JSON.parse(output);
  if (result.error) throw new HttpError(result.status ?? 422, result.error);
  return result;
}
