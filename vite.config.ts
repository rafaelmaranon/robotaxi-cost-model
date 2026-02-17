import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? "/" : "/Waymo-cost-model/",
  build: {
    outDir: "docs"
  }
});
