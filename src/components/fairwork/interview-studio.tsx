"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "@/features/authority/client";
import { listRecordsOf, readRecordById, saveRecordBody } from "@/features/records/client";
import { interviewOutcomes, interviewStages, interviewStatuses, prepItems, type ApplicationContent, type RecordDocument } from "@/features/records/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

type AppDoc = Extract<RecordDocument, { kind: "application" }>;
type Ev = ApplicationContent["events"][number];
type Row = { app: AppDoc; ev: Ev };
const today = () => new Date().toISOString().slice(0, 10);

// Interview Studio: every interview the person recorded across their applications, as a list or by day, with stage, status, outcome, questions, notes and feedback.
// It reads and writes the same private application records as the Application Tracker, so nothing is duplicated. Everything is typed by the person and unverified.
export function InterviewStudio() {
  const { t } = useI18n();
  const [apps, setApps] = useState<AppDoc[] | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [view, setView] = useState<"list" | "day">("list"), [when, setWhen] = useState<"upcoming" | "past" | "all">("all");
  const [add, setAdd] = useState({ appId: "", at: "", stage: "phone_screen" as Ev["stage"], notes: "" });

  const loadAll = useCallback(async () => {
    const list = await listRecordsOf("application");
    const docs = await Promise.all(list.map(item => readRecordById(item.id)));
    return docs.filter((doc): doc is AppDoc => doc.kind === "application");
  }, []);
  useEffect(() => {
    let live = true;
    (async () => {
      try { const docs = await loadAll(); if (live) { setApps(docs); setAdd(current => ({ ...current, appId: docs[0]?.id ?? "" })); } }
      catch { if (live) setError(t("ivs.loadError")); }
      finally { if (live) setBusy(false); }
    })();
    return () => { live = false; };
  }, [loadAll, t]);

  const rows: Row[] = useMemo(() => (apps ?? []).flatMap(app => app.content.events.filter(ev => ev.kind === "interview").map(ev => ({ app, ev }))).sort((a, b) => (a.ev.at < b.ev.at ? -1 : 1)), [apps]);
  const shown = rows.filter(row => when === "all" || (when === "upcoming" ? (row.ev.at.slice(0, 10) || "9999") >= today() : (row.ev.at.slice(0, 10) || "9999") < today()));
  const days = useMemo(() => { const map = new Map<string, Row[]>(); for (const row of shown) { const key = row.ev.at.slice(0, 10) || t("ivs.noDate"); map.set(key, [...(map.get(key) ?? []), row]); } return [...map.entries()]; }, [shown, t]);

  async function persist(app: AppDoc, events: Ev[], okMessage: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await saveRecordBody({ id: app.id, kind: "application", title: app.title, status: app.status, content: { ...app.content, events }, expectedRevision: app.revision });
      setApps(await loadAll()); setNotice(okMessage);
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.code === "VERSION_CONFLICT" ? t("ivs.conflict") : caught instanceof ApiRequestError && caught.code === "VALIDATION_FAILED" ? t("ivs.invalid") : t("ivs.saveError"));
      try { setApps(await loadAll()); } catch { /* keep what is shown */ }
    } finally { setBusy(false); }
  }
  const addInterview = () => {
    const app = (apps ?? []).find(item => item.id === add.appId);
    if (!app || !add.at) return;
    void persist(app, [...app.content.events, { id: crypto.randomUUID(), kind: "interview", at: add.at, notes: add.notes.trim(), stage: add.stage, status: "scheduled", outcome: "pending", questions: "", feedback: "" }], t("ivs.added")).then(() => setAdd(current => ({ ...current, at: "", notes: "" })));
  };

  if (apps && apps.length === 0 && !busy) return <section className="oq-rec" aria-label={t("ivs.aria")}>
    <p>{t("ivs.empty")}</p><Link className="fw-primary" href="/app/applications">{t("ivs.toTracker")}</Link>
  </section>;

  return <section className="oq-rec" aria-label={t("ivs.aria")}>
    <p>{t("ivs.intro")}</p>
    {busy && <p role="status">{t("ivs.loading")}</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <fieldset className="oq-rec-group"><legend>{t("ivs.addTitle")}</legend>
      <label className="fw-field">{t("ivs.application")}<select value={add.appId} onChange={e => setAdd({ ...add, appId: e.target.value })}>{(apps ?? []).map(app => <option key={app.id} value={app.id}>{app.title}{app.content.organization ? ` · ${app.content.organization}` : ""}</option>)}</select></label>
      <label className="fw-field">{t("ivs.at")}<input type="datetime-local" value={add.at} onChange={e => setAdd({ ...add, at: e.target.value })} /></label>
      <label className="fw-field">{t("ivs.stage")}<select value={add.stage} onChange={e => setAdd({ ...add, stage: e.target.value as Ev["stage"] })}>{interviewStages.map(stage => <option key={stage} value={stage}>{t(`ivs.st.${stage}` as MessageKey)}</option>)}</select></label>
      <label className="fw-field">{t("ivs.notes")}<input maxLength={500} value={add.notes} onChange={e => setAdd({ ...add, notes: e.target.value })} /></label>
      <button className="fw-primary" disabled={busy || !add.appId || !add.at} onClick={addInterview}>{t("ivs.add")}</button>
    </fieldset>
    <div className="oq-rec-chips" role="group" aria-label={t("ivs.viewAria")}>
      {(["list", "day"] as const).map(option => <button key={option} className="fw-secondary" aria-pressed={view === option} onClick={() => setView(option)}>{t(`ivs.v.${option}` as MessageKey)}</button>)}
      {(["all", "upcoming", "past"] as const).map(option => <button key={option} className="fw-secondary" aria-pressed={when === option} onClick={() => setWhen(option)}>{t(`ivs.w.${option}` as MessageKey)}</button>)}
    </div>
    {shown.length === 0 && !busy && <p>{t("ivs.none")}</p>}
    {view === "list" ? <ul className="oq-rec-list" aria-label={t("ivs.listAria")}>{shown.map(row => <li key={row.ev.id}><InterviewCard row={row} busy={busy} persist={persist} /></li>)}</ul>
      : <div aria-label={t("ivs.dayAria")}>{days.map(([day, list]) => <section key={day} className="oq-rec-group"><h3>{day}</h3><ul className="oq-rec-list">{list.map(row => <li key={row.ev.id}><InterviewCard row={row} busy={busy} persist={persist} /></li>)}</ul></section>)}</div>}
    <p className="fw-notice">{t("ivs.private")}</p>
  </section>;
}

