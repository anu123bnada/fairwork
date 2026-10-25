import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Opt-in live provider checks (real network, synthetic inputs only). Not part of `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) } },
  test: { environment: "node", include: ["tests/live/**/*.live.ts"], maxWorkers: 1, testTimeout: 120000, hookTimeout: 60000 },
});
