import { defineConfig, devices } from "@playwright/test";
// Screenshot capture against a separately started dev server (port 3107) in the design-replication worktree.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /(replica-capture|replica-screens|dashboard-screens|command-palette|ui-redesign-screens|career-explorer|applicants|opportunit[a-z-]*|work-record[a-z-]*|passport[a-z-]*)\.spec\.ts/,
  use: { baseURL: "http://localhost:3107" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
