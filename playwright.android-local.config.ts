import { defineConfig } from "@playwright/test";

// Start scripts/android-local-server.mjs separately. This checks the exact POC
// origin; it is still desktop Chromium, not native Android compatibility proof.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "android-browser.spec.ts",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 }, // First dev navigation can compile a new route.
  use: { baseURL: "http://localhost:3102", trace: "retain-on-failure" },
  outputDir: "test-results/android-local-browser",
});
