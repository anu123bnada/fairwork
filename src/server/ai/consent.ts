import "server-only";
import { createHash } from "node:crypto";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { createServerSupabase } from "@/server/supabase";
import { aiConfiguration } from "./config";
import type { AnalyzeOfferInput } from "@/features/offer/ai-schema";
import { redactOfferForAi } from "@/features/offer/ai-redaction";
import {z} from "zod";
export async function authorizeAiTransmission(input: AnalyzeOfferInput) {
 const config = aiConfiguration();
 if (!config) return;
 if (input.consent?.provider !== config.provider || input.consent.policyHash !== config.policyHash || input.consent.noticeVersion !== "offer-analysis.v1" || !input.consent.transmit) throw new AppError("ACTION_FORBIDDEN", 403);
 const client = await createServerSupabase(true);
 const { data,error } = await client.rpc("authorize_ai_transmission", { request: {
  provider: config.provider, model: config.model, consent: true, noticeVersion: input.consent.noticeVersion,
  processingRegion: config.processingRegion, dataUse: config.dataUse, policyHash: config.policyHash,
  inputHash: createHash("sha256").update(redactOfferForAi(input.text)).digest("hex"),
 } });
 if (error) throw mapDatabaseError(error);
 const parsed=z.strictObject({authorizationId:z.uuid()}).safeParse(data);
 if(!parsed.success)throw new AppError("SERVICE_UNAVAILABLE",503);
 return parsed.data.authorizationId;
}
