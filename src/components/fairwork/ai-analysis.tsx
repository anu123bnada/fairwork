"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { appRequest } from "@/features/authority/client";
import { aiOfferAnalysisResponseSchema, type AiOfferAnalysisResponse } from "@/features/offer/ai-schema";
import { redactOfferForAi } from "@/features/offer/ai-redaction";
const configSchema = z.strictObject({ configured: z.boolean(), provider: z.enum(["openai", "gemini"]).nullable(), model: z.string().nullable(), noticeVersion: z.literal("offer-analysis.v1"), processingRegion: z.string().nullable(), dataUse: z.string().nullable(), policyHash: z.string().nullable() });
export function AiAnalysis({ text, role }: { text: string; role: "WORKER" | "EMPLOYER" }) {
 const [config, setConfig] = useState<z.infer<typeof configSchema> | null>(null);
 const context = JSON.stringify([text, role]);
 const [consentedText, setConsentedText] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
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
  try { setResponse({ context, data: aiOfferAnalysisResponseSchema.parse(await appRequest("/api/v1/offers/analyze", { text, role, consent: { provider: config.provider, noticeVersion: config.noticeVersion, policyHash: config.policyHash, transmit: true } })) }); }
  catch (e) { setError(e instanceof Error ? e.message : "AI analysis unavailable."); }
  finally { setBusy(false); setConsentedText(null); }
 }
 return <section className="fw-list-card" aria-label="Optional AI analysis">
  <h3>Optional AI suggestions</h3>
  {!config && !error && <p role="status">Checking AI availability…</p>}
  {config && !config.configured && <p role="status">Live AI is unavailable until the operator configures a provider and approves its data-processing policy. No offer text has been sent. Use Suggest terms with local rules above for a local review; it is not AI.</p>}
  {config?.configured && <>
   <p>Send the reviewed text below to {config.provider} ({config.model}) for advisory analysis. Remove names, contact details, IDs and confidential terms first.</p>
   <p>Automatic redaction removes some recognizable identifiers. It cannot guarantee anonymity. Check the entire preview before consenting.</p>
   <label className="fw-field">Text that will be sent<textarea readOnly value={redactOfferForAi(text)} rows={8} /></label>
   <p>Processing region disclosed by the operator: {config.processingRegion}. Data use and retention: {config.dataUse}</p>
   <p>Once dispatched, data cannot be recalled from the provider. Each request requires fresh consent; changing the text or provider policy requires consent again.</p>
   <p>The response may be wrong. It cannot verify a company, determine legal compliance or confirm an agreement. A minimal authorization receipt is retained without the offer text. Retrying consumes another limited request.</p>
   <label className="fw-field"><input type="checkbox" checked={consent} onChange={e => setConsentedText(e.target.checked ? context : null)} />I reviewed this text, am authorized to transmit it, and consent to this specific external analysis.</label>
   <button type="button" className="fw-secondary" disabled={busy || !consent || text.trim().length < 10} onClick={() => void analyze()}>{busy ? "Requesting AI suggestions…" : "Send for AI analysis"}</button>
  </>}
  {error && <p role="alert">{error}</p>}
  {result && <div aria-label="AI-generated suggestions"><p role="status">{result.message}</p>{result.data && <>
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
