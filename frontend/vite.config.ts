import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 55896,
    strictPort: true,
    proxy: {
      "/api": process.env.API_PROXY_TARGET || "http://localhost:3000",
      "/uploads": process.env.API_PROXY_TARGET || "http://localhost:3000",
      "/health": process.env.API_PROXY_TARGET || "http://localhost:3000",
    },
  },
});
