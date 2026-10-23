"use client";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
export function RuleAnalysis({ text }: { text: string }) {
 const { data } = extractOfferTermsRuleBased(text);
 return <section className="fw-list-card" aria-label="Rule-based considerations">
  <h3>Rule-based considerations</h3>
  <p>Local phrase matching, not AI or a legal assessment. Your terms are claims, not verified facts. Review the full context, including any negation or exceptions.</p>
  {data.warningSigns.length === 0 && <p>No configured warning phrases matched. This is not an assurance that the offer is fair, safe or complete.</p>}
  {data.warningSigns.map(item => <article className="fw-question-card" key={item.id}><strong>{item.title}</strong><blockquote>{item.quote}</blockquote><p>{item.description}</p><p>{item.recommendation}</p></article>)}
  <details><summary>Additional questions to consider</summary>{data.followUpQuestions.map(item => <p key={item.id}>{item.question}</p>)}</details>
  <p>{data.companyClaimNotice}</p>
 </section>;
}
