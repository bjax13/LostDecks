import { defineConfig, devices } from "@playwright/test";

const previewArgs = "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort";
/** When set (e.g. in CI after a dedicated `npm run build`), skip rebuilding before preview. */
const skipProdBuild = process.env.PLAYWRIGHT_SKIP_BUILD === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: skipProdBuild ? previewArgs : `npm run build && ${previewArgs}`,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
