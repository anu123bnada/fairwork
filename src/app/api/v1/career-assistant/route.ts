import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { identityCommand } from "@/server/identity";
import { aiConfiguration } from "@/server/ai/config";
import { assertAssistantConsent, authorizeAssistantTransmission } from "@/server/ai/consent";
import { askAssistantWithGateway } from "@/server/ai/gateway";
import { recordRuntimeEvent } from "@/server/telemetry";
import { AppError } from "@/lib/errors";
import { ASSISTANT_NOTICE, assistantAskSchema, assistantUserPrompt, type AssistantAnswerResponse } from "@/features/careers/ai-schema";
import { sampleCareerById } from "@/features/careers/sample-data";
import { redactOfferForAi } from "@/features/offer/ai-redaction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Whether real AI answers are available, and under which approved policy. Signed-in people only.
export async function GET() {
  return apiResponse(async () => {
    await identityCommand("get_me", {});
    const config = aiConfiguration();
    return { configured: Boolean(config), provider: config?.provider ?? null, model: config?.model ?? null, noticeVersion: ASSISTANT_NOTICE, processingRegion: config?.processingRegion ?? null, dataUse: config?.dataUse ?? null, policyHash: config?.policyHash ?? null };
  }, "career-assistant-configuration.v1");
}

// One consented question to the approved primary provider. Nothing is stored except the consent receipt (a hash of the minimized text) and content-free telemetry.
export async function POST(request: Request) {
  return apiResponse(async (): Promise<AssistantAnswerResponse> => {
    assertSameOrigin(request);
    await identityCommand("get_me", {});
    const input = await readJson(request, assistantAskSchema);
    const primary = assertAssistantConsent(input); // refuses before anything else when the consent does not name the current provider and policy
    const career = sampleCareerById(input.careerId);
    if (!career) throw new AppError("VALIDATION_FAILED", 400);
    const text = redactOfferForAi(assistantUserPrompt(input.question, { role: career.title, skills: input.skills }));
    let started = Date.now();
    const result = await askAssistantWithGateway(text, {
      authorize: config => authorizeAssistantTransmission(config, text),
      onEvent: async event => {
        const operation = `career.assistant.${event.provider}`;
        if (!event.authorizationId) return;
        if (event.phase === "attempt") { started = Date.now(); await recordRuntimeEvent({ id: crypto.randomUUID(), kind: "ai_attempt", operation, authorizationId: event.authorizationId }); return; }
        const kind = event.kind === "success" ? "ai_success" : event.kind === "quota" ? "ai_rate_limited" : "ai_error";
        await recordRuntimeEvent({ id: crypto.randomUUID(), kind, operation, authorizationId: event.authorizationId, durationMs: Math.min(120000, Date.now() - started), ...(event.usage ?? {}) });
      },
    });
    if (!primary) await recordRuntimeEvent({ id: crypto.randomUUID(), kind: "ai_unconfigured", operation: "career.assistant" });
    // A session or account can lose access while the external request is in flight.
    await identityCommand("get_me", {});
    return result;
  }, "career-assistant-answer.v1");
}
