import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      tpath: new URL("../../tpath.ts", import.meta.url).pathname,
    },
  },
});
