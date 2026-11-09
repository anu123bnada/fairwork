"use client";
import { useState } from "react";
import { coverLetterTones, generateCoverLetter, type CoverLetterInput } from "@/features/cover-letter/generate";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

// Cover letter generator: fills a plain template from the person's own words. It is not AI, makes no claims on their behalf and stores nothing.
export function CoverLetter({ displayName }: { displayName: string }) {
  const { t } = useI18n();
  const [form, setForm] = useState<CoverLetterInput>({ name: displayName, role: "", organization: "", contact: "", opening: "", strengths: ["", "", ""], example: "", closing: "", tone: "formal" });
  const [copied, setCopied] = useState(false);
  const { text, missing } = generateCoverLetter(form);
  const set = (patch: Partial<CoverLetterInput>) => { setForm(current => ({ ...current, ...patch })); setCopied(false); };
  return <section className="oq-rec" aria-label={t("cl.aria")}>
    <p>{t("cl.intro")}</p>
    <label className="fw-field">{t("cl.name")}<input maxLength={100} value={form.name} onChange={e => set({ name: e.target.value })} /></label>
    <label className="fw-field">{t("cl.role")}<input maxLength={120} value={form.role} onChange={e => set({ role: e.target.value })} /></label>
    <label className="fw-field">{t("cl.organization")}<input maxLength={120} value={form.organization} onChange={e => set({ organization: e.target.value })} /></label>
    <label className="fw-field">{t("cl.contact")}<input maxLength={160} value={form.contact} onChange={e => set({ contact: e.target.value })} /></label>
    <label className="fw-field">{t("cl.tone")}<select value={form.tone} onChange={e => set({ tone: e.target.value as CoverLetterInput["tone"] })}>{coverLetterTones.map(tone => <option key={tone} value={tone}>{t(`cl.tone.${tone}` as MessageKey)}</option>)}</select></label>
    <label className="fw-field">{t("cl.opening")}<textarea maxLength={400} value={form.opening} onChange={e => set({ opening: e.target.value })} /></label>
    {form.strengths.map((value, index) => <label className="fw-field" key={index}>{t("cl.strength", { n: index + 1 })}<input maxLength={120} value={value} onChange={e => set({ strengths: form.strengths.map((other, i) => i === index ? e.target.value : other) })} /></label>)}
    <label className="fw-field">{t("cl.example")}<textarea maxLength={600} value={form.example} onChange={e => set({ example: e.target.value })} /></label>
    <label className="fw-field">{t("cl.closing")}<textarea maxLength={400} value={form.closing} onChange={e => set({ closing: e.target.value })} /></label>
    {missing.length > 0 && <p role="status">{t("cl.missing", { fields: missing.map(key => t(`cl.m.${key}` as MessageKey)).join(", ") })}</p>}
    <h3>{t("cl.preview")}</h3>
    <pre aria-label={t("cl.previewAria")} style={{ whiteSpace: "pre-wrap", font: "inherit" }}>{text}</pre>
    <div className="oq-rec-chips">
      <button className="fw-primary" onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false)); }}>{t("cl.copy")}</button>
      <button className="fw-secondary" onClick={() => window.print()}>{t("cl.print")}</button>
    </div>
    {copied && <p role="status">{t("cl.copied")}</p>}
    <p className="fw-notice">{t("cl.notice")}</p>
  </section>;
}
