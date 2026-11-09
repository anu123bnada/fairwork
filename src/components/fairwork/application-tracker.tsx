"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiRequestError, appRequest } from "@/features/authority/client";
import { listRecordsOf, readRecordById, removeRecordById, saveRecordBody } from "@/features/records/client";
import { applicationStatuses, emptyApplication, prepItems, type ApplicationContent, type RecordSummary } from "@/features/records/schema";
import { opportunityPage } from "@/features/opportunities/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

type Status = (typeof applicationStatuses)[number];
type Draft = { id: string; title: string; status: Status; content: ApplicationContent; revision: number };
type Listing = { id: string; title: string; organization: string; location: string };

// Application Tracker: the person's own record of where they applied, what stage each is at, interviews and follow-ups, and an interview preparation checklist.
// Everything is typed by the person, private to them and unverified; it never contacts an employer.
export function ApplicationTracker() {
  const { t } = useI18n();
  const [items, setItems] = useState<RecordSummary[] | null>(null), [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState(""), [filter, setFilter] = useState<Status | "all">("all");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [event, setEvent] = useState({ kind: "interview" as "interview" | "follow_up" | "note", at: "", notes: "" });

  async function load() {
    setBusy(true); setError("");
    try { setItems(await listRecordsOf("application")); } catch { setItems(null); setError(t("trk.loadError")); } finally { setBusy(false); }
  }
  useEffect(() => {
    let live = true;
    (async () => {
      try { const result = await listRecordsOf("application"); if (live) setItems(result); }
      catch { if (live) setError(t("trk.loadError")); }
      finally { if (live) setBusy(false); }
    })();
    return () => { live = false; };
  }, [t]);

  async function open(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const doc = await readRecordById(id);
      if (doc.kind !== "application") throw new Error("kind");
      setDraft({ id: doc.id, title: doc.title, status: doc.status, content: doc.content, revision: doc.revision });
    } catch { setError(t("trk.loadError")); } finally { setBusy(false); }
  }
  async function save() {
    if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await saveRecordBody({ id: draft.id, kind: "application", title: draft.title.trim(), status: draft.status, content: draft.content, expectedRevision: draft.revision });
      setDraft({ ...draft, revision: result.revision }); setNotice(t("trk.saved")); await load();
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.code === "VERSION_CONFLICT" ? t("trk.conflict") : caught instanceof ApiRequestError && caught.code === "VALIDATION_FAILED" ? t("trk.invalid") : t("trk.saveError"));
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!window.confirm(t("trk.confirmDelete"))) return;
    setBusy(true); setError("");
    try { await removeRecordById(id); if (draft?.id === id) setDraft(null); await load(); } catch { setError(t("trk.deleteError")); setBusy(false); }
  }
  async function loadListings() {
    try {
      const page = opportunityPage.parse(await appRequest("/api/v1/opportunities?view=discover"));
      setListings(page.items.filter(item => item.status === "published").map(item => ({ id: item.id, title: item.fields.title, organization: item.companyName ?? "", location: item.fields.location })));
    } catch { setError(t("trk.listingsError")); }
  }
  const change = (patch: Partial<ApplicationContent>) => setDraft(current => current ? { ...current, content: { ...current.content, ...patch } } : current);

  if (!draft) {
    const counts = Object.fromEntries(applicationStatuses.map(status => [status, items?.filter(item => item.status === status).length ?? 0]));
    const shown = (items ?? []).filter(item => filter === "all" || item.status === filter);
    const upcoming = (items ?? []).filter(item => item.summary.nextStepAt && !["rejected", "withdrawn", "accepted"].includes(item.status)).sort((a, b) => (a.summary.nextStepAt! < b.summary.nextStepAt! ? -1 : 1)).slice(0, 5);
    return <section className="oq-rec" aria-label={t("trk.aria")}>
      <p>{t("trk.intro")}</p>
      {busy && <p role="status">{t("trk.loading")}</p>}{error && <p role="alert">{error}</p>}
      <button className="fw-primary" disabled={busy} onClick={() => { setDraft({ id: crypto.randomUUID(), title: "", status: "saved", content: { ...emptyApplication, prep: [...emptyApplication.prep] }, revision: 0 }); setNotice(""); setError(""); }}>{t("trk.new")}</button>
      {items && <div className="oq-rec-chips" role="group" aria-label={t("trk.filterAria")}>
        <button className="fw-secondary" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>{t("trk.all", { count: items.length })}</button>
        {applicationStatuses.map(status => <button key={status} className="fw-secondary" aria-pressed={filter === status} onClick={() => setFilter(status)}>{t(`trk.s.${status}` as MessageKey)} ({counts[status]})</button>)}
      </div>}
      {upcoming.length > 0 && <section aria-label={t("trk.upcomingAria")}><h3>{t("trk.upcoming")}</h3><ul>{upcoming.map(item => <li key={item.id}>{item.summary.nextStepAt?.replace("T", " ")} · {item.title}{item.summary.organization ? ` · ${item.summary.organization}` : ""}</li>)}</ul></section>}
      {items && items.length === 0 && !busy && <p>{t("trk.none")}</p>}
      <ul className="oq-rec-list">{shown.map(item => <li key={item.id}>
        <strong>{item.title}</strong>{item.summary.organization ? ` · ${item.summary.organization}` : ""} · <span data-status={item.status}>{t(`trk.s.${item.status}` as MessageKey)}</span>
        {item.summary.eventCount > 0 ? ` · ${t("trk.events", { count: item.summary.eventCount })}` : ""}
        <button className="fw-secondary" disabled={busy} onClick={() => void open(item.id)}>{t("trk.open")}</button>
        <button className="fw-secondary" disabled={busy} onClick={() => void remove(item.id)}>{t("trk.delete")}</button>
      </li>)}</ul>
      <p><Link className="fw-secondary" href="/app/opportunities">{t("trk.findListings")}</Link> <Link className="fw-secondary" href="/app/guidance">{t("trk.prepHelp")}</Link></p>
      <p className="fw-notice">{t("trk.private")}</p>
    </section>;
  }

  const c = draft.content;
  const sortedEvents = [...c.events].sort((a, b) => (a.at < b.at ? -1 : 1));
  return <section className="oq-rec" aria-label={t("trk.aria")}>
    <button className="fw-secondary" disabled={busy} onClick={() => { setDraft(null); setNotice(""); setError(""); void load(); }}>{t("trk.back")}</button>
    {busy && <p role="status">{t("trk.loading")}</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <label className="fw-field">{t("trk.f.title")}<input maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
    <label className="fw-field">{t("trk.f.organization")}<input maxLength={120} value={c.organization} onChange={e => change({ organization: e.target.value })} /></label>
    <label className="fw-field">{t("trk.f.location")}<input maxLength={120} value={c.location} onChange={e => change({ location: e.target.value })} /></label>
    <label className="fw-field">{t("trk.f.status")}<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Status })}>{applicationStatuses.map(status => <option key={status} value={status}>{t(`trk.s.${status}` as MessageKey)}</option>)}</select></label>
    <label className="fw-field">{t("trk.f.appliedOn")}<input type="date" value={c.appliedOn} onChange={e => change({ appliedOn: e.target.value })} /></label>
    <label className="fw-field">{t("trk.f.nextStep")}<input type="datetime-local" value={c.nextStepAt} onChange={e => change({ nextStepAt: e.target.value })} /></label>
    <label className="fw-field">{t("trk.f.notes")}<textarea maxLength={2000} value={c.notes} onChange={e => change({ notes: e.target.value })} /></label>
    <section aria-label={t("trk.listingAria")}>
      <button type="button" className="fw-secondary" onClick={() => void loadListings()}>{t("trk.chooseListing")}</button>
      {listings && listings.length === 0 && <p>{t("trk.noListings")}</p>}
      {listings && listings.length > 0 && <label className="fw-field">{t("trk.pickListing")}<select value={c.listingId ?? ""} onChange={e => {
        const pick = listings.find(listing => listing.id === e.target.value);
        if (pick) { change({ listingId: pick.id, organization: pick.organization, location: pick.location }); setDraft(current => current && !current.title.trim() ? { ...current, title: pick.title } : current); }
        else change({ listingId: null });
      }}><option value="">{t("trk.noListingChosen")}</option>{listings.map(listing => <option key={listing.id} value={listing.id}>{listing.title}{listing.organization ? ` · ${listing.organization}` : ""}</option>)}</select></label>}
    </section>
    <fieldset className="oq-rec-group"><legend>{t("trk.prep")}</legend>
      {prepItems.map((item, index) => <label key={item} className="oq-rec-check"><input type="checkbox" checked={Boolean(c.prep[index])} onChange={e => change({ prep: prepItems.map((_, i) => i === index ? e.target.checked : Boolean(c.prep[i])) })} /> {t(`trk.prep.${item}` as MessageKey)}</label>)}
      <p className="fw-notice">{t("trk.prepNote")}</p>
    </fieldset>
    <fieldset className="oq-rec-group"><legend>{t("trk.eventsTitle")}</legend>
      <ul>{sortedEvents.map(item => <li key={item.id}>{t(`trk.ek.${item.kind}` as MessageKey)} · {item.at.replace("T", " ") || t("trk.noDate")}{item.notes ? ` · ${item.notes}` : ""} <button type="button" className="fw-secondary" onClick={() => change({ events: c.events.filter(other => other.id !== item.id) })}>{t("trk.removeItem")}</button></li>)}</ul>
      <label className="fw-field">{t("trk.ev.kind")}<select value={event.kind} onChange={e => setEvent({ ...event, kind: e.target.value as typeof event.kind })}>{(["interview", "follow_up", "note"] as const).map(kind => <option key={kind} value={kind}>{t(`trk.ek.${kind}` as MessageKey)}</option>)}</select></label>
      <label className="fw-field">{t("trk.ev.at")}<input type="datetime-local" value={event.at} onChange={e => setEvent({ ...event, at: e.target.value })} /></label>
      <label className="fw-field">{t("trk.ev.notes")}<input maxLength={500} value={event.notes} onChange={e => setEvent({ ...event, notes: e.target.value })} /></label>
      <button type="button" className="fw-secondary" disabled={c.events.length >= 30} onClick={() => { change({ events: [...c.events, { id: crypto.randomUUID(), kind: event.kind, at: event.at, notes: event.notes.trim() }] }); setEvent({ kind: event.kind, at: "", notes: "" }); }}>{t("trk.ev.add")}</button>
    </fieldset>
    <button className="fw-primary" disabled={busy || !draft.title.trim()} onClick={() => void save()}>{t("trk.save")}</button>
  </section>;
}
