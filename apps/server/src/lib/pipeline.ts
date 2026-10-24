import process from "node:process";
import { Router } from "express";
import {
  ADMIN_SCOPE,
  BEARER_AUTH,
  OIDC_AUTH,
  expressAuthentication,
} from "./authentication.ts";
import { HttpError } from "../middleware/errorHandler.ts";
import { loadPreview, restoreBaseline } from "../services/previewService.ts";
import { runPipeline } from "./runPipeline.ts";

export const pipelineRouter = (onActivate: () => void) => {
  const router = Router();
  router.post("/", async (request, response, next) => {
    try {
      if (!process.env.PIPELINE_ROOT)
        throw new HttpError(404, "Local pipeline is disabled");
      await expressAuthentication(
        request,
        request.headers.authorization ? BEARER_AUTH : OIDC_AUTH,
        request.headers.authorization ? [ADMIN_SCOPE] : [],
      );
      const operation = request.body?.operation;
      const result =
        operation === "baseline"
          ? await restoreBaseline()
          : operation === "load"
            ? await loadPreview(request.body.workspace, request.body.revision)
            : await runPipeline(request.body);
      if (operation === "load" || operation === "baseline") onActivate();
      response.json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
};
