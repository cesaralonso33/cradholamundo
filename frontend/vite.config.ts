import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
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
