"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/features/authority/client";
import { coverLetterTones, generateCoverLetter, type CoverLetterInput } from "@/features/cover-letter/generate";
import { listRecordsOf, readRecordById, removeRecordById, saveRecordBody } from "@/features/records/client";
import { coverLetterStatuses, type RecordSummary } from "@/features/records/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

type Status = (typeof coverLetterStatuses)[number];
const blank = (name: string): CoverLetterInput => ({ name, role: "", organization: "", contact: "", opening: "", strengths: ["", "", ""], example: "", closing: "", tone: "formal" });

// Cover Letter Studio: fills a plain template from the person's own words (not AI, no invented facts), lets them edit the text freely, and saves letters privately to their account.
export function CoverLetter({ displayName }: { displayName: string }) {
  const { t } = useI18n();
  const [form, setForm] = useState<CoverLetterInput>(blank(displayName));
  const [body, setBody] = useState(() => generateCoverLetter(blank(displayName)).text), [edited, setEdited] = useState(false);
  const [id, setId] = useState<string>(() => crypto.randomUUID()), [revision, setRevision] = useState(0), [status, setStatus] = useState<Status>("draft");
  const [items, setItems] = useState<RecordSummary[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const { missing } = generateCoverLetter(form);

  const refresh = useCallback(async () => { try { setItems(await listRecordsOf("cover_letter")); } catch { setItems(null); setError(t("cl.loadError")); } }, [t]);
  useEffect(() => { let live = true; (async () => { try { const result = await listRecordsOf("cover_letter"); if (live) setItems(result); } catch { if (live) setError(t("cl.loadError")); } })(); return () => { live = false; }; }, [t]);

  const set = (patch: Partial<CoverLetterInput>) => { const next = { ...form, ...patch }; setForm(next); if (!edited) setBody(generateCoverLetter(next).text); setNotice(""); };
  const reset = () => { setId(crypto.randomUUID()); setRevision(0); setStatus("draft"); setForm(blank(displayName)); setBody(generateCoverLetter(blank(displayName)).text); setEdited(false); setNotice(""); setError(""); };
  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const title = [form.role.trim(), form.organization.trim()].filter(Boolean).join(" at ") || t("cl.untitled");
      const result = await saveRecordBody({ id, kind: "cover_letter", title: title.slice(0, 120), status, content: { organization: form.organization.trim(), role: form.role.trim(), tone: form.tone, body, applicationId: null }, expectedRevision: revision });
      setRevision(result.revision); setNotice(t("cl.saved")); await refresh();
    } catch (caught) { setError(caught instanceof ApiRequestError && caught.code === "VERSION_CONFLICT" ? t("cl.conflict") : caught instanceof ApiRequestError && caught.code === "VALIDATION_FAILED" ? t("cl.invalid") : t("cl.saveError")); } finally { setBusy(false); }
  }
  async function open(openId: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const doc = await readRecordById(openId);
      if (doc.kind !== "cover_letter") throw new Error("kind");
      setId(doc.id); setRevision(doc.revision); setStatus(doc.status); setEdited(true); setBody(doc.content.body);
      setForm({ ...blank(displayName), role: doc.content.role, organization: doc.content.organization, tone: doc.content.tone });
    } catch { setError(t("cl.loadError")); } finally { setBusy(false); }
  }
  async function remove(removeId: string) {
    if (!window.confirm(t("cl.confirmDelete"))) return;
    setBusy(true); setError("");
    try { await removeRecordById(removeId); if (removeId === id) reset(); await refresh(); } catch { setError(t("cl.deleteError")); } finally { setBusy(false); }
  }

  return <section className="oq-rec" aria-label={t("cl.aria")}>
    <p>{t("cl.intro")}</p>
    <h3>{t("cl.saved.title")}</h3>
    {items && items.length === 0 && <p>{t("cl.none")}</p>}
    <ul className="oq-rec-list" aria-label={t("cl.savedAria")}>{(items ?? []).map(item => <li key={item.id}><strong>{item.title}</strong> · {t(`cl.s.${item.status}` as MessageKey)}
      <button className="fw-secondary" disabled={busy} onClick={() => void open(item.id)}>{t("cl.open")}</button>
      <button className="fw-secondary" disabled={busy} onClick={() => void remove(item.id)}>{t("cl.delete")}</button></li>)}</ul>
    <button className="fw-secondary" disabled={busy} onClick={reset}>{t("cl.new")}</button>
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
    <label className="fw-field">{t("cl.previewAria")}<textarea rows={14} maxLength={8000} value={body} onChange={e => { setBody(e.target.value); setEdited(true); setNotice(""); }} /></label>
    {edited && <button className="fw-secondary" onClick={() => { setBody(generateCoverLetter(form).text); setEdited(false); }}>{t("cl.fromTemplate")}</button>}
    <label className="fw-field">{t("cl.status")}<select value={status} onChange={e => setStatus(e.target.value as Status)}>{coverLetterStatuses.map(value => <option key={value} value={value}>{t(`cl.s.${value}` as MessageKey)}</option>)}</select></label>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="oq-rec-chips">
      <button className="fw-primary" disabled={busy || !body.trim()} onClick={() => void save()}>{t("cl.save")}</button>
      <button className="fw-secondary" onClick={() => { void navigator.clipboard?.writeText(body).then(() => setNotice(t("cl.copied")), () => setNotice("")); }}>{t("cl.copy")}</button>
      <button className="fw-secondary" onClick={() => window.print()}>{t("cl.print")}</button>
    </div>
    <p className="fw-notice">{t("cl.notice")}</p>
  </section>;
}
