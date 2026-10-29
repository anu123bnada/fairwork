"use client";
import { useState } from "react";
import { analyzeClauses, type ClauseFinding } from "@/features/offer/clause-analysis";
import { compareQualifications, type QualificationResult } from "@/features/offer/qualifications";
import { readLinkedInExport } from "@/features/offer/linkedin-export";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";

const KIND_KEY = { unclear: "intel.kind.unclear", contradiction: "intel.kind.contradiction", promise: "intel.kind.promise", missing: "intel.kind.missing" } as const satisfies Record<ClauseFinding["kind"], MessageKey>;

// Rule-based clause findings. Each one quotes the line it rests on and says where it is. This is wording analysis on the text provided, not AI and not legal advice.
export function ClauseFindings({ text, includeMissing = true }: { text: string; includeMissing?: boolean }) {
  const { t } = useI18n();
  const { findings, limitations } = analyzeClauses(text, { missing: includeMissing });
  const [copied, setCopied] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(findings.map(finding => finding.question).join("\n")); setCopied(t("ask.copied")); } catch { setCopied(t("ask.copyFailed")); }
  }
  return <section className="fw-list-card" aria-label={t("intel.aria")}>
    <h3>{t("intel.title")}</h3>
    <p className="fw-notice">{t("intel.source")}</p>
    {findings.length === 0 && <p>{t("intel.none")}</p>}
    {findings.map(finding => <article className="fw-question-card" key={finding.id}>
      <strong>{finding.title}</strong> <span>({t(KIND_KEY[finding.kind])} · {t(`ai.sev.${finding.severity}` as MessageKey)})</span>
      {finding.quote && <blockquote>{finding.quote}{finding.source && <small> — {finding.source.page ? t("intel.page", { page: finding.source.page }) : t("intel.position", { start: finding.source.start })}</small>}</blockquote>}
      <p>{finding.explanation}</p>
      <p><strong>{t("intel.ask")}</strong> {finding.question}</p>
    </article>)}
    {findings.length > 0 && <button type="button" className="fw-secondary" onClick={() => void copy()}>{t("intel.copy")}</button>}
    {copied && <p role="status">{copied}</p>}
    <p>{limitations}</p>
  </section>;
}

// Compares the person's own statement of skills, education and experience with the job text. Nothing is uploaded; LinkedIn is not contacted.
export function QualificationPanel({ jobText }: { jobText: string }) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(""), [years, setYears] = useState<number | null>(null), [note, setNote] = useState(""), [result, setResult] = useState<{ key: string; value: QualificationResult } | null>(null);
  const key = JSON.stringify([profile, jobText, years]);
  async function importExport(files: FileList | null) {
    if (!files?.length) return;
    setNote("");
    const picked = [...files].slice(0, 6);
    if (picked.some(file => file.size > 2 * 1024 * 1024 || !/\.csv$/i.test(file.name))) { setNote(t("intel.q.badFile")); return; }
    const read = readLinkedInExport(await Promise.all(picked.map(async file => ({ name: file.name, text: await file.text() }))));
    if (!read.text) { setNote(t("intel.q.nothing")); return; }
    setProfile(current => [current.trim(), read.text].filter(Boolean).join("\n"));
    if (read.years !== null) setYears(read.years);
    setNote(t("intel.q.imported", { kinds: read.recognised.join(", "), ignored: read.ignored.length }));
  }
  const shown = result?.key === key ? result.value : null;
  return <details className="fw-list-card" aria-label={t("intel.q.aria")}>
    <summary>{t("intel.q.title")}</summary>
    <p>{t("intel.q.intro")}</p>
    <label className="fw-field">{t("intel.q.profile")}<textarea value={profile} maxLength={6000} onChange={event => setProfile(event.target.value)} /></label>
    <label className="fw-field">{t("intel.q.file")}<input type="file" multiple accept=".csv,text/csv" onChange={event => { void importExport(event.target.files); event.target.value = ""; }} /></label>
    <p className="fw-notice">{t("intel.q.linkedin")}</p>
    {note && <p role="status">{note}</p>}
    {!jobText.trim() && <p role="status">{t("intel.q.needJob")}</p>}
    <button type="button" className="fw-secondary" disabled={!profile.trim() || !jobText.trim()} onClick={() => setResult({ key, value: compareQualifications(profile, jobText, years === null ? undefined : { years }) })}>{t("intel.q.compare")}</button>
    {shown && <div aria-label={t("intel.q.result")}>
      <p className="fw-notice">{shown.limitations}</p>
      {shown.matches.length + shown.gaps.length + shown.unclear.length === 0 && <p>{t("intel.q.noReqs")}</p>}
      {shown.matches.length > 0 && <section><h4>{t("intel.q.matches")}</h4>{shown.matches.map(match => <article className="fw-question-card" key={match.requirement.id}><strong>{match.requirement.text}</strong>{!match.requirement.mandatory && <span> ({t("intel.q.optional")})</span>}<blockquote>{match.evidence}</blockquote><small>{t("intel.q.fromYou")}</small></article>)}</section>}
      {shown.gaps.length > 0 && <section><h4>{t("intel.q.gaps")}</h4>{shown.gaps.map(gap => <article className="fw-question-card" key={gap.requirement.id}><strong>{gap.requirement.text}</strong>{!gap.requirement.mandatory && <span> ({t("intel.q.optional")})</span>}<p>{gap.reason}</p><p><strong>{t("intel.q.next")}</strong> {gap.suggestion}</p></article>)}</section>}
      {shown.unclear.length > 0 && <section><h4>{t("intel.q.unclear")}</h4>{shown.unclear.map(item => <p key={item.requirement.id}><strong>{item.requirement.text}</strong>: {item.reason}</p>)}</section>}
    </div>}
  </details>;
}
