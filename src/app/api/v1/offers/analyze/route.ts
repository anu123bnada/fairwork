import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { analyzeOfferInputSchema } from "@/features/offer/ai-schema";
import { executeAiOfferAnalysis } from "@/server/ai/provider";
import { identityCommand } from "@/server/identity";
import { authorizeAiTransmission } from "@/server/ai/consent";
import { aiConfiguration } from "@/server/ai/config";
import {recordRuntimeEvent} from "@/server/telemetry";

export const dynamic = "force-dynamic";
// The provider call may legitimately take longer than the platform default (see GEMINI_TIMEOUT_MS).
export const maxDuration = 60;

export async function GET() {
  return apiResponse(async () => {
    await identityCommand("get_me", {});
    const config = aiConfiguration();
    return { configured: Boolean(config), provider: config?.provider ?? null, model: config?.model ?? null, noticeVersion: "offer-analysis.v1", processingRegion: config?.processingRegion ?? null, dataUse: config?.dataUse ?? null, policyHash: config?.policyHash ?? null };
  }, "offer-ai-configuration.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    await identityCommand("get_me", {});
    const input = await readJson(request, analyzeOfferInputSchema);
    const authorizationId=await authorizeAiTransmission(input);
    const started=Date.now();
    if(authorizationId)await recordRuntimeEvent({id:crypto.randomUUID(),kind:"ai_attempt",operation:"offer.analysis",authorizationId});
    let usage:{inputTokens?:number;outputTokens?:number}={};
    const result = await executeAiOfferAnalysis(input.text, input.role,value=>{usage=value;});
    if(authorizationId&&result.status!=="UNCONFIGURED")await recordRuntimeEvent({id:crypto.randomUUID(),kind:result.status==="SUCCESS"?"ai_success":result.status==="RATE_LIMITED"?"ai_rate_limited":"ai_error",operation:"offer.analysis",authorizationId,durationMs:Math.min(120000,Date.now()-started),...(result.status==="SUCCESS"?usage:{})});
    else if(!authorizationId)await recordRuntimeEvent({id:crypto.randomUUID(),kind:"ai_unconfigured",operation:"offer.analysis"});
    // A session/account can lose access while the external request is in flight.
    await identityCommand("get_me", {});
    return result;
  }, "offer-ai-analysis.v1");
}
