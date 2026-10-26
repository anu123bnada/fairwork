"use client";
import { interviewKeys, negotiationQuestionKeys } from "@/features/offer/preparation";
import { useI18n } from "@/i18n/use-i18n";

// Questions to ask and a short interview checklist, from this offer's saved terms. Computed in the browser; nothing is sent anywhere.
export function OfferPreparation({ snapshot }: { snapshot: Record<string, unknown> }) {
  const { t } = useI18n();
  const terms = Object.fromEntries(Object.entries(snapshot).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key, String(value)]));
  const questions = negotiationQuestionKeys(terms);
  return <details className="fw-list-card">
    <summary>{t("prep.title")}</summary>
    <p>{t("prep.intro")}</p>
    <h4>{t("prep.negotiation")}</h4>
    {questions.length === 0 ? <p>{t("prep.noneOpen")}</p> : <ol>{questions.map(key => <li key={key}>{t(key)}</li>)}</ol>}
    <h4>{t("prep.interview")}</h4>
    <ul>{interviewKeys.map(key => <li key={key}>{t(key)}</li>)}</ul>
  </details>;
}
