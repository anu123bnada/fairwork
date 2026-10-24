// Explicit opt-in only; excluded from the ordinary test suite. Real network call.
import { test, expect } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { executeAiOfferAnalysis } from "../../src/server/ai/provider";
import type { GeminiDiagnostic } from "../../src/server/ai/gemini-diagnostic";

test("one explicitly approved fictional generation through the actual adapter", async () => {
  const approval = process.env.ORYQEN_DIAGNOSTIC_APPROVAL;
  if (!approval || !/^[a-z0-9-]{10,80}$/.test(approval)) throw new Error("Explicit one-shot approval reference required");
  // Vitest sets NODE_ENV=test, for which Next intentionally skips .env.local.
  // Read only the existing provider settings; never print or persist credentials.
  const local = parseEnv(readFileSync(".env.local", "utf8"));
  mkdirSync("test-results/provider-diagnostics", { recursive: true });
  const output = `test-results/provider-diagnostics/${approval}`;
  // Consume before transmission; even a crash cannot silently spend it twice.
  writeFileSync(`${output}.consumed`, new Date().toISOString(), { flag: "wx" });
  const overrides = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || local.GEMINI_API_KEY || local.GOOGLE_API_KEY || "",
    GEMINI_MODEL: process.env.GEMINI_MODEL || local.GEMINI_MODEL || "",
    ORYQEN_AI_PROVIDER: "gemini", ORYQEN_AI_ENABLED: "true",
    ORYQEN_AI_POLICY_APPROVED: "true", ORYQEN_AI_POLICY_APPROVAL_REF: approval,
    ORYQEN_AI_PROCESSING_REGION: "Provider-managed; residency unverified; fictional diagnostic only",
    ORYQEN_AI_DATA_USE: "Owner approved one fictional diagnostic; no personal data; production processing not approved",
  };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let requests = 0, httpStatus: number | null = null;
  let modelListStatus: number | null = null;
  let diagnostic: GeminiDiagnostic | null = null;
  const started = Date.now();
  try {
    Object.assign(process.env, overrides);
    if (process.env.ORYQEN_DIAGNOSTIC_LIST_MODELS === "true") {
      const listing = await originalFetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", {
        headers: { "x-goog-api-key": overrides.GEMINI_API_KEY },
        redirect: "error", cache: "no-store", signal: AbortSignal.timeout(25000),
      });
      modelListStatus = listing.status;
      const data = await listing.json();
      const availableModels: string[] = (Array.isArray(data?.models) ? data.models : [])
        .filter((item: { name?: unknown; supportedGenerationMethods?: unknown }) =>
          typeof item.name === "string" && /^models\/gemini-[a-zA-Z0-9.-]*flash[a-zA-Z0-9.-]*$/.test(item.name)
          && Array.isArray(item.supportedGenerationMethods) && item.supportedGenerationMethods.includes("generateContent"))
        .map((item: { name: string }) => item.name.slice(7)).sort().reverse();
      writeFileSync(`${output}-models.json`, JSON.stringify({ capturedAt: new Date().toISOString(), httpStatus: modelListStatus, availableModels, requests: 1 }, null, 2));
      if (!listing.ok || !availableModels.length) throw new Error("No supported Flash model returned; generation not attempted");
      process.env.GEMINI_MODEL = availableModels.find(name => /^gemini-\d+(\.\d+)?-flash$/.test(name)) ?? availableModels[0];
    }
    globalThis.fetch = async (input, init) => {
      if (++requests > 1) throw new Error("One-request budget exhausted");
      const response = await originalFetch(input, init);
      httpStatus = response.status;
      return response;
    };
    const result = await executeAiOfferAnalysis(
      "Fictional test offer. Role: Technician. Salary: LKR 80000 gross monthly. Work: 40 hours per week, Monday to Friday. Overtime terms and termination notice are not specified.",
      "WORKER", undefined, value => { diagnostic = value; },
    );
    writeFileSync(`${output}.json`, JSON.stringify({
      capturedAt: new Date().toISOString(), approval, model: process.env.GEMINI_MODEL,
      requests, httpStatus, modelListStatus, elapsedMs: Date.now() - started, status: result.status,
      validatedStructuredOutput: result.status === "SUCCESS" && result.data !== null,
      diagnostic, applicationWorkflowVerified: false, productionProcessingEnabled: false,
    }, null, 2));
    expect(result.status, "See sanitized provider diagnostic; harness completion is not generation success").toBe("SUCCESS");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
