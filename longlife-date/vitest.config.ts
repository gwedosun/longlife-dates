/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
  },
});
