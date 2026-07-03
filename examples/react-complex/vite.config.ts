import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      tpath: new URL("../../tpath.ts", import.meta.url).pathname,
    },
  },
});
