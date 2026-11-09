"use client";
import Link from "next/link";
import { analysisText, type AnalysisRun } from "@/features/analysis/run";
import { summarizeScan } from "@/features/scan/report";
import { useI18n } from "@/i18n/use-i18n";
import { AiResultView } from "./ai-result-view";
import { ClauseFindings } from "./offer-intelligence";
import { RuleAnalysis } from "./rule-analysis";
import { routeFor, useProduct } from "./product-app";
import "./scan-offer.css";

// The result of pressing Analyze, on its own clean screen: a summary, what the model found (only if it was run), what the rules found, the limits, and the next actions.
export function OfferReportScreen() {
  const { t } = useI18n();
  const { analysisRun, offer, role } = useProduct();
  // After a reload the in-memory run is gone (offer text and AI answers are deliberately not kept in the browser), so the report is rebuilt from the saved terms with the rules only.
  const rebuilt = !analysisRun && Boolean(offer);
  const run: AnalysisRun | null = analysisRun ?? (offer ? { offerId: offer.offerId, text: analysisText("", offer.snapshot as Record<string, string | number>), role, ranAt: new Date().toISOString(), ai: { state: "not_requested" }, title: String(offer.snapshot?.role ?? ""), saved: true } : null);
  if (!run) return <section className="fw-card fw-check-empty">
    <strong>{t("report.none")}</strong>
    <p>{t("report.noneBody")}</p>
    <Link href={routeFor("add-offer")} className="fw-primary">{t("check.addOffer")}</Link>
  </section>;
  const summary = summarizeScan(run.text, { source: "paste" });
  const warnings = summary.warningHigh + summary.warningMedium + summary.warningLow;
  const ai = run.ai;
  return <article className="oq-scan-report" aria-label={t("report.aria")}>
    <div className="oq-scan-report-head">
      <h2>{t("report.title")}</h2>
      <p>{t("report.meta", { role: run.title, at: new Date(run.ranAt).toLocaleString() })}</p>
    </div>
    <section className="oq-scan-summary" aria-label={t("scan.summaryAria")}>
      <h3>{t("scan.summaryTitle")}</h3>
      <p>{t("scan.summaryText", { chars: summary.characters, warnings, high: summary.warningHigh, clauses: summary.clauseFindings, missing: summary.missingDetails })}</p>
      {rebuilt && <p className="fw-notice" role="status">{t("report.rebuilt")}</p>}
      {!run.saved && <p className="fw-notice" role="status">{t("report.unsaved")}</p>}
      <p data-ai-state={ai.state}>{rebuilt ? t("report.aiNotStored") : ai.state === "done" ? t("report.aiDone", { provider: ai.provider, model: ai.model })
        : ai.state === "failed" ? t("report.aiFailed", { message: ai.message })
        : ai.state === "cancelled" ? t("report.aiCancelled")
        : ai.state === "not_configured" ? t("report.aiNotConfigured") : t("report.aiNotRequested")}</p>
    </section>
    {ai.state === "done" && <section aria-label={t("report.aiAria")} className="fw-list-card">
      <h3>{t("report.aiTitle")}</h3>
      <AiResultView result={ai.response} />
    </section>}
    <RuleAnalysis text={run.text} />
    <ClauseFindings text={run.text} />
    <section className="fw-list-card" aria-label={t("scan.limitsAria")}>
      <h3>{t("scan.limitsTitle")}</h3>
      <p>{t("report.limits")}</p>
    </section>
    <div className="oq-scan-actions oq-scan-noprint">
      {run.saved ? <Link className="fw-primary" href={routeFor("check")}>{t("check.seeCheck")}</Link> : <Link className="fw-primary" href="/app/add-offer#private-offer-drafts">{t("report.saveDraft")}</Link>}
      <Link className="fw-secondary" href={routeFor("add-offer")}>{t("report.edit")}</Link>
      <button type="button" className="fw-secondary" onClick={() => window.print()}>{t("scan.print")}</button>
    </div>
  </article>;
}
