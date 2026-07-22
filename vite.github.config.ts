import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "github-pages",
  base: "/MICS-Survey-Topics-Dashboard/",
  plugins: [react()],
  publicDir: "../public",
  build: { outDir: "../dist-pages", emptyOutDir: true },
});