function InterviewCard({ row, busy, persist }: { row: Row; busy: boolean; persist: (app: AppDoc, events: Ev[], message: string) => Promise<void> }) {
  const { t } = useI18n();
  const [ev, setEv] = useState<Ev>(row.ev);
  const ticked = row.app.content.prep.filter(Boolean).length;
  const replace = (next: Ev | null) => persist(row.app, row.app.content.events.flatMap(item => item.id !== row.ev.id ? [item] : next ? [next] : []), next ? t("ivs.saved") : t("ivs.removed"));
  return <article aria-label={`${row.app.title} ${row.ev.at}`}>
    <h4>{row.app.title}{row.app.content.organization ? ` · ${row.app.content.organization}` : ""}</h4>
    <p>{row.ev.at.replace("T", " ") || t("ivs.noDate")} · {t(`ivs.st.${ev.stage}` as MessageKey)} · {t(`ivs.s.${ev.status}` as MessageKey)} · {t(`ivs.o.${ev.outcome}` as MessageKey)}</p>
    <p>{t("ivs.prep", { done: ticked, total: prepItems.length })} <Link href="/app/applications">{t("ivs.openTracker")}</Link></p>
    <label className="fw-field">{t("ivs.stage")}<select value={ev.stage} onChange={e => setEv({ ...ev, stage: e.target.value as Ev["stage"] })}>{interviewStages.map(stage => <option key={stage} value={stage}>{t(`ivs.st.${stage}` as MessageKey)}</option>)}</select></label>
    <label className="fw-field">{t("ivs.status")}<select value={ev.status} onChange={e => setEv({ ...ev, status: e.target.value as Ev["status"] })}>{interviewStatuses.map(status => <option key={status} value={status}>{t(`ivs.s.${status}` as MessageKey)}</option>)}</select></label>
    <label className="fw-field">{t("ivs.outcome")}<select value={ev.outcome} onChange={e => setEv({ ...ev, outcome: e.target.value as Ev["outcome"] })}>{interviewOutcomes.map(outcome => <option key={outcome} value={outcome}>{t(`ivs.o.${outcome}` as MessageKey)}</option>)}</select></label>
    <label className="fw-field">{t("ivs.questions")}<textarea maxLength={800} value={ev.questions} onChange={e => setEv({ ...ev, questions: e.target.value })} /></label>
    <label className="fw-field">{t("ivs.notes")}<textarea maxLength={500} value={ev.notes} onChange={e => setEv({ ...ev, notes: e.target.value })} /></label>
    <label className="fw-field">{t("ivs.feedback")}<textarea maxLength={800} value={ev.feedback} onChange={e => setEv({ ...ev, feedback: e.target.value })} /></label>
    <div className="oq-rec-chips">
      <button className="fw-primary" disabled={busy} aria-label={t("ivs.saveFor", { title: row.app.title })} onClick={() => void replace(ev)}>{t("ivs.save")}</button>
      <button className="fw-secondary" disabled={busy} aria-label={t("ivs.removeFor", { title: row.app.title })} onClick={() => { if (window.confirm(t("ivs.confirmRemove"))) void replace(null); }}>{t("ivs.remove")}</button>
    </div>
  </article>;
}
