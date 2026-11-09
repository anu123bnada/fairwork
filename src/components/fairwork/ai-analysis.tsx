"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { appRequest } from "@/features/authority/client";
import { aiOfferAnalysisResponseSchema, type AiOfferAnalysisResponse } from "@/features/offer/ai-schema";
import { redactOfferForAi } from "@/features/offer/ai-redaction";
import { useI18n } from "@/i18n/use-i18n";
import { AiResultView } from "./ai-result-view";
import type { MessageKey } from "@/i18n";
const providerName = z.enum(["openai", "gemini", "selfhosted"]);
const providerInfo = z.strictObject({ provider: providerName, model: z.string(), processingRegion: z.string(), dataUse: z.string(), policyHash: z.string() });
const configSchema = z.strictObject({
  configured: z.boolean(), provider: providerName.nullable(), model: z.string().nullable(), noticeVersion: z.literal("offer-analysis.v1"), processingRegion: z.string().nullable(), dataUse: z.string().nullable(), policyHash: z.string().nullable(),
  fallbacks: z.array(providerInfo).max(2).default([]),
  availability: z.array(z.strictObject({ provider: providerName, role: z.enum(["primary", "fallback"]), state: z.enum(["available", "paused", "over_budget"]), retryAfterSeconds: z.number().int().nonnegative() })).max(3).default([]),
});
export function AiAnalysis({ text, role }: { text: string; role: "WORKER" | "EMPLOYER" }) {
 const { t } = useI18n();
 const name = (provider: z.infer<typeof providerName>) => t(`ai.name.${provider}` as MessageKey);
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
   setResponse({ context, data: aiOfferAnalysisResponseSchema.parse(await appRequest("/api/v1/offers/analyze", { text, role, consent: { provider: config.provider, noticeVersion: config.noticeVersion, policyHash: config.policyHash, transmit: true, adultConfirmed: true, ...(fallbacks.length ? { fallbacks } : {}) } })) });
  }
  catch (e) { setError(e instanceof Error ? e.message : t("ai.failed")); }
  finally { setBusy(false); setConsentedText(null); }
 }
 return <section className="fw-list-card" aria-label={t("ai.aria")}>
  <h3>{t("ai.title")}</h3>
  {!config && !error && <p role="status">{t("ai.checking")}</p>}
  {config && !config.configured && <p role="status">{t("ai.unavailable")}</p>}
  {config?.configured && <>
   {config.availability.some(item => item.state !== "available") && <p role="status">{config.availability.filter(item => item.state !== "available").map(item => item.state === "paused" ? (item.retryAfterSeconds ? (Math.ceil(item.retryAfterSeconds / 60) === 1 ? t("ai.statePausedOne", { name: name(item.provider) }) : t("ai.statePausedMany", { name: name(item.provider), n: Math.ceil(item.retryAfterSeconds / 60) })) : t("ai.statePaused", { name: name(item.provider) })) : t("ai.stateOver", { name: name(item.provider) })).join("; ")}. {t("ai.pauseNote")}</p>}
   <p>{t("ai.sendIntro", { provider: config.provider ? name(config.provider) : t("ai.name.fallback"), model: config.model ?? "" })}</p>
   <p>{t("ai.redactNote")}</p>
   <label className="fw-field">{t("ai.textLabel")}<textarea readOnly value={redactOfferForAi(text)} rows={8} /></label>
   <p>{t("ai.region", { region: config.processingRegion ?? "", use: config.dataUse ?? "" })}</p>
   <p>{t("ai.noRecall")}</p>
   <p>{t("ai.mayBeWrong")}</p>
   {config.fallbacks.length > 0 && <fieldset aria-label={t("ai.backupAria")}>
    <legend>{t("ai.backupLegend")}</legend>
    <p>{t("ai.backupIntro")}</p>
    {config.fallbacks.map(item => <label className="fw-field" key={item.provider}><input type="checkbox" checked={Boolean(fallbackAccepted[item.provider])} onChange={e => setFallbackAccepted(previous => ({ ...previous, [item.provider]: e.target.checked }))} />{t("ai.alsoAllow", { name: name(item.provider), model: item.model, region: item.processingRegion, use: item.dataUse })}</label>)}
   </fieldset>}
   <p>{t("ai.adultNote")}</p>
   <label className="fw-field"><input type="checkbox" checked={consent} onChange={e => setConsentedText(e.target.checked ? context : null)} />{t("ai.consent")}</label>
   <button type="button" className="fw-secondary" disabled={busy || !consent || text.trim().length < 10} onClick={() => void analyze()}>{busy ? t("ai.sending") : t("ai.send")}</button>
  </>}
  {error && <p role="alert">{error}</p>}
  {result && <AiResultView result={result} />}
 </section>;
}
