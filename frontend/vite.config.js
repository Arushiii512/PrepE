import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend already allows cross-origin requests (CORS "*"), so no dev proxy is
// needed. The API URL is read from VITE_API_BASE_URL (see .env).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5173, host: true },
});
