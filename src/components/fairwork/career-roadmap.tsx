"use client";
import { useEffect, useState } from "react";
import { ApiRequestError } from "@/features/authority/client";
import { listRecordsOf, readRecordById, removeRecordById, saveRecordBody } from "@/features/records/client";
import { emptyRoadmap, roadmapStatuses, type RecordSummary, type RoadmapContent } from "@/features/records/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

type Status = (typeof roadmapStatuses)[number];
type Draft = { id: string; title: string; status: Status; content: RoadmapContent; revision: number };
const percent = (done: number, total: number) => (total === 0 ? 0 : Math.round((100 * done) / total));

// Saved career roadmaps with milestone progress. The milestones start from the skill gap shown on the screen above it, which uses the SAMPLE framework (labelled), but the
// roadmap itself, its dates and the ticks are the person's own private record and are not verified.
export function CareerRoadmaps({ careerId, careerTitle, steps }: { careerId: string; careerTitle: string; steps: { skill: string; step: string }[] }) {
  const { t } = useI18n();
  const [items, setItems] = useState<RecordSummary[] | null>(null), [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");

  async function load() {
    setBusy(true); setError("");
    try { setItems(await listRecordsOf("roadmap")); } catch { setItems(null); setError(t("rm.loadError")); } finally { setBusy(false); }
  }
  useEffect(() => {
    let live = true;
    (async () => {
      try { const result = await listRecordsOf("roadmap"); if (live) setItems(result); }
      catch { if (live) setError(t("rm.loadError")); }
      finally { if (live) setBusy(false); }
    })();
    return () => { live = false; };
  }, [t]);

  async function persist(next: Draft) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await saveRecordBody({ id: next.id, kind: "roadmap", title: next.title.trim(), status: next.status, content: next.content, expectedRevision: next.revision });
      setDraft({ ...next, revision: result.revision }); setNotice(t("rm.saved")); await load();
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.code === "VERSION_CONFLICT" ? t("rm.conflict") : caught instanceof ApiRequestError && caught.code === "VALIDATION_FAILED" ? t("rm.invalid") : t("rm.saveError"));
      setBusy(false);
    }
  }
  function startFromGap() {
    const content: RoadmapContent = { ...emptyRoadmap, careerId, milestones: steps.slice(0, 30).map(step => ({ id: crypto.randomUUID(), title: t("rm.learn", { skill: step.skill }), skill: step.skill, done: false, dueOn: "" })), notes: "" };
    setDraft({ id: crypto.randomUUID(), title: t("rm.defaultTitle", { career: careerTitle }), status: "active", content, revision: 0 });
    setNotice(""); setError("");
  }
  async function open(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const doc = await readRecordById(id);
      if (doc.kind !== "roadmap") throw new Error("kind");
      setDraft({ id: doc.id, title: doc.title, status: doc.status, content: doc.content, revision: doc.revision });
    } catch { setError(t("rm.loadError")); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm(t("rm.confirmDelete"))) return;
    setBusy(true); setError("");
    try { await removeRecordById(id); if (draft?.id === id) setDraft(null); await load(); } catch { setError(t("rm.deleteError")); setBusy(false); }
  }
  const change = (patch: Partial<RoadmapContent>) => setDraft(current => current ? { ...current, content: { ...current.content, ...patch } } : current);

  if (!draft) return <section className="oq-rec" aria-label={t("rm.aria")}>
    <h3>{t("rm.title")}</h3>
    {busy && <p role="status">{t("rm.loading")}</p>}{error && <p role="alert">{error}</p>}
    <button className="fw-primary" disabled={busy || steps.length === 0} onClick={startFromGap}>{t("rm.start", { career: careerTitle })}</button>
    {steps.length === 0 && <p>{t("rm.nothingToPlan")}</p>}
    {items && items.length === 0 && !busy && <p>{t("rm.none")}</p>}
    <ul className="oq-rec-list" aria-label={t("rm.listAria")}>{(items ?? []).map(item => <li key={item.id}>
      <strong>{item.title}</strong> · {t(`rm.s.${item.status}` as MessageKey)} · {t("rm.progress", { done: item.summary.milestonesDone, total: item.summary.milestoneCount, percent: percent(item.summary.milestonesDone, item.summary.milestoneCount) })}
      <progress max={Math.max(1, item.summary.milestoneCount)} value={item.summary.milestonesDone} aria-label={t("rm.progressAria", { title: item.title })} />
      <button className="fw-secondary" disabled={busy} onClick={() => void open(item.id)}>{t("rm.open")}</button>
      <button className="fw-secondary" disabled={busy} onClick={() => void remove(item.id)}>{t("rm.delete")}</button>
    </li>)}</ul>
    <p className="fw-notice">{t("rm.private")}</p>
  </section>;

  const c = draft.content, done = c.milestones.filter(item => item.done).length;
  return <section className="oq-rec" aria-label={t("rm.aria")}>
    <button className="fw-secondary" disabled={busy} onClick={() => { setDraft(null); setNotice(""); setError(""); void load(); }}>{t("rm.back")}</button>
    {busy && <p role="status">{t("rm.loading")}</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <label className="fw-field">{t("rm.f.title")}<input maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
    <label className="fw-field">{t("rm.f.status")}<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Status })}>{roadmapStatuses.map(value => <option key={value} value={value}>{t(`rm.s.${value}` as MessageKey)}</option>)}</select></label>
    <p aria-live="polite"><strong>{t("rm.progress", { done, total: c.milestones.length, percent: percent(done, c.milestones.length) })}</strong> <progress max={Math.max(1, c.milestones.length)} value={done} aria-label={t("rm.progressAria", { title: draft.title || "-" })} /></p>
    <ul>{c.milestones.map(item => <li key={item.id} className="oq-rec-check">
      <label className="oq-rec-check"><input type="checkbox" checked={item.done} onChange={e => change({ milestones: c.milestones.map(other => other.id === item.id ? { ...other, done: e.target.checked } : other) })} /> {item.title}</label>
      <label className="fw-field">{t("rm.dueFor", { title: item.title })}<input type="date" value={item.dueOn} onChange={e => change({ milestones: c.milestones.map(other => other.id === item.id ? { ...other, dueOn: e.target.value } : other) })} /></label>
    </li>)}</ul>
    <label className="fw-field">{t("rm.f.notes")}<textarea maxLength={1000} value={c.notes} onChange={e => change({ notes: e.target.value })} /></label>
    <button className="fw-primary" disabled={busy || !draft.title.trim()} onClick={() => void persist(draft)}>{t("rm.save")}</button>
  </section>;
}
