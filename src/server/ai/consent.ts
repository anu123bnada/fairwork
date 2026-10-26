import "server-only";
import { createHash } from "node:crypto";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { createServerSupabase } from "@/server/supabase";
import { aiConfiguration, type AiProviderConfig } from "./config";
import type { AnalyzeOfferInput } from "@/features/offer/ai-schema";
import { redactOfferForAi } from "@/features/offer/ai-redaction";
import { z } from "zod";

// The person's consent must name the primary provider and carry its CURRENT policy hash. Fallback providers are checked separately,
// and only those named in the consent are ever contacted (see gateway.ts).
export function assertPrimaryConsent(input: AnalyzeOfferInput) {
  const config = aiConfiguration();
  if (!config) return null;
  if (input.consent?.provider !== config.provider || input.consent.policyHash !== config.policyHash || input.consent.noticeVersion !== "offer-analysis.v1" || !input.consent.transmit) throw new AppError("ACTION_FORBIDDEN", 403);
  return config;
}

// Durable consent receipt and budget admission for one provider, recorded just before that provider is contacted. It stores a hash of
// the redacted text, never the text.
export async function authorizeProviderTransmission(config: AiProviderConfig, text: string) {
  const client = await createServerSupabase(true);
  const { data, error } = await client.rpc("authorize_ai_transmission", { request: {
    provider: config.provider, model: config.model, consent: true, noticeVersion: "offer-analysis.v1",
    processingRegion: config.processingRegion, dataUse: config.dataUse, policyHash: config.policyHash,
    inputHash: createHash("sha256").update(redactOfferForAi(text)).digest("hex"),
  } });
  if (error) throw mapDatabaseError(error);
  const parsed = z.strictObject({ authorizationId: z.uuid() }).safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data.authorizationId;
}

export async function authorizeAiTransmission(input: AnalyzeOfferInput) {
  const config = assertPrimaryConsent(input);
  if (!config) return;
  return authorizeProviderTransmission(config, input.text);
}
