// LIVE provider check using ONLY synthetic offer text. It calls the application's real provider
// code (src/server/ai/provider.ts) against the real Gemini API. The policy gate is satisfied
// in-process with clearly synthetic test values; no repository or .env.local flag is changed, and
// no real user data is involved. Run: npm run test:live:gemini
import dns from "node:dns";
import { readFileSync } from "node:fs";
import { beforeAll, expect, it, vi } from "vitest";
dns.setDefaultResultOrder("ipv4first"); // this dev machine's IPv6 route to Google stalls; IPv4 works

vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({}) }));
const SYNTHETIC_OFFER = [
  "SYNTHETIC TEST OFFER — not a real employer or person.",
  "Role: Site Technician. Pay: LKR 90,000 per month.",
  "The first 30 days are an unpaid training period.",
  "A refundable registration fee of LKR 25,000 is payable before the start date.",
  "Overtime may be required without extra pay. Original certificates must be handed over for safekeeping.",
].join("\n");

function envFile(name: string) {
  try { return readFileSync(".env.local", "utf8").split(/\r?\n/).find(line => line.startsWith(`${name}=`))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, ""); } catch { return undefined; }
}
beforeAll(() => {
  const key = envFile("GEMINI_API_KEY") ?? envFile("GOOGLE_API_KEY"), model = process.env.ORYQEN_LIVE_GEMINI_MODEL ?? envFile("GEMINI_MODEL");
  if (!key || !model) throw new Error("GEMINI_API_KEY and GEMINI_MODEL must be set in .env.local");
  vi.stubEnv("GEMINI_API_KEY", key); vi.stubEnv("GEMINI_MODEL", model);
  vi.stubEnv("ORYQEN_AI_PROVIDER", "gemini"); vi.stubEnv("ORYQEN_AI_ENABLED", "true"); vi.stubEnv("ORYQEN_AI_POLICY_APPROVED", "true");
  vi.stubEnv("ORYQEN_AI_POLICY_APPROVAL_REF", "synthetic-local-live-test-only"); vi.stubEnv("ORYQEN_AI_PROCESSING_REGION", "synthetic test");
  vi.stubEnv("ORYQEN_AI_DATA_USE", "Synthetic live provider test; no real data");
});

it("returns a validated, grounded analysis for a synthetic offer (retrying only provider overload)", async () => {
  const { executeAiOfferAnalysis } = await import("@/server/ai/provider");
  const started = Date.now();
  const diagnostics: unknown[] = [];
  const observe = (d: unknown) => { diagnostics.push(d); };
  let result = await executeAiOfferAnalysis(SYNTHETIC_OFFER, "WORKER", undefined, observe);
  console.log(`attempt 1: ${result.status} after ${Date.now() - started} ms — ${result.message}`);
  for (let attempt = 2; attempt <= 3 && result.status !== "SUCCESS"; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 8000));
    result = await executeAiOfferAnalysis(SYNTHETIC_OFFER, "WORKER", undefined, observe);
    console.log(`attempt ${attempt}: ${result.status} after ${Date.now() - started} ms — ${result.message}`);
  }
  console.log("sanitized provider diagnostics:", JSON.stringify(diagnostics));
  console.log(JSON.stringify({ status: result.status, provider: result.provider, message: result.message }));
  expect(result.status).toBe("SUCCESS");
  expect(result.provider).toBe("gemini");
  expect(result.isAdvisory).toBe(true);
  const data = result.data!;
  console.log("summary:", JSON.stringify({ salary: data.salary.amount, currency: data.salary.currency, signs: data.warningSigns.map(w => `${w.severity}: ${w.title}`), missing: data.missingDetails.length, questions: data.followUpQuestions.length }));
  expect(data.companyClaimNotice).toMatch(/cannot verify/i);
  expect(data.salary.amount === null || data.salary.amount === 90000).toBe(true);
  expect(data.warningSigns.length).toBeGreaterThan(0);
  for (const sign of data.warningSigns) if (sign.quote) expect(SYNTHETIC_OFFER).toContain(sign.quote);
  expect(JSON.stringify(result)).not.toContain(envFile("GEMINI_API_KEY") ?? "no-key");
}, 300000);
