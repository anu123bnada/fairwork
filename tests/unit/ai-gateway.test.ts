import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { aiConfiguration, aiFallbackConfigurations } from "@/server/ai/config";
import { analyzeOfferWithGateway, providerStatuses, type GatewayHooks } from "@/server/ai/gateway";
import { CircuitBreaker, UsageLedger, resetAiRuntimeState } from "@/server/ai/breaker";
import { classifyHttpStatus, classifyThrown, ProviderFailure, retryAfterFrom } from "@/server/ai/failure";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import type { AnalyzeOfferInput } from "@/features/offer/ai-schema";

const source = "Role: Technician\nSalary: LKR 80000 monthly\n40 hours per week";
const fixture = () => extractOfferTermsRuleBased(source).data!;
const gemini = (text = JSON.stringify(fixture())) => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80 } });
const chat = (content = JSON.stringify(fixture())) => Response.json({ choices: [{ finish_reason: "stop", message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 60 } });
const quota = (retryDelay?: string) => Response.json({ error: { status: "RESOURCE_EXHAUSTED", details: retryDelay ? [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay }] : [] } }, { status: 429 });

const setup = (extra: Record<string, string> = {}) => {
  const env: Record<string, string> = {
    ORYQEN_AI_ENABLED: "true", ORYQEN_AI_POLICY_APPROVED: "true", ORYQEN_AI_PROVIDER: "gemini", GEMINI_API_KEY: "synthetic-gemini-key", GEMINI_MODEL: "gemini-synthetic-test",
    ORYQEN_AI_POLICY_APPROVAL_REF: "synthetic-approval-gemini", ORYQEN_AI_PROCESSING_REGION: "Synthetic region A", ORYQEN_AI_DATA_USE: "Synthetic data use A",
    ORYQEN_AI_FALLBACK_PROVIDERS: "openai,selfhosted",
    OPENAI_API_KEY: "synthetic-openai-key", OPENAI_MODEL: "gpt-synthetic", ORYQEN_AI_OPENAI_POLICY_APPROVAL_REF: "synthetic-approval-openai", ORYQEN_AI_OPENAI_PROCESSING_REGION: "Synthetic region B", ORYQEN_AI_OPENAI_DATA_USE: "Synthetic data use B",
    ...extra,
  };
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
};
const consentFor = (withOpenAi: boolean, stale = false): AnalyzeOfferInput => {
  const primary = aiConfiguration()!, openai = aiFallbackConfigurations().find(item => item.provider === "openai");
  return { text: source, role: "WORKER", consent: { provider: primary.provider as "gemini", noticeVersion: "offer-analysis.v1", transmit: true, policyHash: primary.policyHash, ...(withOpenAi && openai ? { fallbacks: [{ provider: "openai", policyHash: stale ? "0".repeat(64) : openai.policyHash }] } : {}) } };
};
const hooks = (over: Partial<GatewayHooks> = {}) => { const authorized: string[] = []; return { authorized, hooks: { authorize: async (config: { provider: string }) => { authorized.push(config.provider); return crypto.randomUUID(); }, sleep: async () => undefined, ...over } as GatewayHooks }; };
const urls = () => vi.mocked(fetch).mock.calls.map(call => String(call[0]));

