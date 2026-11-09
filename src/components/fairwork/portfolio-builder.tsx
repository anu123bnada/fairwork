"use client";
import { useEffect, useState } from "react";
import { ApiRequestError } from "@/features/authority/client";
import { listRecordsOf, readRecordById, removeRecordById, saveRecordBody } from "@/features/records/client";
import { emptyPortfolio, portfolioCategories, portfolioStatuses, type PortfolioContent, type RecordSummary } from "@/features/records/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

type Status = (typeof portfolioStatuses)[number];
type Draft = { id: string; title: string; status: Status; content: PortfolioContent; revision: number };

// Portfolio Builder: the person's own entries (projects, certificates, achievements, work samples). Private to them, typed by them and NOT verified by ORYQEN.
// Only the Work Passport shows employer-verified work.
export function PortfolioBuilder() {
  const { t } = useI18n();
  const [items, setItems] = useState<RecordSummary[] | null>(null), [draft, setDraft] = useState<Draft | null>(null), [skillsText, setSkillsText] = useState("");
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");

  async function load() {
    setBusy(true); setError("");
    try { setItems(await listRecordsOf("portfolio")); } catch { setItems(null); setError(t("pf.loadError")); } finally { setBusy(false); }
  }
  useEffect(() => {
    let live = true;
    (async () => {
      try { const result = await listRecordsOf("portfolio"); if (live) setItems(result); }
      catch { if (live) setError(t("pf.loadError")); }
      finally { if (live) setBusy(false); }
    })();
    return () => { live = false; };
  }, [t]);

  async function open(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const doc = await readRecordById(id);
      if (doc.kind !== "portfolio") throw new Error("kind");
      setDraft({ id: doc.id, title: doc.title, status: doc.status, content: doc.content, revision: doc.revision }); setSkillsText(doc.content.skills.join(", "));
    } catch { setError(t("pf.loadError")); } finally { setBusy(false); }
  }
  async function save() {
    if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const skills = skillsText.split(",").map(item => item.trim()).filter(Boolean).slice(0, 15);
      const result = await saveRecordBody({ id: draft.id, kind: "portfolio", title: draft.title.trim(), status: draft.status, content: { ...draft.content, skills }, expectedRevision: draft.revision });
      setDraft({ ...draft, content: { ...draft.content, skills }, revision: result.revision }); setNotice(t("pf.saved")); await load();
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.code === "VERSION_CONFLICT" ? t("pf.conflict") : caught instanceof ApiRequestError && caught.code === "VALIDATION_FAILED" ? t("pf.invalid") : t("pf.saveError"));
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!window.confirm(t("pf.confirmDelete"))) return;
    setBusy(true); setError("");
    try { await removeRecordById(id); if (draft?.id === id) setDraft(null); await load(); } catch { setError(t("pf.deleteError")); setBusy(false); }
  }
  const change = (patch: Partial<PortfolioContent>) => setDraft(current => current ? { ...current, content: { ...current.content, ...patch } } : current);

  if (!draft) return <section className="oq-rec" aria-label={t("pf.aria")}>
    <p>{t("pf.intro")}</p>
    {busy && <p role="status">{t("pf.loading")}</p>}{error && <p role="alert">{error}</p>}
    <button className="fw-primary" disabled={busy} onClick={() => { setDraft({ id: crypto.randomUUID(), title: "", status: "draft", content: { ...emptyPortfolio, skills: [] }, revision: 0 }); setSkillsText(""); setNotice(""); setError(""); }}>{t("pf.new")}</button>
    {items && items.length === 0 && !busy && <p>{t("pf.none")}</p>}
    <ul className="oq-rec-list">{(items ?? []).map(item => <li key={item.id}>
      <strong>{item.title}</strong> · {t(`pf.c.${item.summary.category ?? "project"}` as MessageKey)} · {t(`pf.s.${item.status}` as MessageKey)}
      <button className="fw-secondary" disabled={busy} onClick={() => void open(item.id)}>{t("pf.open")}</button>
      <button className="fw-secondary" disabled={busy} onClick={() => void remove(item.id)}>{t("pf.delete")}</button>
    </li>)}</ul>
    {items && items.length > 0 && <button className="fw-secondary" onClick={() => window.print()}>{t("pf.print")}</button>}
    <p className="fw-notice">{t("pf.private")}</p>
  </section>;

  const c = draft.content;
  return <section className="oq-rec" aria-label={t("pf.aria")}>
    <button className="fw-secondary" disabled={busy} onClick={() => { setDraft(null); setNotice(""); setError(""); void load(); }}>{t("pf.back")}</button>
    {busy && <p role="status">{t("pf.loading")}</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <label className="fw-field">{t("pf.f.title")}<input maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
    <label className="fw-field">{t("pf.f.category")}<select value={c.category} onChange={e => change({ category: e.target.value as PortfolioContent["category"] })}>{portfolioCategories.map(value => <option key={value} value={value}>{t(`pf.c.${value}` as MessageKey)}</option>)}</select></label>
    <label className="fw-field">{t("pf.f.status")}<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Status })}>{portfolioStatuses.map(value => <option key={value} value={value}>{t(`pf.s.${value}` as MessageKey)}</option>)}</select></label>
    <label className="fw-field">{t("pf.f.date")}<input type="date" value={c.date} onChange={e => change({ date: e.target.value })} /></label>
    <label className="fw-field">{t("pf.f.link")}<input type="url" maxLength={300} placeholder="https://" value={c.link} onChange={e => change({ link: e.target.value })} /></label>
    <label className="fw-field">{t("pf.f.summary")}<textarea maxLength={1000} value={c.summary} onChange={e => change({ summary: e.target.value })} /></label>
    <label className="fw-field">{t("pf.f.skills")}<input maxLength={400} value={skillsText} onChange={e => setSkillsText(e.target.value)} /></label>
    <label className="fw-field">{t("pf.f.outcome")}<textarea maxLength={500} value={c.outcome} onChange={e => change({ outcome: e.target.value })} /></label>
    <button className="fw-primary" disabled={busy || !draft.title.trim()} onClick={() => void save()}>{t("pf.save")}</button>
  </section>;
}
