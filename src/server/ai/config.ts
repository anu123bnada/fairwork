import "server-only";
import { createHash } from "node:crypto";
import { AI_REDACTION_VERSION } from "@/features/offer/ai-redaction";
export function aiConfiguration() {
 const provider = process.env.ORYQEN_AI_PROVIDER ?? "gemini";
 const model = provider === "openai" ? process.env.OPENAI_MODEL ?? "gpt-4o-mini" : process.env.GEMINI_MODEL;
 const key = provider === "openai" ? process.env.OPENAI_API_KEY : provider === "gemini" ? process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY : undefined;
 const processingRegion = process.env.ORYQEN_AI_PROCESSING_REGION?.trim();
 const dataUse = process.env.ORYQEN_AI_DATA_USE?.trim();
 const approval = process.env.ORYQEN_AI_POLICY_APPROVAL_REF?.trim();
 if (process.env.ORYQEN_AI_ENABLED !== "true" || process.env.ORYQEN_AI_POLICY_APPROVED !== "true" || !approval || approval.length < 10 || approval.length > 200 || !key || (provider !== "openai" && provider !== "gemini") || !model || !/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,99}$/.test(model) || (provider === "gemini" && !model.startsWith("gemini-")) || !processingRegion || processingRegion.length > 120 || !dataUse || dataUse.length > 1000) return null;
 const product = provider === "gemini" ? "gemini-developer-api" : "openai-api";
 const policyHash = createHash("sha256").update(JSON.stringify({ provider, product, model, processingRegion, dataUse, approval, redaction: AI_REDACTION_VERSION, noticeVersion: "offer-analysis.v1" })).digest("hex");
 return { provider, model, key, processingRegion, dataUse, policyHash };
}
