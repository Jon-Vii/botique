import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@docs": resolve(__dirname, "../docs"),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [resolve(__dirname, "."), resolve(__dirname, "../docs")],
    },
    proxy: {
      "/v3": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/control": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
