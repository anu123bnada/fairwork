import { z } from "zod";
import { appRequest } from "@/features/authority/client";
import { aiOfferAnalysisResponseSchema, type AiOfferAnalysisResponse } from "@/features/offer/ai-schema";

// The Analyze button's run: save the offer, check it with rules on this device, and, only when the owner has configured AI and the person has consented, ask the model.
// Every stage changes when the work behind it really finishes. Nothing is faked, and the offer text goes to a provider only after explicit consent.
export type AnalysisStageId = "save" | "rules" | "ai";
export type AnalysisStageState = "pending" | "active" | "done" | "skipped" | "failed";
export type AnalysisStage = { id: AnalysisStageId; state: AnalysisStageState; detail: string };
export const analysisStageOrder: readonly AnalysisStageId[] = ["save", "rules", "ai"];
export const newAnalysisStages = (): AnalysisStage[] => analysisStageOrder.map(id => ({ id, state: "pending", detail: "" }));
export const updateAnalysisStage = (stages: AnalysisStage[], id: AnalysisStageId, state: AnalysisStageState, detail = ""): AnalysisStage[] =>
  stages.map(stage => stage.id === id ? { id, state, detail } : stage);

const providerId = z.enum(["openai", "gemini", "selfhosted"]);
export const aiConfigView = z.looseObject({
  configured: z.boolean(), provider: providerId.nullable(), model: z.string().nullable(), noticeVersion: z.literal("offer-analysis.v1"),
  processingRegion: z.string().nullable(), dataUse: z.string().nullable(), policyHash: z.string().nullable(),
  availability: z.array(z.looseObject({ provider: providerId, role: z.enum(["primary", "fallback"]), state: z.enum(["available", "paused", "over_budget"]), retryAfterSeconds: z.number() })).default([]),
});
export type AiConfigView = z.infer<typeof aiConfigView>;

// Reads the configuration only: no offer text is sent and no AI quota is used.
export async function fetchAiConfig(): Promise<AiConfigView | null> {
  try { return aiConfigView.parse(await appRequest("/api/v1/offers/analyze")); } catch { return null; }
}
export const aiUsable = (config: AiConfigView | null): config is AiConfigView & { provider: z.infer<typeof providerId>; policyHash: string } =>
  Boolean(config?.configured && config.provider && config.policyHash && config.availability.every(item => item.role !== "primary" || item.state === "available"));

export type AnalysisAi =
  | { state: "not_requested" | "not_configured" }
  | { state: "done"; provider: string; model: string; response: AiOfferAnalysisResponse }
  | { state: "failed" | "cancelled"; message: string };
export type AnalysisRun = { offerId: string; title: string; saved: boolean; text: string; role: "WORKER" | "EMPLOYER"; ranAt: string; ai: AnalysisAi };

// The text the analysis reads: the pasted or scanned text if there is some, otherwise the typed terms written out as plain lines.
export function analysisText(sourceText: string, terms: Record<string, string | number>): string {
  const typed = Object.entries(terms).filter(([, value]) => String(value).trim() !== "").map(([field, value]) => `${field.replace(/([A-Z])/g, " $1")}: ${value}`).join("\n");
  const text = sourceText.trim().length >= 10 ? sourceText.trim() : typed;
  return text.slice(0, 10000);
}

// One real request. `consent` is the person's explicit confirmation for this provider and this policy version; the server refuses without it and checks it again.
export async function runAiAnalysis(input: { text: string; role: "WORKER" | "EMPLOYER"; config: AiConfigView & { provider: z.infer<typeof providerId>; policyHash: string }; signal?: AbortSignal }): Promise<AiOfferAnalysisResponse> {
  const raw = await appRequest("/api/v1/offers/analyze", {
    text: input.text, role: input.role,
    consent: { provider: input.config.provider, noticeVersion: input.config.noticeVersion, policyHash: input.config.policyHash, transmit: true, adultConfirmed: true },
  }, undefined, "POST", { signal: input.signal, timeoutMs: 120000 });
  // The answer is validated strictly. One that does not fit is discarded with a plain message instead of showing a technical error.
  const parsed = aiOfferAnalysisResponseSchema.safeParse(raw);
  if (!parsed.success) throw new AiAnswerFormatError();
  return parsed.data;
}
export class AiAnswerFormatError extends Error { constructor() { super("The AI answer was not in the expected format."); } }
