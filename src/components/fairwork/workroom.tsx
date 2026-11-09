"use client";
import { useEffect, useState } from "react";
import { ApiRequestError } from "@/features/authority/client";
import { listRecordsOf, readRecordById, removeRecordById, saveRecordBody } from "@/features/records/client";
import { emptyProject, projectStatuses, type ProjectContent, type RecordSummary } from "@/features/records/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

type Status = (typeof projectStatuses)[number];
type Draft = { id: string; title: string; status: Status; content: ProjectContent; revision: number };
const percent = (done: number, total: number) => (total === 0 ? 0 : Math.round((100 * done) / total));

// Workroom: the person's own projects with milestones and tasks. Progress is computed from the tasks actually ticked, never invented. Private and unverified.
export function Workroom() {
  const { t } = useI18n();
  const [items, setItems] = useState<RecordSummary[] | null>(null), [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [task, setTask] = useState(""), [milestone, setMilestone] = useState({ title: "", dueOn: "" });

  async function load() {
    setBusy(true); setError("");
    try { setItems(await listRecordsOf("project")); } catch { setItems(null); setError(t("wr.loadError")); } finally { setBusy(false); }
  }
  useEffect(() => {
    let live = true;
    (async () => {
      try { const result = await listRecordsOf("project"); if (live) setItems(result); }
      catch { if (live) setError(t("wr.loadError")); }
      finally { if (live) setBusy(false); }
    })();
    return () => { live = false; };
  }, [t]);

  async function open(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const doc = await readRecordById(id);
      if (doc.kind !== "project") throw new Error("kind");
      setDraft({ id: doc.id, title: doc.title, status: doc.status, content: doc.content, revision: doc.revision });
    } catch { setError(t("wr.loadError")); } finally { setBusy(false); }
  }
  async function save() {
    if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await saveRecordBody({ id: draft.id, kind: "project", title: draft.title.trim(), status: draft.status, content: draft.content, expectedRevision: draft.revision });
      setDraft({ ...draft, revision: result.revision }); setNotice(t("wr.saved")); await load();
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.code === "VERSION_CONFLICT" ? t("wr.conflict") : caught instanceof ApiRequestError && caught.code === "VALIDATION_FAILED" ? t("wr.invalid") : t("wr.saveError"));
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!window.confirm(t("wr.confirmDelete"))) return;
    setBusy(true); setError("");
    try { await removeRecordById(id); if (draft?.id === id) setDraft(null); await load(); } catch { setError(t("wr.deleteError")); setBusy(false); }
  }
  const change = (patch: Partial<ProjectContent>) => setDraft(current => current ? { ...current, content: { ...current.content, ...patch } } : current);

  if (!draft) return <section className="oq-rec" aria-label={t("wr.aria")}>
    <p>{t("wr.intro")}</p>
    {busy && <p role="status">{t("wr.loading")}</p>}{error && <p role="alert">{error}</p>}
    <button className="fw-primary" disabled={busy} onClick={() => { setDraft({ id: crypto.randomUUID(), title: "", status: "planned", content: { ...emptyProject, milestones: [], tasks: [] }, revision: 0 }); setNotice(""); setError(""); }}>{t("wr.new")}</button>
    {items && items.length === 0 && !busy && <p>{t("wr.none")}</p>}
    <ul className="oq-rec-list">{(items ?? []).map(item => <li key={item.id}>
      <strong>{item.title}</strong> · {t(`wr.s.${item.status}` as MessageKey)} · {t("wr.progress", { done: item.summary.tasksDone, total: item.summary.taskCount, percent: percent(item.summary.tasksDone, item.summary.taskCount) })}
      {item.summary.dueOn ? ` · ${t("wr.due", { date: item.summary.dueOn })}` : ""}
      <progress max={Math.max(1, item.summary.taskCount)} value={item.summary.tasksDone} aria-label={t("wr.progressAria", { title: item.title })} />
      <button className="fw-secondary" disabled={busy} onClick={() => void open(item.id)}>{t("wr.open")}</button>
      <button className="fw-secondary" disabled={busy} onClick={() => void remove(item.id)}>{t("wr.delete")}</button>
    </li>)}</ul>
    <p className="fw-notice">{t("wr.private")}</p>
  </section>;

  const c = draft.content, done = c.tasks.filter(item => item.done).length;
  return <section className="oq-rec" aria-label={t("wr.aria")}>
    <button className="fw-secondary" disabled={busy} onClick={() => { setDraft(null); setNotice(""); setError(""); void load(); }}>{t("wr.back")}</button>
    {busy && <p role="status">{t("wr.loading")}</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <label className="fw-field">{t("wr.f.title")}<input maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
    <label className="fw-field">{t("wr.f.status")}<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Status })}>{projectStatuses.map(status => <option key={status} value={status}>{t(`wr.s.${status}` as MessageKey)}</option>)}</select></label>
    <label className="fw-field">{t("wr.f.dueOn")}<input type="date" value={c.dueOn} onChange={e => change({ dueOn: e.target.value })} /></label>
    <label className="fw-field">{t("wr.f.description")}<textarea maxLength={1000} value={c.description} onChange={e => change({ description: e.target.value })} /></label>
    <p aria-live="polite"><strong>{t("wr.progress", { done, total: c.tasks.length, percent: percent(done, c.tasks.length) })}</strong> <progress max={Math.max(1, c.tasks.length)} value={done} aria-label={t("wr.progressAria", { title: draft.title || "-" })} /></p>
    <fieldset className="oq-rec-group"><legend>{t("wr.milestones")}</legend>
      <ul>{c.milestones.map(item => <li key={item.id}><label className="oq-rec-check"><input type="checkbox" checked={item.done} onChange={e => change({ milestones: c.milestones.map(other => other.id === item.id ? { ...other, done: e.target.checked } : other) })} /> {item.title}{item.dueOn ? ` · ${t("wr.due", { date: item.dueOn })}` : ""}</label> <button type="button" className="fw-secondary" onClick={() => change({ milestones: c.milestones.filter(other => other.id !== item.id) })}>{t("wr.removeItem")}</button></li>)}</ul>
      <label className="fw-field">{t("wr.m.title")}<input maxLength={120} value={milestone.title} onChange={e => setMilestone({ ...milestone, title: e.target.value })} /></label>
      <label className="fw-field">{t("wr.m.due")}<input type="date" value={milestone.dueOn} onChange={e => setMilestone({ ...milestone, dueOn: e.target.value })} /></label>
      <button type="button" className="fw-secondary" disabled={!milestone.title.trim() || c.milestones.length >= 20} onClick={() => { change({ milestones: [...c.milestones, { id: crypto.randomUUID(), title: milestone.title.trim(), done: false, dueOn: milestone.dueOn }] }); setMilestone({ title: "", dueOn: "" }); }}>{t("wr.m.add")}</button>
    </fieldset>
    <fieldset className="oq-rec-group"><legend>{t("wr.tasks")}</legend>
      <ul>{c.tasks.map(item => <li key={item.id}><label className="oq-rec-check"><input type="checkbox" checked={item.done} onChange={e => change({ tasks: c.tasks.map(other => other.id === item.id ? { ...other, done: e.target.checked } : other) })} /> {item.title}</label> <button type="button" className="fw-secondary" onClick={() => change({ tasks: c.tasks.filter(other => other.id !== item.id) })}>{t("wr.removeItem")}</button></li>)}</ul>
      <label className="fw-field">{t("wr.t.title")}<input maxLength={160} value={task} onChange={e => setTask(e.target.value)} /></label>
      <button type="button" className="fw-secondary" disabled={!task.trim() || c.tasks.length >= 50} onClick={() => { change({ tasks: [...c.tasks, { id: crypto.randomUUID(), title: task.trim(), done: false }] }); setTask(""); }}>{t("wr.t.add")}</button>
    </fieldset>
    <button className="fw-primary" disabled={busy || !draft.title.trim()} onClick={() => void save()}>{t("wr.save")}</button>
  </section>;
}
