import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 55896,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3000",
      "/uploads": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
