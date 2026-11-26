import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const kennelEnv: Plugin = {
  name: "kennel-env",
  configureServer(server) {
    server.middlewares.use("/_kennel/env.json", (_req, res) => {
      const env = Object.entries(process.env).filter(([key]) => key.startsWith("PUBLIC_"));
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(Object.fromEntries(env)));
    });
  },
};

// biome-ignore lint/style/noDefaultExport: suggested by https://vite.dev/config/
export default defineConfig({
  plugins: [
    kennelEnv,
    viteReact({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: "/src" },
      {
        find: /^@cmumaps\/([^/]+)$/u,
        replacement: fileURLToPath(new URL("../../packages/$1/src/index.ts", import.meta.url)),
      },
    ],
  },
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
