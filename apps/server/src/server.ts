import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { toNodeHandler } from "better-auth/node";
import { YAML } from "bun";
import cors, { type CorsOptions } from "cors";
import type { ErrorRequestHandler } from "express";
import express from "express";
import { Server } from "socket.io";
import swaggerUi, { type JsonObject } from "swagger-ui-express";
import { RegisterRoutes } from "../build/routes.ts";
import { prisma } from "../prisma/index.ts";
import { env } from "./env.ts";
import { auth } from "./lib/auth.ts";
import { pipelineRouter } from "./lib/pipeline.ts";
import { activePreview, previewGate } from "./lib/previewGate.ts";
import { initializePreview } from "./services/previewService.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import { notFoundHandler } from "./middleware/notFoundHandler.ts";
import { socketAuth } from "./middleware/socketAuth.ts";
import { WebSocketService } from "./services/webSocketService.ts";

const app = express();
if (process.env.PIPELINE_ROOT)
  app.use("/pipeline", express.json({ limit: "16mb" }));
app.use(express.json({ limit: "1mb" }));

// Define CORS options
const corsOptions: CorsOptions = {
  origin: env.ALLOWED_ORIGINS_REGEX?.split(",").map(
    (origin) => new RegExp(origin, "u"),
  ),
  credentials: true,
};
app.use(cors(corsOptions));

// Create HTTP server with Express app attached
const server = http.createServer(app);

// Initialize Socket.IO with authentication middleware
// https://socket.io/docs/v4/handling-cors/
const io = new Server(server, { cors: corsOptions });
io.use(socketAuth);

// Initialize WebSocket service
export const webSocketService = new WebSocketService(io);

// Setup Authentication
// Setup Authentication: https://www.better-auth.com/docs/integrations/express
app.all("/api/auth/*splat", toNodeHandler(auth));

// Swagger and OpenAPI JSON
const swaggerYaml = fs.readFileSync("./build/swagger.yaml", "utf8");
const swaggerJson = YAML.parse(swaggerYaml) as JsonObject;
app.use(
  "/swagger",
  express.static(
    path.join(import.meta.dirname, "../node_modules/swagger-ui-dist"),
    {
      index: false,
    },
  ),
  swaggerUi.serve,
  swaggerUi.setup(swaggerJson),
);
app.get("/openapi.json", (_req, res) => {
  res.status(200).send(swaggerJson);
});

// Development workspace access uses the same session and pipeline engine.
app.use(
  "/pipeline",
  pipelineRouter(() => io.disconnectSockets(true)),
);
app.get("/preview", (_request, response) => response.json(activePreview()));
app.get("/", (_request, response) => response.json({ status: "ok" }));
app.use(previewGate);

// Routes
RegisterRoutes(app);

// Error Handling and Not Found Handlers
app.use(errorHandler as ErrorRequestHandler);
app.use(notFoundHandler);

await initializePreview();

const port = env.SERVER_PORT;
server.listen(port, env.SERVER_HOST, () => {
  console.log(`Server listening on port ${port}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit();
});
