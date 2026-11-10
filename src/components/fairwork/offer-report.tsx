"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { analysisText, type AnalysisRun } from "@/features/analysis/run";
import { analyzeClauses } from "@/features/offer/clause-analysis";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { localizeQuestion, localizeWarning } from "@/features/offer/localize-text";
import { summarizeScan } from "@/features/scan/report";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import { AiResultView } from "./ai-result-view";
import { Finding, ResultSection, StatTile } from "./report-parts";
import { routeFor, useProduct } from "./product-app";
import "./scan-offer.css";
import "./report-ui.css";

const KIND_KEY = { unclear: "intel.kind.unclear", contradiction: "intel.kind.contradiction", promise: "intel.kind.promise", missing: "intel.kind.missing" } as const satisfies Record<string, MessageKey>;

// The result of pressing Analyze, on its own clean screen. Every number and finding comes from the existing rule engines (and from the AI step only when it actually ran); this screen only
// arranges them: a summary, five sections (warnings, unclear or missing clauses, unspecified details, questions, next steps), the original text, and the limits. It invents no score or rating.
export function OfferReportScreen() {
  const { t } = useI18n();
  const { analysisRun, offer, role } = useProduct();
  const [copied, setCopied] = useState("");
  // After a reload the in-memory run is gone (offer text and AI answers are deliberately not kept in the browser), so the report is rebuilt from the saved terms with the rules only.
  const rebuilt = !analysisRun && Boolean(offer);
  const run: AnalysisRun | null = analysisRun ?? (offer ? { offerId: offer.offerId, text: analysisText("", offer.snapshot as Record<string, string | number>), role, ranAt: new Date().toISOString(), ai: { state: "not_requested" }, title: String(offer.snapshot?.role ?? ""), saved: true } : null);
  const text = run?.text ?? "";
  const extraction = extractOfferTermsRuleBased(text).data;
  const clauses = analyzeClauses(text, { missing: true });
  // Printing a collapsed report would hide the explanations, so open them for the print and put them back afterwards.
  useEffect(() => {
    const opened: HTMLDetailsElement[] = [];
    const before = () => document.querySelectorAll<HTMLDetailsElement>(".oq-scan-report details").forEach(item => { if (!item.open) { item.open = true; opened.push(item); } });
    const after = () => { opened.splice(0).forEach(item => { item.open = false; }); };
    window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
  if (!run) return <section className="fw-card fw-check-empty">
    <strong>{t("report.none")}</strong>
    <p>{t("report.noneBody")}</p>
    <Link href={routeFor("add-offer")} className="fw-primary">{t("check.addOffer")}</Link>
  </section>;
  const summary = summarizeScan(run.text, { source: "paste" });
  const warnings = summary.warningHigh + summary.warningMedium + summary.warningLow;
  const ai = run.ai;
  const missing = extraction.missingDetails;
  const questions = [...new Set([...extraction.followUpQuestions.map(item => localizeQuestion(item, t).question), ...clauses.findings.map(item => item.question)].filter(Boolean))];
  const rationale = (field: string) => extraction.followUpQuestions.find(item => item.field === field)?.rationale;
  const questionFor = (field: string) => { const found = extraction.followUpQuestions.find(item => item.field === field); return found ? localizeQuestion(found, t).question : undefined; };
  async function copy() { try { await navigator.clipboard.writeText(questions.join("\n")); setCopied(t("ask.copied")); } catch { setCopied(t("ask.copyFailed")); } }
  const aiLine = rebuilt ? t("report.aiNotStored") : ai.state === "done" ? t("report.aiDone", { provider: ai.provider, model: ai.model })
    : ai.state === "failed" ? t("report.aiFailed", { message: ai.message })
    : ai.state === "cancelled" ? t("report.aiCancelled")
    : ai.state === "not_configured" ? t("report.aiNotConfigured") : t("report.aiNotRequested");
  const methodValue = ai.state === "done" && !rebuilt ? t("rp.method.both") : t("rp.method.rules");

  return <article className="oq-scan-report oq-report" aria-label={t("report.aria")}>
    <div className="oq-scan-report-head oq-report-head">
      <h1>{t("report.title")}</h1>
      <p>{t("report.meta", { role: run.title, at: new Date(run.ranAt).toLocaleString() })}</p>
    </div>

    <section className="oq-report-summary" aria-label={t("scan.summaryAria")}>
      <h2>{t("scan.summaryTitle")}</h2>
      <ul className="oq-stats" aria-label={t("rp.statsAria")}>
        <StatTile label={t("rp.stat.warnings")} value={warnings} tone={warnings > 0 ? "attention" : "neutral"} hint={warnings > 0 ? t("rp.stat.warningsHint", { high: summary.warningHigh, medium: summary.warningMedium, low: summary.warningLow }) : t("rp.stat.noneMatched")} />
        <StatTile label={t("rp.stat.clauses")} value={summary.clauseFindings} tone={summary.clauseFindings > 0 ? "attention" : "neutral"} hint={t("rp.stat.clausesHint")} />
        <StatTile label={t("rp.stat.missing")} value={summary.missingDetails} tone={summary.missingDetails > 0 ? "attention" : "neutral"} hint={t("rp.stat.missingHint")} />
        <StatTile label={t("rp.stat.method")} value={methodValue} hint={ai.state === "done" && !rebuilt ? `${ai.provider}` : t("rp.stat.methodHint")} />
        <StatTile label={t("rp.stat.saved")} value={run.saved ? t("rp.saved.yes") : t("rp.saved.no")} tone={run.saved ? "ok" : "attention"} hint={run.saved ? t("rp.saved.yesHint") : t("rp.saved.noHint")} />
      </ul>
      <p className="oq-report-callout" role="note">
        <strong>{warnings === 0 ? t("rp.callout.zeroTitle") : t("rp.callout.someTitle", { count: warnings })}</strong>
        {warnings === 0 ? t("rp.callout.zero") : t("rp.callout.some", { high: summary.warningHigh })}
      </p>
      <ul className="oq-report-jump oq-scan-noprint" aria-label={t("rp.jumpAria")}>
        <li><a href="#rp-warnings">{t("rp.a.title")}</a></li><li><a href="#rp-clauses">{t("rp.b.title")}</a></li><li><a href="#rp-missing">{t("rp.c.title")}</a></li>
        <li><a href="#rp-questions">{t("rp.d.title")}</a></li><li><a href="#rp-next">{t("rp.e.title")}</a></li>
      </ul>
      <div className="oq-report-notices">
        {rebuilt && <p className="fw-notice" role="status">{t("report.rebuilt")}</p>}
        {!run.saved && <p className="fw-notice" role="status">{t("report.unsaved")}</p>}
        <p className="oq-report-ai" data-ai-state={ai.state}>{aiLine}</p>
        <p>{t("scan.summaryText", { chars: summary.characters, warnings, high: summary.warningHigh, clauses: summary.clauseFindings, missing: summary.missingDetails })}</p>
      </div>
    </section>

    {ai.state === "done" && <section aria-label={t("report.aiAria")} className="fw-list-card">
      <h3>{t("report.aiTitle")}</h3>
      <AiResultView result={ai.response} />
    </section>}

    <ResultSection id="rp-warnings" letter="A" title={t("rp.a.title")} count={extraction.warningSigns.length} intro={t("rp.a.intro")} empty={t("ra.none")}>
      {extraction.warningSigns.map(raw => { const item = localizeWarning(raw, t); return <Finding key={item.id} title={item.title} severity={item.severity} badge={t(`ai.sev.${item.severity}` as MessageKey)}
        summary={item.description} quote={item.quote ?? undefined} todo={item.recommendation} whyLabel={t("rp.why")} todoLabel={t("rp.todo")} quoteLabel={t("rp.matched")} />; })}
    </ResultSection>

    <ResultSection id="rp-clauses" letter="B" title={t("rp.b.title")} count={clauses.findings.length} intro={t("rp.b.intro")} empty={t("intel.none")}>
      {clauses.findings.map(item => <Finding key={item.id} title={item.title} severity={item.severity} badge={`${t(KIND_KEY[item.kind])} · ${t(`ai.sev.${item.severity}` as MessageKey)}`}
        summary={item.explanation} quote={item.quote ?? undefined} todo={item.question} whyLabel={t("rp.why")} todoLabel={t("rp.ask")} quoteLabel={t("rp.matched")} />)}
      {clauses.findings.length > 0 && <p className="oq-result-intro">{clauses.limitations}</p>}
    </ResultSection>

    <ResultSection id="rp-missing" letter="C" title={t("rp.c.title")} count={missing.length} intro={t("rp.c.intro")} empty={t("rp.c.none")}>
      {missing.map(item => <Finding key={item.id} title={t(`rp.field.${item.field}` as MessageKey)} severity={item.importance === "critical" ? "high" : "medium"} badge={item.importance === "critical" ? t("rp.critical") : t("rp.important")}
        summary={item.explanation} why={rationale(item.field) ?? t("rp.c.whyGeneric")} todo={questionFor(item.field) ?? t("rp.c.todoGeneric")} whyLabel={t("rp.why")} todoLabel={t("rp.ask")} quoteLabel={t("rp.matched")} />)}
    </ResultSection>

    <ResultSection id="rp-questions" letter="D" title={t("rp.d.title")} count={questions.length} intro={t("rp.d.intro")} empty={t("rp.d.none")}>
      {questions.length > 0 && <>
        <ol className="oq-questions" aria-label={t("rp.d.title")}>{questions.map(question => <li key={question}>{question}</li>)}</ol>
        <div className="oq-report-actions oq-scan-noprint"><button type="button" className="fw-secondary" onClick={() => void copy()}>{t("intel.copy")}</button>{copied && <span role="status">{copied}</span>}</div>
      </>}
    </ResultSection>

    <ResultSection id="rp-next" letter="E" title={t("rp.e.title")} count={0} hideCount>
      <ol className="oq-steps">
        {warnings > 0 && <li>{t("rp.e.warnings")}</li>}
        {(summary.clauseFindings + summary.missingDetails > 0 || questions.length > 0) && <li>{t("rp.e.ask")}</li>}
        <li>{run.saved ? t("rp.e.saved") : t("rp.e.unsaved")}</li>
        <li>{t("rp.e.verify")}</li>
      </ol>
      <div className="oq-report-actions oq-scan-actions oq-scan-noprint">
        {run.saved ? <Link className="fw-primary" href={routeFor("check")}>{t("check.seeCheck")}</Link> : <Link className="fw-primary" href="/app/add-offer#private-offer-drafts">{t("report.saveDraft")}</Link>}
        {run.saved && <Link className="fw-secondary" href={routeFor("questions")}>{t("rp.e.toQuestions")}</Link>}
        <Link className="fw-secondary" href={routeFor("add-offer")}>{t("report.edit")}</Link>
        <button type="button" className="fw-secondary" onClick={() => window.print()}>{t("scan.print")}</button>
      </div>
      {!run.saved && <p className="oq-result-intro">{t("rp.e.whyNoSave")}</p>}
    </ResultSection>

    <details className="oq-original">
      <summary>{t("rp.original.title")}</summary>
      {rebuilt ? <p className="oq-result-intro">{t("rp.original.rebuilt")}</p> : null}
      <pre aria-label={t("rp.original.aria")}>{run.text || t("rp.original.empty")}</pre>
    </details>

    <section className="oq-report-limits" aria-label={t("scan.limitsAria")}>
      <strong>{t("scan.limitsTitle")}</strong>
      <ul>
        <li>{t("rp.lim.rules")}</li><li>{t("rp.lim.legal")}</li><li>{t("rp.lim.claims")}</li><li>{t("rp.lim.zero")}</li><li>{t("rp.lim.temp")}</li>
      </ul>
      <p>{t("report.limits")}</p>
    </section>
  </article>;
}
