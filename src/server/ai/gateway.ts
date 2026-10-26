import "server-only";
import { aiConfiguration, aiFallbackConfigurations, type AiProviderConfig } from "./config";
import { breaker, ledger } from "./breaker";
import { failureResponse, runProvider, unconfiguredResponse, type AiAttempt } from "./provider";
import { redactOfferForAi } from "@/features/offer/ai-redaction";
import type { AiOfferAnalysisResponse, AnalyzeOfferInput } from "@/features/offer/ai-schema";
import type { FailureKind } from "./failure";

// The AI gateway: one server-side entry point that tries the person's consented providers in order.
//  - The primary provider is always first. A fallback receives the offer text only when the person's consent names it AND carries
//    that provider's current policy hash, so approving or consenting to one provider never approves another.
//  - A provider that is paused (circuit open), over its budget or consented with a stale policy is skipped before anything is
//    authorized or sent. An exhausted quota is never retried: the breaker keeps the provider paused for its own reset hint.
//  - Each provider is tried once per request (plus bounded retries for transient faults inside runProvider). No queue holds the text.
//  - If nobody can answer, the person gets an explicit unavailable state with the earliest known retry time, and deterministic checks
//    keep working. A response is never invented.
export type GatewayHooks = {
  // Records the durable consent receipt and budget admission for ONE provider immediately before it is contacted. Throws to refuse.
  authorize: (config: AiProviderConfig) => Promise<string | undefined>;
  onEvent?: (event: { phase: "attempt" | "outcome"; provider: string; authorizationId?: string; kind?: "success" | FailureKind }) => Promise<void> | void;
  observeUsage?: (usage: { inputTokens?: number; outputTokens?: number }) => void;
  sleep?: (ms: number) => Promise<void>;
};

export type ProviderStatus = {
  provider: string; role: "primary" | "fallback"; model: string; processingRegion: string; dataUse: string; policyHash: string;
  state: "available" | "paused" | "over_budget"; pausedReason: FailureKind | null; retryAfterSeconds: number;
};

export function providerStatuses(): ProviderStatus[] {
  const all: [AiProviderConfig, "primary" | "fallback"][] = [];
  const primary = aiConfiguration();
  if (primary) all.push([primary, "primary"]);
  for (const config of aiFallbackConfigurations()) all.push([config, "fallback"]);
  return all.map(([config, role]) => {
    const state = breaker.peek(config.provider), within = ledger.withinBudget(config.provider, config.budget);
    return {
      provider: config.provider, role, model: config.model, processingRegion: config.processingRegion, dataUse: config.dataUse, policyHash: config.policyHash,
      state: state.status === "open" ? "paused" : !within ? "over_budget" : "available", pausedReason: state.status === "open" ? state.reason : null, retryAfterSeconds: state.retryAfterSeconds,
    };
  });
}

export async function analyzeOfferWithGateway(input: AnalyzeOfferInput, hooks: GatewayHooks): Promise<AiOfferAnalysisResponse> {
  const primary = aiConfiguration();
  if (!primary) return unconfiguredResponse();
  const consented = new Map((input.consent?.fallbacks ?? []).map(entry => [entry.provider, entry.policyHash]));
  const candidates: { config: AiProviderConfig; stale: boolean }[] = [{ config: primary, stale: false }];
  for (const config of aiFallbackConfigurations()) if (consented.has(config.provider)) candidates.push({ config, stale: consented.get(config.provider) !== config.policyHash });

  const text = redactOfferForAi(input.text);
  const attempts: AiAttempt[] = [];
  const pauses: number[] = [];
  let last: AiOfferAnalysisResponse | null = null, quotaResponse: AiOfferAnalysisResponse | null = null, sawQuota = false;
  for (const { config, stale } of candidates) {
    const provider = config.provider;
    if (stale) { attempts.push({ provider, outcome: "consent_stale" }); continue; }
    const state = breaker.peek(provider);
    if (state.status === "open") { attempts.push({ provider, outcome: "paused" }); last = failureResponse(provider, state.reason ?? "unavailable", state.retryAfterSeconds, true); if (state.reason === "quota") { sawQuota = true; pauses.push(state.retryAfterSeconds); quotaResponse = last; } continue; }
    if (!ledger.withinBudget(provider, config.budget)) { attempts.push({ provider, outcome: "budget" }); last = failureResponse(provider, "budget", null); continue; }
    const authorizationId = await hooks.authorize(config); // may throw: a refused receipt or budget means nothing is sent
    await hooks.onEvent?.({ phase: "attempt", provider, authorizationId });
    const result = await runProvider(config, text, input.role, { observeUsage: hooks.observeUsage, sleep: hooks.sleep });
    attempts.push({ provider, outcome: result.failure ?? "success" });
    await hooks.onEvent?.({ phase: "outcome", provider, authorizationId, kind: result.failure ?? "success" });
    if (!result.failure) return { ...result.response, ...(attempts.length > 1 ? { attempts: attempts.map(a => ({ provider: a.provider as "gemini" | "openai" | "selfhosted", outcome: a.outcome })) } : {}) };
    last = result.response;
    if (result.failure === "quota") { sawQuota = true; quotaResponse = result.response; if (result.retryAfterSeconds !== null) pauses.push(result.retryAfterSeconds); }
  }
  // Nobody could answer. Prefer the quota explanation (with the earliest known retry time) because it is the actionable one.
  const base = (sawQuota ? quotaResponse : last) ?? unconfiguredResponse();
  const retryAfterSeconds = pauses.length ? Math.min(...pauses) : undefined;
  return {
    ...base,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    ...(attempts.length > 1 || attempts[0]?.outcome === "paused" ? { attempts: attempts.map(a => ({ provider: a.provider as "gemini" | "openai" | "selfhosted", outcome: String(a.outcome) })) } : {}),
  };
}
