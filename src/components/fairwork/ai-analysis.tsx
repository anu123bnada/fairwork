"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { appRequest } from "@/features/authority/client";
import { aiOfferAnalysisResponseSchema, type AiOfferAnalysisResponse } from "@/features/offer/ai-schema";
import { redactOfferForAi } from "@/features/offer/ai-redaction";
const providerName = z.enum(["openai", "gemini", "selfhosted"]);
const providerInfo = z.strictObject({ provider: providerName, model: z.string(), processingRegion: z.string(), dataUse: z.string(), policyHash: z.string() });
const configSchema = z.strictObject({
  configured: z.boolean(), provider: providerName.nullable(), model: z.string().nullable(), noticeVersion: z.literal("offer-analysis.v1"), processingRegion: z.string().nullable(), dataUse: z.string().nullable(), policyHash: z.string().nullable(),
  fallbacks: z.array(providerInfo).max(2).default([]),
  availability: z.array(z.strictObject({ provider: providerName, role: z.enum(["primary", "fallback"]), state: z.enum(["available", "paused", "over_budget"]), retryAfterSeconds: z.number().int().nonnegative() })).max(3).default([]),
});
const NAMES = { gemini: "Google Gemini", openai: "OpenAI", selfhosted: "the operator's self-hosted model" } as const;
const OUTCOME: Record<string, string> = { success: "answered", quota: "quota reached", paused: "paused, nothing sent", budget: "usage budget reached", configuration: "rejected the configuration", model: "model not found", unavailable: "temporarily unavailable", network: "could not be reached", timeout: "timed out", incomplete: "answer incomplete", blocked: "declined", invalid: "answer not usable", consent_stale: "not used: its policy changed" };
export function AiAnalysis({ text, role }: { text: string; role: "WORKER" | "EMPLOYER" }) {
 const [config, setConfig] = useState<z.infer<typeof configSchema> | null>(null);
 const context = JSON.stringify([text, role]);
 const [consentedText, setConsentedText] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
 const [fallbackAccepted, setFallbackAccepted] = useState<Record<string, boolean>>({});
 const consent = consentedText === context;
 const [response, setResponse] = useState<{ context: string; data: AiOfferAnalysisResponse } | null>(null);
 const result = response?.context === context ? response.data : null;
 useEffect(() => {
  let active = true;
  appRequest("/api/v1/offers/analyze").then(raw => { if (active) setConfig(configSchema.parse(raw)); }).catch(e => { if (active) setError(e.message); });
  return () => { active = false; };
 }, []);
 async function analyze() {
  if (!config?.provider || !consent) return;
  setBusy(true); setError(""); setResponse(null);
  try {
   const fallbacks = config.fallbacks.filter(item => fallbackAccepted[item.provider]).map(item => ({ provider: item.provider, policyHash: item.policyHash }));
   setResponse({ context, data: aiOfferAnalysisResponseSchema.parse(await appRequest("/api/v1/offers/analyze", { text, role, consent: { provider: config.provider, noticeVersion: config.noticeVersion, policyHash: config.policyHash, transmit: true, ...(fallbacks.length ? { fallbacks } : {}) } })) });
  }
  catch (e) { setError(e instanceof Error ? e.message : "AI analysis unavailable."); }
  finally { setBusy(false); setConsentedText(null); }
 }
 return <section className="fw-list-card" aria-label="Optional AI analysis">
  <h3>Optional AI suggestions</h3>
  {!config && !error && <p role="status">Checking AI availability…</p>}
  {config && !config.configured && <p role="status">Live AI is unavailable until the operator configures a provider and approves its data-processing policy. No offer text has been sent. Use Suggest terms with local rules above for a local review; it is not AI.</p>}
  {config?.configured && <>
   {config.availability.some(item => item.state !== "available") && <p role="status">{config.availability.filter(item => item.state !== "available").map(item => `${NAMES[item.provider]} is ${item.state === "paused" ? `paused${item.retryAfterSeconds ? ` for about ${Math.ceil(item.retryAfterSeconds / 60)} minute${Math.ceil(item.retryAfterSeconds / 60) === 1 ? "" : "s"}` : ""}` : "over its usage budget"}`).join("; ")}. Nothing is sent to a provider while it is paused. Local rules and manual review stay available.</p>}
   <p>Send the reviewed text below to {config.provider ? NAMES[config.provider] : "the provider"} ({config.model}) for advisory analysis. Remove names, contact details, IDs and confidential terms first.</p>
   <p>Automatic redaction removes some recognizable identifiers. It cannot guarantee anonymity. Check the entire preview before consenting.</p>
   <label className="fw-field">Text that will be sent<textarea readOnly value={redactOfferForAi(text)} rows={8} /></label>
   <p>Processing region disclosed by the operator: {config.processingRegion}. Data use and retention: {config.dataUse}</p>
   <p>Once dispatched, data cannot be recalled from the provider. Each request requires fresh consent; changing the text or provider policy requires consent again.</p>
   <p>The response may be wrong. It cannot verify a company, determine legal compliance or confirm an agreement. A minimal authorization receipt is retained without the offer text. Retrying consumes another limited request.</p>
   {config.fallbacks.length > 0 && <fieldset aria-label="Backup providers">
    <legend>Backup providers (optional)</legend>
    <p>If the first provider cannot answer, the same reviewed text can go to a backup you choose here. Nothing is sent to a provider you do not tick. Each has its own region and data-use terms.</p>
    {config.fallbacks.map(item => <label className="fw-field" key={item.provider}><input type="checkbox" checked={Boolean(fallbackAccepted[item.provider])} onChange={e => setFallbackAccepted(previous => ({ ...previous, [item.provider]: e.target.checked }))} />Also allow {NAMES[item.provider]} ({item.model}). Region: {item.processingRegion}. Data use and retention: {item.dataUse}</label>)}
   </fieldset>}
   <label className="fw-field"><input type="checkbox" checked={consent} onChange={e => setConsentedText(e.target.checked ? context : null)} />I reviewed this text, am authorized to transmit it, and consent to this specific external analysis.</label>
   <button type="button" className="fw-secondary" disabled={busy || !consent || text.trim().length < 10} onClick={() => void analyze()}>{busy ? "Requesting AI suggestions…" : "Send for AI analysis"}</button>
  </>}
  {error && <p role="alert">{error}</p>}
  {result && <div aria-label="AI-generated suggestions"><p role="status">{result.message}</p>{result.attempts && result.attempts.length > 0 && <p>Providers tried: {result.attempts.map(item => `${NAMES[item.provider]} (${OUTCOME[item.outcome] ?? item.outcome})`).join(", ")}.</p>}{result.status === "RATE_LIMITED" && result.retryAfterSeconds !== undefined && <p>Try AI again in about {Math.max(1, Math.ceil(result.retryAfterSeconds / 60))} minute{Math.ceil(result.retryAfterSeconds / 60) <= 1 ? "" : "s"}. Your text was not saved or queued; local rules and manual review work now.</p>}{result.data && <>
   <p>AI-generated · Unverified · {result.extractedAt}</p><p>{result.data.companyClaimNotice}</p>
   <section aria-label="AI extracted terms"><h4>Extracted terms — review against your offer</h4>
    <p>Pay: {result.data.salary.amount ?? "Not stated"} {result.data.salary.currency ?? ""} · {result.data.salary.period} · {result.data.salary.taxBasis}</p>
    <p>Weekly hours: {result.data.workingHours.hoursPerWeek ?? "Not stated"}</p>
    <dl>{Object.entries(result.data.contractTerms).map(([field,value])=><div key={field}><dt>{field.replace(/([A-Z])/g," $1")}</dt><dd>{value ?? "Not stated"}</dd></div>)}</dl>
    <p>These suggestions do not change your saved offer. Enter reviewed terms in the offer fields before saving.</p>
   </section>
   <p>{result.data.salary.explanation}</p><p>{result.data.workingHours.explanation}</p>
   {result.data.missingDetails.length>0&&<section aria-label="AI missing details"><h4>Details to clarify</h4>{result.data.missingDetails.map((item,index)=><p key={index}><strong>{item.field} · {item.importance}</strong>: {item.explanation}</p>)}</section>}
   {result.data.warningSigns.map((item, index) => <article className="fw-question-card" key={index}><strong>{item.title}</strong>{item.quote && <blockquote>{item.quote}</blockquote>}<p>{item.description}</p><p>{item.recommendation}</p></article>)}
   {result.data.followUpQuestions.map((item, index) => <p key={index}>{item.question}</p>)}
  </>}</div>}
 </section>;
}
