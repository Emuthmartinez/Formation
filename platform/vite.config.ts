import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "platform/web",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.FORMATION_WEB_PORT ?? 4311),
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.PORT ?? 4310}`,
        changeOrigin: false,
      },
    },
  },
});