beforeEach(() => { resetAiRuntimeState(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("provider configuration", () => {
  it("approves each provider on its own: the unsuffixed approval belongs to the primary only", () => {
    setup();
    expect(aiConfiguration()?.provider).toBe("gemini");
    expect(aiFallbackConfigurations().map(item => item.provider)).toEqual(["openai"]); // selfhosted has no URL, so it is not eligible
    vi.stubEnv("ORYQEN_AI_OPENAI_POLICY_APPROVAL_REF", "");
    expect(aiFallbackConfigurations()).toEqual([]); // the primary's reference does not approve OpenAI
    setup({ ORYQEN_AI_OPENAI_DATA_USE: "" }); expect(aiFallbackConfigurations()).toEqual([]);
  });
  it("gives each provider its own policy hash, and a self-hosted model needs a secure or loopback address", () => {
    setup({ ORYQEN_SELFHOSTED_AI_URL: "https://llm.example.test/", ORYQEN_SELFHOSTED_AI_MODEL: "llama3.1:8b", ORYQEN_AI_SELFHOSTED_POLICY_APPROVAL_REF: "synthetic-approval-self", ORYQEN_AI_SELFHOSTED_PROCESSING_REGION: "On premises", ORYQEN_AI_SELFHOSTED_DATA_USE: "Not retained" });
    const all = [aiConfiguration()!, ...aiFallbackConfigurations()];
    expect(all.map(item => item.provider)).toEqual(["gemini", "openai", "selfhosted"]);
    expect(new Set(all.map(item => item.policyHash)).size).toBe(3);
    expect(all[2]!.baseUrl).toBe("https://llm.example.test");
    for (const bad of ["http://llm.example.test", "ftp://x.test", "not a url", ""]) { vi.stubEnv("ORYQEN_SELFHOSTED_AI_URL", bad); expect(aiFallbackConfigurations().map(item => item.provider), bad).toEqual(["openai"]); }
    vi.stubEnv("ORYQEN_SELFHOSTED_AI_URL", "http://127.0.0.1:11434"); expect(aiFallbackConfigurations().map(item => item.provider)).toEqual(["openai", "selfhosted"]);
  });
  it("is disabled unless the owner enabled AI and approved the policy, and ignores unknown or duplicate providers", () => {
    setup({ ORYQEN_AI_FALLBACK_PROVIDERS: "anthropic, openai, openai, gemini" });
    expect(aiFallbackConfigurations().map(item => item.provider)).toEqual(["openai"]);
    vi.stubEnv("ORYQEN_AI_ENABLED", "false"); expect(aiConfiguration()).toBeNull(); expect(aiFallbackConfigurations()).toEqual([]);
  });
});

describe("failure classification", () => {
  it("classifies without provider text, and reads the provider's own pause hint", () => {
    expect([429, 401, 403, 400, 404, 500, 503, 529, 418, 200].map(classifyHttpStatus)).toEqual(["quota", "configuration", "configuration", "configuration", "model", "unavailable", "unavailable", "unavailable", "invalid", null]);
    expect(classifyThrown(new DOMException("x", "TimeoutError"))).toBe("timeout"); expect(classifyThrown(new TypeError("fetch failed"))).toBe("network"); expect(classifyThrown(new Error("x"))).toBe("invalid"); expect(classifyThrown(new ProviderFailure("quota"))).toBe("quota");
    expect(retryAfterFrom(new Headers({ "retry-after": "42" }), null)).toBe(42);
    expect(retryAfterFrom(null, { error: { details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "34.5s" }] } })).toBe(35);
    expect(retryAfterFrom(new Headers({ "retry-after": new Date(Date.now() + 90_000).toUTCString() }), null)).toBeGreaterThan(80);
    expect(retryAfterFrom(null, { error: { details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "soon" }] } })).toBeNull();
    expect(retryAfterFrom(new Headers({ "retry-after": "-5" }), null)).toBeNull();
  });
});

describe("circuit breaker and usage ledger", () => {
  it("pauses an exhausted quota for the provider's hint, allows one probe afterwards, and closes on success", () => {
    let now = 1_000_000; const breaker = new CircuitBreaker(() => now);
    expect(breaker.check("p").status).toBe("closed");
    breaker.failure("p", "quota", 120);
    expect(breaker.check("p")).toMatchObject({ status: "open", reason: "quota", retryAfterSeconds: 120 });
    now += 119_000; expect(breaker.check("p").status).toBe("open");
    now += 2_000; expect(breaker.check("p").status).toBe("half_open"); expect(breaker.check("p").status).toBe("open"); // exactly one probe
    breaker.failure("p", "quota", null); expect(breaker.peek("p")).toMatchObject({ status: "open", retryAfterSeconds: 900 }); // no hint: 15 minutes
    now += 901_000; expect(breaker.check("p").status).toBe("half_open"); breaker.success("p"); expect(breaker.check("p").status).toBe("closed");
  });
  it("never trusts a tiny or huge hint, opens after three transient faults, doubles while probes fail, and ignores content failures", () => {
    let now = 0; const breaker = new CircuitBreaker(() => now);
    breaker.failure("a", "quota", 1); expect(breaker.peek("a").retryAfterSeconds).toBe(60);
    breaker.failure("b", "quota", 10 ** 9); expect(breaker.peek("b").retryAfterSeconds).toBe(86400);
    for (const kind of ["unavailable", "network"] as const) breaker.failure("c", kind); expect(breaker.peek("c").status).toBe("closed");
    breaker.failure("c", "timeout"); expect(breaker.peek("c")).toMatchObject({ status: "open", retryAfterSeconds: 60 });
    now += 61_000; breaker.check("c"); breaker.failure("c", "unavailable"); expect(breaker.peek("c").retryAfterSeconds).toBe(120);
    for (const kind of ["invalid", "blocked", "incomplete"] as const) { breaker.failure("d", kind); breaker.failure("d", kind); breaker.failure("d", kind); }
    expect(breaker.peek("d").status).toBe("closed");
    breaker.failure("e", "configuration"); expect(breaker.peek("e")).toMatchObject({ status: "open", retryAfterSeconds: 600, reason: "configuration" });
  });
  it("enforces daily request and token budgets per provider and starts a new window after a day", () => {
    let now = 0; const ledger = new UsageLedger(() => now);
    expect(ledger.withinBudget("p", { requests: 2, tokens: 1000 })).toBe(true);
    ledger.attempt("p"); ledger.attempt("p"); expect(ledger.withinBudget("p", { requests: 2, tokens: null })).toBe(false);
    expect(ledger.withinBudget("other", { requests: 2, tokens: null })).toBe(true);
    ledger.success("p", { inputTokens: 600, outputTokens: 500 }); expect(ledger.withinBudget("p", { requests: null, tokens: 1000 })).toBe(false);
    expect(ledger.snapshot("p")).toMatchObject({ attempts: 2, successes: 1, inputTokens: 600, outputTokens: 500 });
    now += 86_400_001; expect(ledger.withinBudget("p", { requests: 2, tokens: 1000 })).toBe(true);
  });
});

