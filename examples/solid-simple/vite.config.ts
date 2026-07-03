import solid from "vite-plugin-solid";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      tpath: new URL("../../tpath.ts", import.meta.url).pathname,
    },
  },
});
