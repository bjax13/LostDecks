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
      reportsDirectory: "./coverage",
      include: ["src/**/*.{js,jsx}"],
      exclude: [
        "src/**/*.test.{js,jsx}",
        "src/**/__tests__/**",
        "src/main.jsx",
        "src/test/**",
        "src/data/**",
      ],
    },
  },
});
