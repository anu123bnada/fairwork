// Authenticated browser journeys against a REAL ORYQEN origin (hosted staging by default). Not part of `npm run test:e2e`.
// Run through scripts/run-hosted-browser-journeys.mjs, which prompts for the test-account password (hidden) and never stores it.
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

export const hostedOrigin = process.env.ORYQEN_HOSTED_ORIGIN ?? "https://oryqen-staging.vercel.app";
export const stateFile = path.resolve(process.env.ORYQEN_HOSTED_STATE ?? ".tmp/hosted-auth/state.json");

export default defineConfig({
  testDir: "tests/hosted",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/hosted/report.json" }]],
  outputDir: "test-results/hosted/artifacts",
  use: { baseURL: hostedOrigin, trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "worker", testMatch: /journeys\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], storageState: stateFile } },
    { name: "visual", testMatch: /visual\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], storageState: stateFile } },
    { name: "worker-mobile", testMatch: /journeys\.spec\.ts/, grep: /@mobile/, dependencies: ["setup"], use: { ...devices["Pixel 7"], storageState: stateFile } },
  ],
});
