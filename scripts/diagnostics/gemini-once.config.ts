import { defineConfig } from "vitest/config";
import base from "../../vitest.config.ts";

export default defineConfig({
  ...base,
  test: { ...base.test, include: ["scripts/diagnostics/gemini-once.test.ts"], retry: 0, testTimeout: 35000 },
});
