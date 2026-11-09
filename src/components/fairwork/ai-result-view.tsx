"use client";
import type { AiOfferAnalysisResponse } from "@/features/offer/ai-schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";

type ProviderId = "openai" | "gemini" | "selfhosted";
// What a model returned for an offer: extracted facts and inferences are shown separately, each finding quotes the words it rests on, and nothing here is verified or legal advice.
export function AiResultView({ result }: { result: AiOfferAnalysisResponse }) {
 const { t } = useI18n();
 const name = (provider: ProviderId) => t(`ai.name.${provider}` as MessageKey);
 const outcome = (value: string) => { const key = `ai.out.${value}`; const text = t(key as MessageKey); return text === key ? value : text; };
 return (
  <div aria-label={t("ai.resultAria")}><p role="status">{result.message}</p>{result.attempts && result.attempts.length > 0 && <p>{t("ai.tried", { list: result.attempts.map(item => `${name(item.provider)} (${outcome(item.outcome)})`).join(", ") })}</p>}{result.status === "RATE_LIMITED" && result.retryAfterSeconds !== undefined && <p>{Math.ceil(result.retryAfterSeconds / 60) <= 1 ? t("ai.retryOne") : t("ai.retryMany", { n: Math.ceil(result.retryAfterSeconds / 60) })}</p>}{result.data && <>
   <p>{t("ai.generated", { at: result.extractedAt })}</p><p>{result.data.companyClaimNotice}</p>
   <section aria-label={t("ai.extractedAria")}><h4>{t("ai.extractedTitle")}</h4>
    <p className="fw-notice">{t("ai.prov.facts")}</p>
    <p>{t("ai.pay", { amount: result.data.salary.amount ?? t("ai.notStated"), currency: result.data.salary.currency ?? "", period: result.data.salary.period, basis: result.data.salary.taxBasis })}</p>
    {result.data.salary.quote && <blockquote>{result.data.salary.quote}</blockquote>}
    <p>{t("ai.hours", { value: result.data.workingHours.hoursPerWeek ?? t("ai.notStated") })}</p>
    {result.data.workingHours.quote && <blockquote>{result.data.workingHours.quote}</blockquote>}
    <dl>{Object.entries(result.data.contractTerms).map(([field,value])=><div key={field}><dt>{field.replace(/([A-Z])/g," $1")}</dt><dd>{value ?? t("ai.notStated")}</dd></div>)}</dl>
    <p>{t("ai.noChange")}</p>
   </section>
   <section aria-label={t("ai.infAria")}><h4>{t("ai.infTitle")}</h4>
    <p className="fw-notice">{t("ai.prov.inference")}</p>
    <p>{result.data.salary.explanation}</p><p>{result.data.workingHours.explanation}</p>
    {result.data.missingDetails.length>0&&<section aria-label={t("ai.missingAria")}><h5>{t("ai.missingTitle")}</h5>{result.data.missingDetails.map(item=><p key={item.id}><strong>{item.field} · {t(`ai.imp.${item.importance}` as MessageKey)}</strong>: {item.explanation}</p>)}</section>}
    {result.data.warningSigns.map(item => <article className="fw-question-card" key={item.id}><strong>{item.title}</strong> <span>({t(`ai.sev.${item.severity}` as MessageKey)})</span>{item.quote ? <blockquote>{item.quote}</blockquote> : <p><em>{t("ai.noQuote")}</em></p>}<p>{item.description}</p><p>{item.recommendation}</p></article>)}
    {result.data.followUpQuestions.map(item => <article className="fw-question-card" key={item.id}><strong>{item.question}</strong> <span>({t(`ai.imp.${item.importance}` as MessageKey)})</span><p>{item.rationale}</p></article>)}
   </section>
   <p className="fw-notice">{t("ai.prov.legal")}</p>
  </>}</div>
 );
}
