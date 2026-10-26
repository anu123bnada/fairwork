"use client";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { localizeQuestion, localizeWarning } from "@/features/offer/localize-text";
import { useI18n } from "@/i18n/use-i18n";
export function RuleAnalysis({ text }: { text: string }) {
 const { t } = useI18n();
 const { data } = extractOfferTermsRuleBased(text);
 return <section className="fw-list-card" aria-label={t("ra.aria")}>
  <h3>{t("ra.aria")}</h3>
  <p>{t("ra.intro")}</p>
  {data.warningSigns.length === 0 && <p>{t("ra.none")}</p>}
  {data.warningSigns.map(raw => { const item = localizeWarning(raw, t); return <article className="fw-question-card" key={item.id}><strong>{item.title}</strong><blockquote>{item.quote}</blockquote><p>{item.description}</p><p>{item.recommendation}</p></article>; })}
  <details><summary>{t("ra.more")}</summary>{data.followUpQuestions.map(raw => <p key={raw.id}>{localizeQuestion(raw, t).question}</p>)}</details>
  <p>{t("ra.notice")}</p>
 </section>;
}
