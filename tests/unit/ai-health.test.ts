import { describe, expect, it, vi } from "vitest";
import { probeAll, probeProvider, providersFromEnv } from "../../scripts/ai-health.mjs";

const json = (status: number, body: unknown = {}) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const env = { ORYQEN_AI_PROVIDER: "gemini", GEMINI_API_KEY: "synthetic-key", GEMINI_MODEL: "gemini-synthetic", ORYQEN_AI_FALLBACK_PROVIDERS: "openai,selfhosted,openai", OPENAI_API_KEY: "synthetic-openai", OPENAI_MODEL: "gpt-synthetic", ORYQEN_SELFHOSTED_AI_URL: "http://127.0.0.1:11434/", ORYQEN_SELFHOSTED_AI_MODEL: "llama3.1:8b" };

describe("provider availability probe", () => {
  it("names each provider once, primary first, and sends metadata requests only", async () => {
    expect(providersFromEnv(env).map(item => [item.provider, item.role])).toEqual([["gemini", "primary"], ["openai", "fallback"], ["selfhosted", "fallback"]]);
    const fetcher = vi.fn((url: string) => url.includes("generativelanguage") ? json(200, { supportedGenerationMethods: ["generateContent"] }) : url.endsWith("/v1/models") ? json(200, { data: [{ id: "llama3.1:8b" }] }) : json(200, { id: "gpt-synthetic" }));
    const results = await probeAll(env, fetcher as unknown as typeof fetch);
    expect(results.map(item => item.verdict)).toEqual(["available", "available", "available"]);
    for (const call of fetcher.mock.calls) { expect((call as unknown[])[1]).toMatchObject({ redirect: "error" }); expect(JSON.stringify(call)).not.toMatch(/prompt|contents|messages|offer/i); }
    expect(JSON.stringify(results)).not.toContain("synthetic-key");
  });
  it("classifies failures without echoing provider text", async () => {
    const gemini = providersFromEnv(env)[0]!;
    for (const [status, verdict] of [[429, "quota_or_rate_limited"], [404, "model_not_found"], [403, "rejected"], [401, "rejected"], [503, "provider_unavailable"], [418, "unexpected_response"]] as const)
      expect((await probeProvider(gemini, (() => json(status, { error: { message: "private provider text" } })) as unknown as typeof fetch)).verdict).toBe(verdict);
    expect((await probeProvider(gemini, (() => json(200, { supportedGenerationMethods: ["embedContent"] })) as unknown as typeof fetch)).verdict).toBe("model_cannot_generate");
    expect((await probeProvider(gemini, (() => Promise.reject(new DOMException("x", "TimeoutError"))) as unknown as typeof fetch)).verdict).toBe("timeout");
    expect((await probeProvider(gemini, (() => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch)).verdict).toBe("unreachable");
  });
  it("reports missing configuration without any request", async () => {
    const fetcher = vi.fn();
    const none = await probeAll({ ORYQEN_AI_PROVIDER: "gemini" }, fetcher as unknown as typeof fetch);
    expect(none[0]).toMatchObject({ verdict: "not_configured" }); expect(fetcher).not.toHaveBeenCalled();
    expect((await probeProvider({ provider: "selfhosted", role: "fallback", model: "m1", baseUrl: "http://llm.example.test" }, fetcher as unknown as typeof fetch)).verdict).toBe("not_configured"); // plain http is only allowed on loopback
    expect((await probeProvider({ provider: "gemini", role: "primary", key: "k", model: "../x?y" }, fetcher as unknown as typeof fetch)).verdict).toBe("not_configured");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
