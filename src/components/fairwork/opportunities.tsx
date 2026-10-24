"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ApiRequestError, appRequest } from "@/features/authority/client";
import { companyResultsSchema } from "@/features/authority/company-schema";
import { defaultPreferences, opportunityCommand, opportunityPage, type Opportunity, type OpportunityPage, type Preferences } from "@/features/opportunities/schema";
import { explainMatch } from "@/features/opportunities/matching";

const inputText = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const amount = (data: FormData, key: string) => inputText(data, key) === "" ? null : Number(data.get(key));
type Save = (body: Record<string, unknown>) => Promise<boolean>;

export function OpportunitiesScreen() {
  const [data, setData] = useState<OpportunityPage | null>(null);
  const [view, setView] = useState("discover"), [query, setQuery] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true), [editing, setEditing] = useState<Opportunity | "new" | null>(null);
  const sequence = useRef(0), keys = useRef(new Map<string, string>());
  async function load(nextView = view, nextQuery = query, cursor: string | null = null) {
    const current = ++sequence.current;
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ view: nextView, query: nextQuery });
      if (cursor) params.set("cursor", cursor);
      const result = opportunityPage.parse(await appRequest(`/api/v1/opportunities?${params}`));
      if (sequence.current === current) setData(previous => ({ ...result, items: cursor ? [...(previous?.items ?? []), ...result.items] : result.items }));
    } catch (caught) { if (sequence.current === current) { setData(null); setEditing(null); setError(caught instanceof Error ? caught.message : "Discovery is unavailable."); } }
    finally { if (sequence.current === current) setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/opportunities?view=discover").then(raw => { if (active) setData(opportunityPage.parse(raw)); })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Discovery is unavailable."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  const save: Save = async body => {
    const fingerprint = JSON.stringify(body);
    let key = keys.current.get(fingerprint);
    if (!key) { key = crypto.randomUUID(); keys.current.set(fingerprint, key); }
    const parsed = opportunityCommand.safeParse({ ...body, idempotencyKey: key });
    if (!parsed.success) { setError("Check the supplied fields, including amount, currency and expiry."); return false; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await appRequest("/api/v1/opportunities", parsed.data);
      if (result?.saved !== true) throw new Error("The server did not confirm this save. Reload to check its status.");
      keys.current.delete(fingerprint); setNotice("Saved. The list below reflects the latest accessible records.");
      setEditing(null); await load(); return true;
    } catch (caught) {
      setData(null);
      if (caught instanceof ApiRequestError && [401, 403].includes(caught.status)) setEditing(null);
      setError(caught instanceof Error ? caught.message : "Save could not be confirmed."); return false;
    }
    finally { setBusy(false); }
  };
  function changeView(value: string) { setView(value); setData(null); setNotice(""); void load(value); }
  return <section className="fw-opportunities" aria-label="Opportunity discovery">
    <p>Listings are submitted by organization representatives. Synthetic authority is not real employer verification. No external jobs provider is connected.</p>
    <div className="fw-discovery-tabs" role="group" aria-label="Listing view">{[["discover", "Discover"], ["saved", "Saved"], ["hidden", "Hidden"], ["mine", "My listings"]].map(([value, label]) => <button key={value} className="fw-secondary" disabled={busy} aria-pressed={view === value} onClick={() => changeView(value!)}>{label}</button>)}</div>
    <form onSubmit={event => { event.preventDefault(); setNotice(""); void load(); }}><label className="fw-field">Search role or location<input value={query} onChange={event => setQuery(event.target.value)} maxLength={120} /></label><button className="fw-secondary" disabled={busy}>Search listings</button></form>
    {data && <PreferenceForm key={data.preferenceVersion} value={data.preferences ?? defaultPreferences} revision={data.preferenceVersion} busy={busy} save={save} />}
    {view === "mine" && <><p>Only the publishing representative can edit a listing. Current organization authority is required for every save.</p><button className="fw-primary" disabled={busy} onClick={() => setEditing("new")}>Create listing</button></>}
    {editing && <ListingForm key={editing === "new" ? "new" : `${editing.id}:${editing.version}`} item={editing === "new" ? null : editing} busy={busy} save={save} cancel={() => setEditing(null)} />}
    {busy && <p role="status">Loading or saving opportunities…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && !error && <p role="status">{notice}</p>}
    <button className="fw-secondary" disabled={busy} onClick={() => { setNotice(""); void load(); }}>Refresh listings</button>
    {data?.items.length === 0 && <p>No accessible listings match this view. No vacancies or matches have been invented.</p>}
    {data && <p>Matching compares only the preferences you supplied with stated listing fields. It is not an AI score, suitability judgment, or salary verification. Listings stay in a stable order; no sensitive traits are used.</p>}
    {data?.items.map(item => <article className="fw-list-card fw-opportunity-card" key={item.id}>
      <h3>{item.fields.title}</h3><p>{item.companyName ?? "Organization name unavailable"} · {item.fields.location} · {item.fields.workMode}</p>
      <p>Representative submission · Unverified claims · Synthetic authority</p>
      <p>{item.fields.description}</p><p>{item.fields.salary === null ? "Pay amount not stated" : `${item.fields.salary} ${item.fields.currency} / ${item.fields.payPeriod}`}</p>
      <p>{item.status} · Revision {item.version}<br />Updated {new Date(item.updatedAt).toLocaleDateString()} · Expires {new Date(item.expiresAt).toLocaleDateString()}</p>
      <ul aria-label="Matching explanation">{explainMatch(item, data.preferences).map(reason => <li key={reason.criterion}><strong>{reason.criterion}: {reason.outcome}</strong><br />{reason.detail}</li>)}</ul>
      {explainMatch(item, data.preferences).length === 0 && <p>Add voluntary preferences to see matching explanations.</p>}
      {item.status === "published" && <div className="fw-discovery-actions"><button className="fw-secondary" disabled={busy} onClick={() => void save({ operation: "choice", id: item.id, choice: item.choice === "saved" ? "none" : "saved" })}>{item.choice === "saved" ? "Remove saved listing" : "Save listing"}</button><button className="fw-secondary" disabled={busy} onClick={() => void save({ operation: "choice", id: item.id, choice: item.choice === "hidden" ? "none" : "hidden" })}>{item.choice === "hidden" ? "Show again" : "Not interested"}</button></div>}
      {item.canEdit && <button className="fw-secondary" disabled={busy} onClick={() => setEditing(item)}>Edit listing</button>}
    </article>)}
    {data?.nextCursor && <button className="fw-secondary" disabled={busy} onClick={() => void load(view, query, data.nextCursor)}>More listings</button>}
  </section>;
}

