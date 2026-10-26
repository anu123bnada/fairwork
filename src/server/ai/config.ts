import "server-only";
import { createHash } from "node:crypto";
import { AI_REDACTION_VERSION } from "@/features/offer/ai-redaction";

// Provider configuration for the AI gateway. A provider is usable only when the owner has enabled AI, approved the data-processing
// policy in writing for THAT provider (reference, processing region and data-use text), and supplied its credentials and model.
// Nothing here calls a provider.
export const aiProviderIds = ["gemini", "openai", "selfhosted"] as const;
export type AiProviderId = (typeof aiProviderIds)[number];
export const isAiProviderId = (value: unknown): value is AiProviderId => (aiProviderIds as readonly string[]).includes(value as string);

export type AiProviderConfig = {
  provider: AiProviderId; model: string; key: string | undefined; baseUrl: string | null;
  processingRegion: string; dataUse: string; policyHash: string;
  budget: { requests: number | null; tokens: number | null };
};
type Env = Record<string, string | undefined>;

const PRODUCT: Record<AiProviderId, string> = { gemini: "gemini-developer-api", openai: "openai-api", selfhosted: "selfhosted-openai-compatible" };
const upper = (provider: AiProviderId) => provider.toUpperCase();
const positive = (value: string | undefined) => { const n = Number(value); return value && Number.isInteger(n) && n > 0 ? n : null; };
const loopback = (url: URL) => ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

// Provider-specific variables (ORYQEN_AI_<PROVIDER>_*) take precedence. The unsuffixed legacy names apply to the primary provider only,
// so approving one provider never silently approves another.
function setting(env: Env, provider: AiProviderId, name: string, primary: boolean) {
  const specific = env[`ORYQEN_AI_${upper(provider)}_${name}`]?.trim();
  return specific || (primary ? env[`ORYQEN_AI_${name}`]?.trim() : undefined);
}

export function aiProviderConfiguration(provider: AiProviderId, primary: boolean, env: Env = process.env): AiProviderConfig | null {
  if (env.ORYQEN_AI_ENABLED !== "true" || env.ORYQEN_AI_POLICY_APPROVED !== "true") return null;
  const processingRegion = setting(env, provider, "PROCESSING_REGION", primary), dataUse = setting(env, provider, "DATA_USE", primary), approval = setting(env, provider, "POLICY_APPROVAL_REF", primary);
  let key: string | undefined, model: string | undefined, baseUrl: string | null = null;
  if (provider === "gemini") { key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY; model = env.GEMINI_MODEL; }
  else if (provider === "openai") { key = env.OPENAI_API_KEY; model = env.OPENAI_MODEL ?? "gpt-4o-mini"; }
  else {
    key = env.ORYQEN_SELFHOSTED_AI_KEY || undefined; model = env.ORYQEN_SELFHOSTED_AI_MODEL;
    try { const url = new URL(env.ORYQEN_SELFHOSTED_AI_URL ?? ""); if (url.protocol === "https:" || (url.protocol === "http:" && loopback(url))) baseUrl = url.origin + url.pathname.replace(/\/+$/, ""); } catch { baseUrl = null; }
    if (!baseUrl) return null;
  }
  if (provider !== "selfhosted" && !key) return null;
  if (!approval || approval.length < 10 || approval.length > 200 || !model || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,99}$/.test(model) || (provider === "gemini" && !model.startsWith("gemini-"))
    || !processingRegion || processingRegion.length > 120 || !dataUse || dataUse.length > 1000) return null;
  const policyHash = createHash("sha256").update(JSON.stringify({ provider, product: PRODUCT[provider], model, processingRegion, dataUse, approval, redaction: AI_REDACTION_VERSION, noticeVersion: "offer-analysis.v1", ...(baseUrl ? { baseUrl } : {}) })).digest("hex");
  return { provider, model, key, baseUrl, processingRegion, dataUse, policyHash, budget: { requests: positive(env[`ORYQEN_AI_${upper(provider)}_DAILY_REQUESTS`]), tokens: positive(env[`ORYQEN_AI_${upper(provider)}_DAILY_TOKENS`]) } };
}

// The primary provider, exactly as before: ORYQEN_AI_PROVIDER (default gemini).
export function aiConfiguration(env: Env = process.env): (AiProviderConfig & { key: string }) | null {
  const provider = env.ORYQEN_AI_PROVIDER ?? "gemini";
  if (!isAiProviderId(provider)) return null;
  const config = aiProviderConfiguration(provider, true, env);
  return config && (config.key !== undefined || provider === "selfhosted") ? config as AiProviderConfig & { key: string } : null;
}

// Optional fallback providers in order (ORYQEN_AI_FALLBACK_PROVIDERS="openai,selfhosted"). Each must be approved on its own. Offer text is
// sent to a fallback only when the person's consent names that provider and its policy hash.
export function aiFallbackConfigurations(env: Env = process.env): AiProviderConfig[] {
  const primary = env.ORYQEN_AI_PROVIDER ?? "gemini";
  const listed = (env.ORYQEN_AI_FALLBACK_PROVIDERS ?? "").split(",").map(item => item.trim()).filter(Boolean);
  const seen = new Set<string>([primary]);
  const configs: AiProviderConfig[] = [];
  for (const item of listed) {
    if (!isAiProviderId(item) || seen.has(item)) continue;
    seen.add(item);
    const config = aiProviderConfiguration(item, false, env);
    if (config) configs.push(config);
  }
  return configs;
}
