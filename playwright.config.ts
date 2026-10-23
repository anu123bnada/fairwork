import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // A separately managed server avoids process-tree shutdown restrictions in sandboxes.
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1" ? undefined : {
    command: "node node_modules/next/dist/bin/next start",
    url: "http://localhost:3000", reuseExistingServer: false, timeout: 60000,
  },
});
