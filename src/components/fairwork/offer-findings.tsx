"use client";

import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { useI18n } from "@/i18n/use-i18n";

// An at-a-glance count of what the check below actually found. Every number is derived from the saved revision;
// risks come from the local phrase rules only, and no AI provider is involved on this screen.
export function OfferFindings({ stated, missing, text }: { stated: number; missing: number; text: string }) {
  const { t } = useI18n();
  const { data } = extractOfferTermsRuleBased(text);
  const risks = data.warningSigns.length;
  const questions = data.followUpQuestions.length + missing;
  const tiles = [
    { id: "stated", count: stated, label: t("check.ov.stated"), href: "#check-stated", tone: "ok" },
    { id: "missing", count: missing, label: t("check.ov.missing"), href: "#check-missing", tone: missing ? "warn" : "ok" },
    { id: "risks", count: risks, label: t("check.ov.risks"), href: "#check-risks", tone: risks ? "warn" : "ok" },
    { id: "questions", count: questions, label: t("check.ov.questions"), href: "#check-missing", tone: "info" },
  ];
  return <section className="fw-card fw-findings" aria-label={t("check.ov.title")}>
    <h3>{t("check.ov.title")}</h3>
    <ul className="fw-findings-grid">
      {tiles.map(tile => <li key={tile.id} className={`fw-findings-tile is-${tile.tone}`}><a href={tile.href}><strong>{tile.count}</strong><span>{tile.label}</span></a></li>)}
    </ul>
    <ul className="fw-findings-sources">
      <li>{t("check.ov.srcTerms")}</li>
      <li>{t("check.ov.srcRules")}</li>
      <li>{t("check.ov.srcAi")}</li>
    </ul>
  </section>;
}