function PreferenceForm({ value, revision, busy, save }: { value: Preferences; revision: number; busy: boolean; save: Save }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await save({ operation: "preferences", expectedVersion: revision, preferences: { role: inputText(form, "role"), location: inputText(form, "location"), workMode: inputText(form, "workMode") || null, minimumPay: amount(form, "minimumPay"), currency: inputText(form, "currency"), payPeriod: inputText(form, "payPeriod") } });
  }
  return <details className="fw-list-card"><summary>Your private matching preferences</summary><p>Optional. These preferences are not shared with employers. Clear the role, location, arrangement and amount to stop matching.</p><form onSubmit={event => void submit(event)}><fieldset disabled={busy}>
    <label className="fw-field">Preferred role<input name="role" maxLength={120} defaultValue={value.role} /></label>
    <label className="fw-field">Preferred location<input name="location" maxLength={120} defaultValue={value.location} /></label>
    <label className="fw-field">Preferred arrangement<select name="workMode" defaultValue={value.workMode ?? ""}><option value="">No preference</option><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label>
    <label className="fw-field">Minimum pay<input name="minimumPay" type="number" min="0" max="1000000000" step="0.01" defaultValue={value.minimumPay ?? ""} /></label>
    <PayFields currency={value.currency} period={value.payPeriod} />
    <button className="fw-primary">Save preferences</button></fieldset></form></details>;
}
function PayFields({ currency, period }: { currency: string; period: string }) {
  const help = useId();
  return <><label className="fw-field">Pay currency<input name="currency" required pattern="[A-Z]{3}" maxLength={3} defaultValue={currency} aria-describedby={help} /></label><small id={help}>Three uppercase currency letters, such as LKR or USD.</small><label className="fw-field">Pay period<select name="payPeriod" defaultValue={period}><option value="hour">Hour</option><option value="month">Month</option><option value="year">Year</option></select></label></>;
}
function ListingForm({ item, busy, save, cancel }: { item: Opportunity | null; busy: boolean; save: Save; cancel: () => void }) {
  const [companies, setCompanies] = useState<{ companyId: string; name: string | null }[]>([]), [error, setError] = useState("");
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const [expiry] = useState(() => (item?.expiresAt ?? new Date(Date.now() + 7 * 86400000).toISOString()).slice(0, 10));
  useEffect(() => { let active = true; appRequest("/api/v1/companies").then(raw => { if (active) setCompanies(companyResultsSchema.parse(raw).items); }).catch(() => { if (active) setError("Organizations could not be loaded. Close and reopen to retry."); }); return () => { active = false; }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const date = new Date(inputText(form, "expiresAt"));
    if (!Number.isFinite(date.getTime()) || (inputText(form, "status") !== "closed" && (date.getTime() <= Date.now() || date.getTime() > Date.now() + 90 * 86400000))) { setError("Choose an expiry in the next 90 days."); return; }
    setError("");
    await save({ operation: "listing", id, companyId: inputText(form, "companyId"), expectedVersion: item?.version ?? 0, status: inputText(form, "status"), expiresAt: date.toISOString(), fields: { title: inputText(form, "title"), description: inputText(form, "description"), location: inputText(form, "location"), workMode: inputText(form, "workMode"), salary: amount(form, "salary"), currency: inputText(form, "currency"), payPeriod: inputText(form, "payPeriod") } });
  }
  return <section className="fw-list-card" aria-label="Listing editor"><h3>{item ? "Edit listing" : "New listing"}</h3><p>Publishing makes these stated terms visible to signed-in members. Do not include personal contact details or confidential information. Publication does not verify the company.</p><form onSubmit={event => void submit(event)}><fieldset disabled={busy}>
    <label className="fw-field">Listing organization<select name="companyId" required defaultValue={item?.companyId ?? ""}><option value="">Choose an authorized organization</option>{companies.map(company => <option key={company.companyId} value={company.companyId}>{company.name ?? company.companyId}</option>)}</select></label>
    {!companies.length && <p>No organization loaded. Organization approval is required; choosing employer mode grants no authority.</p>}
    <label className="fw-field">Listing title<input name="title" required minLength={2} maxLength={120} defaultValue={item?.fields.title} /></label>
    <label className="fw-field">Listing description<textarea name="description" required minLength={10} maxLength={3000} defaultValue={item?.fields.description} /></label>
    <label className="fw-field">Listing location<input name="location" required minLength={2} maxLength={120} defaultValue={item?.fields.location} /></label>
    <label className="fw-field">Work arrangement<select name="workMode" defaultValue={item?.fields.workMode ?? "onsite"}><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label>
    <label className="fw-field">Stated pay amount (optional)<input name="salary" type="number" min="0" max="1000000000" step="0.01" defaultValue={item?.fields.salary ?? ""} /></label>
    <PayFields currency={item?.fields.currency ?? "LKR"} period={item?.fields.payPeriod ?? "month"} />
    <label className="fw-field">Listing status<select name="status" defaultValue={item?.status ?? "draft"}><option value="draft">Private draft</option><option value="published">Publish for discovery</option><option value="closed">Closed</option></select></label>
    <label className="fw-field">Expires on (UTC)<input name="expiresAt" type="date" required defaultValue={expiry} /></label>
    <button className="fw-primary">Save listing changes</button></fieldset></form>{error && <p role="alert">{error}</p>}<button className="fw-secondary" disabled={busy} onClick={cancel}>Cancel editing</button></section>;
}