describe("gateway fallback", () => {
  it("falls back to a consented provider when the primary's quota is exhausted, and records both attempts", async () => {
    setup();
    vi.mocked(fetch).mockResolvedValueOnce(quota("34s")).mockResolvedValueOnce(chat());
    const h = hooks();
    const result = await analyzeOfferWithGateway(consentFor(true), h.hooks);
    expect(result).toMatchObject({ status: "SUCCESS", provider: "openai", attempts: [{ provider: "gemini", outcome: "quota" }, { provider: "openai", outcome: "success" }] });
    expect(urls()[0]).toContain("generativelanguage.googleapis.com"); expect(urls()[1]).toBe("https://api.openai.com/v1/chat/completions");
    expect(h.authorized).toEqual(["gemini", "openai"]); // each provider gets its own consent receipt before it is contacted
    expect(providerStatuses().find(item => item.provider === "gemini")).toMatchObject({ state: "paused", pausedReason: "quota", retryAfterSeconds: 60 }); // the 34 s hint is raised to the 60 s minimum
  });

  it("never sends text to a fallback the person did not consent to, or whose policy changed since", async () => {
    setup();
    vi.mocked(fetch).mockResolvedValue(quota("10s"));
    for (const [consent, expected] of [[consentFor(false), ["gemini"]], [consentFor(true, true), ["gemini", "openai"]]] as const) {
      resetAiRuntimeState(); vi.mocked(fetch).mockClear();
      const h = hooks();
      const result = await analyzeOfferWithGateway(consent, h.hooks);
      expect(result.status).toBe("RATE_LIMITED"); expect(result.data).toBeNull();
      expect(urls().every(url => url.includes("generativelanguage"))).toBe(true); expect(h.authorized).toEqual(["gemini"]);
      expect(result.attempts?.map(item => item.provider) ?? ["gemini"]).toEqual(expected.length === 2 ? ["gemini", "openai"] : ["gemini"].slice(0, result.attempts?.length ?? 1));
    }
  });

  it("stops hammering an exhausted quota: the next request sends nothing and consumes no receipt", async () => {
    setup();
    vi.mocked(fetch).mockResolvedValue(quota("300s"));
    await analyzeOfferWithGateway(consentFor(false), hooks().hooks);
    expect(fetch).toHaveBeenCalledTimes(1);
    const h = hooks();
    const second = await analyzeOfferWithGateway(consentFor(false), h.hooks);
    expect(fetch).toHaveBeenCalledTimes(1); expect(h.authorized).toEqual([]);
    expect(second).toMatchObject({ status: "RATE_LIMITED", data: null, attempts: [{ provider: "gemini", outcome: "paused" }] });
    expect(second.retryAfterSeconds).toBeGreaterThan(250); expect(second.message).toMatch(/paused for about \d+ minutes/);
  });

  it("reports the earliest retry time when every consented provider is exhausted, and never fabricates an answer", async () => {
    setup();
    vi.mocked(fetch).mockResolvedValueOnce(quota("600s")).mockResolvedValueOnce(quota("120s"));
    const result = await analyzeOfferWithGateway(consentFor(true), hooks().hooks);
    expect(result).toMatchObject({ status: "RATE_LIMITED", data: null, retryAfterSeconds: 120 });
    expect(JSON.stringify(result)).not.toMatch(/synthetic-(gemini|openai)-key/);
  });

  it("retries a transient fault with backoff inside the same consent, and gives up after the bounded retries", async () => {
    setup();
    const sleeps: number[] = [];
    vi.mocked(fetch).mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(gemini());
    const ok = await analyzeOfferWithGateway(consentFor(false), hooks({ sleep: async ms => { sleeps.push(ms); } }).hooks);
    expect(ok.status).toBe("SUCCESS"); expect(sleeps).toEqual([500]); expect(fetch).toHaveBeenCalledTimes(2);
    resetAiRuntimeState(); vi.mocked(fetch).mockClear(); sleeps.length = 0;
    vi.mocked(fetch).mockResolvedValue(new Response("busy", { status: 503 }));
    const failed = await analyzeOfferWithGateway(consentFor(false), hooks({ sleep: async ms => { sleeps.push(ms); } }).hooks);
    expect(failed).toMatchObject({ status: "ERROR", data: null }); expect(sleeps).toEqual([500, 1500]); expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry timeouts, quota, rejected credentials or unusable output", async () => {
    setup();
    for (const failure of [() => Promise.reject(new DOMException("x", "TimeoutError")), () => Promise.resolve(quota()), () => Promise.resolve(new Response("no", { status: 403 })), () => Promise.resolve(gemini("{\"salary\": 1}"))]) {
      resetAiRuntimeState(); vi.mocked(fetch).mockReset(); vi.mocked(fetch).mockImplementation(failure as never);
      const result = await analyzeOfferWithGateway(consentFor(false), hooks().hooks);
      expect(result.data).toBeNull(); expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("skips a provider over its configured budget without sending anything", async () => {
    setup({ ORYQEN_AI_GEMINI_DAILY_REQUESTS: "1" });
    vi.mocked(fetch).mockResolvedValue(gemini());
    expect((await analyzeOfferWithGateway(consentFor(false), hooks().hooks)).status).toBe("SUCCESS");
    const h = hooks();
    const second = await analyzeOfferWithGateway(consentFor(false), h.hooks);
    expect(second).toMatchObject({ status: "ERROR", data: null }); expect(second.message).toMatch(/budget/); expect(fetch).toHaveBeenCalledTimes(1); expect(h.authorized).toEqual([]);
  });

  it("refuses to contact any provider when the consent receipt or budget admission is refused", async () => {
    setup();
    const { RATE } = { RATE: new Error("RATE_LIMITED") };
    await expect(analyzeOfferWithGateway(consentFor(false), hooks({ authorize: async () => { throw RATE; } }).hooks)).rejects.toThrow("RATE_LIMITED");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("answers UNCONFIGURED, sending nothing, when AI is not enabled or approved", async () => {
    setup({ ORYQEN_AI_POLICY_APPROVED: "false" });
    const result = await analyzeOfferWithGateway({ text: source, role: "WORKER" }, hooks().hooks);
    expect(result).toMatchObject({ configured: false, status: "UNCONFIGURED", data: null }); expect(fetch).not.toHaveBeenCalled();
  });

  it("sends only the redacted text, and a self-hosted model gets no OpenAI-only flag and no credential unless configured", async () => {
    setup({ ORYQEN_AI_FALLBACK_PROVIDERS: "selfhosted", ORYQEN_SELFHOSTED_AI_URL: "http://127.0.0.1:11434", ORYQEN_SELFHOSTED_AI_MODEL: "llama3.1:8b", ORYQEN_AI_SELFHOSTED_POLICY_APPROVAL_REF: "synthetic-approval-self", ORYQEN_AI_SELFHOSTED_PROCESSING_REGION: "On premises", ORYQEN_AI_SELFHOSTED_DATA_USE: "Not retained" });
    const self = aiFallbackConfigurations()[0]!;
    const input: AnalyzeOfferInput = { text: `Contact: private@example.test\n${source}`, role: "WORKER", consent: { provider: "gemini", noticeVersion: "offer-analysis.v1", transmit: true, policyHash: aiConfiguration()!.policyHash, fallbacks: [{ provider: "selfhosted", policyHash: self.policyHash }] } };
    vi.mocked(fetch).mockResolvedValueOnce(new Response("down", { status: 401 })).mockResolvedValueOnce(chat());
    const result = await analyzeOfferWithGateway(input, hooks().hooks);
    expect(result).toMatchObject({ status: "SUCCESS", provider: "selfhosted" });
    const [geminiCall, selfCall] = vi.mocked(fetch).mock.calls;
    expect(String(geminiCall![1]!.body)).not.toContain("private@example.test"); expect(String(selfCall![1]!.body)).not.toContain("private@example.test");
    expect(String(selfCall![0])).toBe("http://127.0.0.1:11434/v1/chat/completions");
    expect(JSON.parse(String(selfCall![1]!.body)).store).toBeUndefined(); expect(new Headers(selfCall![1]!.headers).get("authorization")).toBeNull();
    expect(selfCall![1]!.redirect).toBe("error");
  });
});
