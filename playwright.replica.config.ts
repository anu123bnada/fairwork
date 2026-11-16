import { defineConfig, devices } from "@playwright/test";
// Screenshot capture against a separately started dev server (port 3107) in the design-replication worktree.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /(replica-capture|dashboard-screens|command-palette)\.spec\.ts/,
  use: { baseURL: "http://localhost:3107" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
