import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "vitest"],
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
});
