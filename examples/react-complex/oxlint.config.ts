import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["dist/**", "node_modules/**"],
  rules: {
    "typescript/consistent-type-imports": "error",
  },
});
