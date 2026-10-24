/** Local transport only. Source processing and JSON edits live in dataflow. */
import path from "node:path";
import process from "node:process";
import { Router } from "express";
import { OIDC_AUTH, expressAuthentication } from "./authentication.ts";
import { HttpError } from "../middleware/errorHandler.ts";

export const pipelineRouter = () => {
  const router = Router();
  router.post("/", async (request, response, next) => {
    try {
      if (!process.env.PIPELINE_ROOT)
        throw new HttpError(404, "Local pipeline is disabled");
      await expressAuthentication(request, OIDC_AUTH, []);
      const root = path.resolve(import.meta.dirname, "../../../..");
      const child = Bun.spawn(
        ["bash", path.join(root, "scripts/dev/pipeline.sh"), "bridge"],
        {
          cwd: root,
          stdin: new Blob([JSON.stringify(request.body)]),
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
      response.status(result.status ?? 200).json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
};
