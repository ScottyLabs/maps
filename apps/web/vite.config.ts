import deno from "@deno/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// biome-ignore lint/style/noDefaultExport: suggested by https://vite.dev/config/
export default defineConfig({
  plugins: [
    deno(),
    viteReact({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  envPrefix: ["VITE_", "GOOGLE_MAPS_"],
});
