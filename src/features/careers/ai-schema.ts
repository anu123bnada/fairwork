import { z } from "zod";
import { sampleCareers } from "./sample-data";

// Real-AI career assistant. Shared by the browser (to show exactly what will be sent) and the server (to validate it).
export const ASSISTANT_NOTICE = "career-assistant.v1" as const;
export const ASSISTANT_QUESTION_LIMIT = 600;
const provider = z.enum(["openai", "gemini", "selfhosted"]);

export const knownSampleSkills: ReadonlySet<string> = new Set(sampleCareers.flatMap(career => career.skills.map(skill => skill.name)));

// The exact text a provider receives (before minimization). Only skills from the sample framework are included, never free text other than the question.
export function assistantUserPrompt(question: string, context: { role: string; skills: readonly string[] }) {
  const skills = context.skills.filter(skill => knownSampleSkills.has(skill)).slice(0, 40);
  return `Context (sample data chosen by the person):\nTarget role: ${context.role}\nSkills ticked: ${skills.length ? skills.join(", ") : "none"}\n\nQuestion:\n${question.trim()}`;
}

export const assistantAskSchema = z.strictObject({
  question: z.string().trim().min(3).max(ASSISTANT_QUESTION_LIMIT),
  careerId: z.string().regex(/^[a-z0-9-]{1,40}$/),
  skills: z.array(z.string().min(1).max(60)).max(40),
  consent: z.strictObject({ provider, policyHash: z.string().regex(/^[0-9a-f]{64}$/), noticeVersion: z.literal(ASSISTANT_NOTICE), transmit: z.literal(true), adultConfirmed: z.literal(true) }),
});
export type AssistantAsk = z.infer<typeof assistantAskSchema>;

export const assistantConfigSchema = z.strictObject({
  configured: z.boolean(), provider: provider.nullable(), model: z.string().nullable(), noticeVersion: z.literal(ASSISTANT_NOTICE),
  processingRegion: z.string().nullable(), dataUse: z.string().nullable(), policyHash: z.string().nullable(),
});
export type AssistantConfig = z.infer<typeof assistantConfigSchema>;

export const assistantAnswerSchema = z.strictObject({
  status: z.enum(["SUCCESS", "UNCONFIGURED", "RATE_LIMITED", "ERROR"]), provider: provider.nullable(), model: z.string().nullable(),
  answer: z.string().min(1).max(2400).nullable(), message: z.string().max(600), isAdvisory: z.literal(true), retryAfterSeconds: z.number().int().nonnegative().optional(),
});
export type AssistantAnswerResponse = z.infer<typeof assistantAnswerSchema>;
