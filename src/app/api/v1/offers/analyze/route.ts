import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { analyzeOfferInputSchema } from "@/features/offer/ai-schema";
import { analyzeOfferWithGateway, providerStatuses } from "@/server/ai/gateway";
import { identityCommand } from "@/server/identity";
import { assertPrimaryConsent, authorizeProviderTransmission } from "@/server/ai/consent";
import { aiConfiguration, aiFallbackConfigurations } from "@/server/ai/config";
import {recordRuntimeEvent} from "@/server/telemetry";

export const dynamic = "force-dynamic";
// The provider call may legitimately take longer than the platform default (see GEMINI_TIMEOUT_MS).
export const maxDuration = 60;

export async function GET() {
  return apiResponse(async () => {
    await identityCommand("get_me", {});
    const config = aiConfiguration();
    const status = providerStatuses();
    const describe = (provider: { provider: string; model: string; processingRegion: string; dataUse: string; policyHash: string }) => ({ provider: provider.provider, model: provider.model, processingRegion: provider.processingRegion, dataUse: provider.dataUse, policyHash: provider.policyHash });
    return {
      configured: Boolean(config), provider: config?.provider ?? null, model: config?.model ?? null, noticeVersion: "offer-analysis.v1", processingRegion: config?.processingRegion ?? null, dataUse: config?.dataUse ?? null, policyHash: config?.policyHash ?? null,
      // Optional fallbacks, each approved on its own. Offer text goes to one only if the person's consent names it.
      fallbacks: aiFallbackConfigurations().map(describe),
      availability: status.map(item => ({ provider: item.provider, role: item.role, state: item.state, retryAfterSeconds: item.retryAfterSeconds })),
    };
  }, "offer-ai-configuration.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    await identityCommand("get_me", {});
    const input = await readJson(request, analyzeOfferInputSchema);
    const primary = assertPrimaryConsent(input); // refuses before anything else when consent is missing or stale
    const started = new Map<string, number>(), usages = new Map<string, { inputTokens?: number; outputTokens?: number }>();
    let current = "";
    const result = await analyzeOfferWithGateway(input, {
      authorize: config => authorizeProviderTransmission(config, input.text),
      observeUsage: value => { usages.set(current, value); },
      onEvent: async event => {
        const operation = `offer.analysis.${event.provider}`;
        if (event.phase === "attempt") { current = event.provider; started.set(event.provider, Date.now()); if (event.authorizationId) await recordRuntimeEvent({ id: crypto.randomUUID(), kind: "ai_attempt", operation, authorizationId: event.authorizationId }); return; }
        if (!event.authorizationId) return;
        const kind = event.kind === "success" ? "ai_success" : event.kind === "quota" ? "ai_rate_limited" : "ai_error";
        await recordRuntimeEvent({ id: crypto.randomUUID(), kind, operation, authorizationId: event.authorizationId, durationMs: Math.min(120000, Date.now() - (started.get(event.provider) ?? Date.now())), ...(event.kind === "success" ? usages.get(event.provider) ?? {} : {}) });
      },
    });
    if (!primary) await recordRuntimeEvent({ id: crypto.randomUUID(), kind: "ai_unconfigured", operation: "offer.analysis" });
    // A session/account can lose access while the external request is in flight.
    await identityCommand("get_me", {});
    return result;
  }, "offer-ai-analysis.v1");
}
