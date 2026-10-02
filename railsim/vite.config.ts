import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.VITE_PORT) || 5173,
    proxy: {
      "/api": process.env.VITE_API || "http://127.0.0.1:8780",
      "/health": process.env.VITE_API || "http://127.0.0.1:8780",
      "/metrics": process.env.VITE_API || "http://127.0.0.1:8780",
      "/graphql": process.env.VITE_API || "http://127.0.0.1:8780",
      "/ws": { target: (process.env.VITE_API || "http://127.0.0.1:8780").replace(/^http/, "ws"), ws: true },
    },
  },
});
