import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "."),
    },
  },
});
