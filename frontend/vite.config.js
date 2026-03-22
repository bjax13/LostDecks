import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.{test,spec}.{js,jsx}", "src/**/__tests__/**/*.{js,jsx}"],
    setupFiles: ["./src/test/setup.js"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: ["src/**/*.{js,jsx}"],
      // Only exclude test files and test harness so they are not counted as production source.
      exclude: ["src/**/*.test.{js,jsx}", "src/**/*.spec.{js,jsx}", "src/test/**"],
    },
  },
});
