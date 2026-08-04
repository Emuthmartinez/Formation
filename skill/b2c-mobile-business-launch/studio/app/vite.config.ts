import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "render",
  base: "./",
  build: {
    outDir: "../dist/design-room",
    emptyOutDir: true,
  },
});
