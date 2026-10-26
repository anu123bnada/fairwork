"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ApiRequestError, appRequest } from "@/features/authority/client";
import { companyResultsSchema } from "@/features/authority/company-schema";
import { defaultPreferences, opportunityCommand, opportunityPage, type Opportunity, type OpportunityPage, type Preferences } from "@/features/opportunities/schema";
import { explainMatch, type MatchReason } from "@/features/opportunities/matching";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import { ReportProblem } from "./report-problem";

const inputText = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const amount = (data: FormData, key: string) => inputText(data, key) === "" ? null : Number(data.get(key));
type Save = (body: Record<string, unknown>) => Promise<boolean>;

export function OpportunitiesScreen() {
  const { t } = useI18n();
  const word = (family: string, value: string) => { const key = `${family}.${value}`; const text = t(key as MessageKey); return text === key ? value : text; };
  const explain = (reason: MatchReason) => {
    const values = { ...reason.values };
    for (const field of ["wanted", "actual"] as const) if (reason.id === "workMode" && typeof values[field] === "string") values[field] = word("op.wm", String(values[field]));
    if (typeof values.period === "string") values.period = word("op.pp", values.period);
    const key = reason.id === "role" || reason.id === "location" ? "op.m.textDetail" : reason.id === "workMode" ? "op.m.modeDetail" : reason.id === "pay" ? "op.m.payDetail" : "op.m.payUnknown";
    return t(key as MessageKey, values);
  };
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
    } catch (caught) { if (sequence.current === current) { setData(null); setEditing(null); setError(caught instanceof Error ? caught.message : t("op.unavailable")); } }
    finally { if (sequence.current === current) setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/opportunities?view=discover").then(raw => { if (active) setData(opportunityPage.parse(raw)); })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : t("op.unavailable")); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [t]);
  const save: Save = async body => {
    const fingerprint = JSON.stringify(body);
    let key = keys.current.get(fingerprint);
    if (!key) { key = crypto.randomUUID(); keys.current.set(fingerprint, key); }
    const parsed = opportunityCommand.safeParse({ ...body, idempotencyKey: key });
    if (!parsed.success) { setError(t("op.checkFields")); return false; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await appRequest("/api/v1/opportunities", parsed.data);
      if (result?.saved !== true) throw new Error(t("op.notConfirmed"));
      keys.current.delete(fingerprint); setNotice(t("op.saved"));
      setEditing(null); await load(); return true;
    } catch (caught) {
      setData(null);
      if (caught instanceof ApiRequestError && [401, 403].includes(caught.status)) setEditing(null);
      setError(caught instanceof Error ? caught.message : t("op.saveFail")); return false;
    }
    finally { setBusy(false); }
  };
  function changeView(value: string) { setView(value); setData(null); setNotice(""); void load(value); }
  return <section className="fw-opportunities" aria-label={t("op.aria")}>
    <p>{t("op.intro")}</p>
    <div className="fw-discovery-tabs" role="group" aria-label={t("op.viewAria")}>{(["discover", "saved", "hidden", "mine"] as const).map(value => <button key={value} className="fw-secondary" disabled={busy} aria-pressed={view === value} onClick={() => changeView(value)}>{t(`op.v.${value}` as MessageKey)}</button>)}</div>
    <form onSubmit={event => { event.preventDefault(); setNotice(""); void load(); }}><label className="fw-field">{t("op.search")}<input value={query} onChange={event => setQuery(event.target.value)} maxLength={120} /></label><button className="fw-secondary" disabled={busy}>{t("op.searchButton")}</button></form>
    {data && <PreferenceForm key={data.preferenceVersion} value={data.preferences ?? defaultPreferences} revision={data.preferenceVersion} busy={busy} save={save} />}
    {view === "mine" && <><p>{t("op.mineNote")}</p><button className="fw-primary" disabled={busy} onClick={() => setEditing("new")}>{t("op.createListing")}</button></>}
    {editing && <ListingForm key={editing === "new" ? "new" : `${editing.id}:${editing.version}`} item={editing === "new" ? null : editing} busy={busy} save={save} cancel={() => setEditing(null)} />}
    {busy && <p role="status">{t("op.loading")}</p>}
    {error && <p role="alert">{error}</p>}
    {notice && !error && <p role="status">{notice}</p>}
    <button className="fw-secondary" disabled={busy} onClick={() => { setNotice(""); void load(); }}>{t("op.refresh")}</button>
    {data?.items.length === 0 && <p>{t("op.none")}</p>}
    {data && <p>{t("op.matchNote")}</p>}
    {data?.items.map(item => <article className="fw-list-card fw-opportunity-card" key={item.id}>
      <h3>{item.fields.title}</h3><p>{item.companyName ?? t("op.orgUnavailable")} · {item.fields.location} · {word("op.wm", item.fields.workMode)}</p>
      <p>{t("op.claims")}</p>
      <p>{item.fields.description}</p><p>{item.fields.salary === null ? t("op.payNotStated") : `${item.fields.salary} ${item.fields.currency} / ${word("op.pp", item.fields.payPeriod)}`}</p>
      <p>{t("op.statusLine", { status: word("op.st", item.status), version: item.version })}<br />{t("op.datesLine", { updated: new Date(item.updatedAt).toLocaleDateString(), expires: new Date(item.expiresAt).toLocaleDateString() })}</p>
      <ul aria-label={t("op.matchAria")}>{explainMatch(item, data.preferences).map(reason => <li key={reason.criterion}><strong>{t(`op.m.${reason.id === "payUnknown" ? "pay" : reason.id}` as MessageKey)}: {t(`op.o.${reason.outcome}` as MessageKey)}</strong><br />{explain(reason)}</li>)}</ul>
      {explainMatch(item, data.preferences).length === 0 && <p>{t("op.addPrefs")}</p>}
      {item.status === "published" && <div className="fw-discovery-actions"><button className="fw-secondary" disabled={busy} onClick={() => void save({ operation: "choice", id: item.id, choice: item.choice === "saved" ? "none" : "saved" })}>{item.choice === "saved" ? t("op.removeSaved") : t("op.saveListing")}</button><button className="fw-secondary" disabled={busy} onClick={() => void save({ operation: "choice", id: item.id, choice: item.choice === "hidden" ? "none" : "hidden" })}>{item.choice === "hidden" ? t("op.showAgain") : t("op.notInterested")}</button></div>}
      {item.canEdit && <button className="fw-secondary" disabled={busy} onClick={() => setEditing(item)}>{t("op.editListing")}</button>}
      {!item.canEdit && <ReportProblem kind="listing" subjectRef={item.id} subjectLabel={item.fields.title.slice(0, 120)} />}
    </article>)}
    {data?.nextCursor && <button className="fw-secondary" disabled={busy} onClick={() => void load(view, query, data.nextCursor)}>{t("op.more")}</button>}
  </section>;
}

function PreferenceForm({ value, revision, busy, save }: { value: Preferences; revision: number; busy: boolean; save: Save }) {
  const { t } = useI18n();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await save({ operation: "preferences", expectedVersion: revision, preferences: { role: inputText(form, "role"), location: inputText(form, "location"), workMode: inputText(form, "workMode") || null, minimumPay: amount(form, "minimumPay"), currency: inputText(form, "currency"), payPeriod: inputText(form, "payPeriod") } });
  }
  return <details className="fw-list-card"><summary>{t("op.prefSummary")}</summary><p>{t("op.prefNote")}</p><form onSubmit={event => void submit(event)}><fieldset disabled={busy}>
    <label className="fw-field">{t("op.prefRole")}<input name="role" maxLength={120} defaultValue={value.role} /></label>
    <label className="fw-field">{t("op.prefLocation")}<input name="location" maxLength={120} defaultValue={value.location} /></label>
    <label className="fw-field">{t("op.prefMode")}<select name="workMode" defaultValue={value.workMode ?? ""}><option value="">{t("op.noPref")}</option><option value="onsite">{t("op.wm.onsite")}</option><option value="hybrid">{t("op.wm.hybrid")}</option><option value="remote">{t("op.wm.remote")}</option></select></label>
    <label className="fw-field">{t("op.minPay")}<input name="minimumPay" type="number" min="0" max="1000000000" step="0.01" defaultValue={value.minimumPay ?? ""} /></label>
    <PayFields currency={value.currency} period={value.payPeriod} />
    <button className="fw-primary">{t("op.savePrefs")}</button></fieldset></form></details>;
}
function PayFields({ currency, period }: { currency: string; period: string }) {
  const { t } = useI18n();
  const help = useId();
  return <><label className="fw-field">{t("op.payCurrency")}<input name="currency" required pattern="[A-Z]{3}" maxLength={3} defaultValue={currency} aria-describedby={help} /></label><small id={help}>{t("op.currencyHelp")}</small><label className="fw-field">{t("op.payPeriod")}<select name="payPeriod" defaultValue={period}><option value="hour">{t("op.pp.hour")}</option><option value="month">{t("op.pp.month")}</option><option value="year">{t("op.pp.year")}</option></select></label></>;
}
function ListingForm({ item, busy, save, cancel }: { item: Opportunity | null; busy: boolean; save: Save; cancel: () => void }) {
  const { t } = useI18n();
  const [companies, setCompanies] = useState<{ companyId: string; name: string | null }[]>([]), [error, setError] = useState("");
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const [expiry] = useState(() => (item?.expiresAt ?? new Date(Date.now() + 7 * 86400000).toISOString()).slice(0, 10));
  useEffect(() => { let active = true; appRequest("/api/v1/companies").then(raw => { if (active) setCompanies(companyResultsSchema.parse(raw).items); }).catch(() => { if (active) setError(t("op.orgsFail")); }); return () => { active = false; }; }, [t]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const date = new Date(inputText(form, "expiresAt"));
    if (!Number.isFinite(date.getTime()) || (inputText(form, "status") !== "closed" && (date.getTime() <= Date.now() || date.getTime() > Date.now() + 90 * 86400000))) { setError(t("op.expiryRange")); return; }
    setError("");
    await save({ operation: "listing", id, companyId: inputText(form, "companyId"), expectedVersion: item?.version ?? 0, status: inputText(form, "status"), expiresAt: date.toISOString(), fields: { title: inputText(form, "title"), description: inputText(form, "description"), location: inputText(form, "location"), workMode: inputText(form, "workMode"), salary: amount(form, "salary"), currency: inputText(form, "currency"), payPeriod: inputText(form, "payPeriod") } });
  }
  return <section className="fw-list-card" aria-label={t("op.editorAria")}><h3>{item ? t("op.editListing") : t("op.newListing")}</h3><p>{t("op.publishNote")}</p><form onSubmit={event => void submit(event)}><fieldset disabled={busy}>
    <label className="fw-field">{t("op.listingOrg")}<select name="companyId" required defaultValue={item?.companyId ?? ""}><option value="">{t("op.chooseOrg")}</option>{companies.map(company => <option key={company.companyId} value={company.companyId}>{company.name ?? company.companyId}</option>)}</select></label>
    {!companies.length && <p>{t("op.noOrg")}</p>}
    <label className="fw-field">{t("op.title")}<input name="title" required minLength={2} maxLength={120} defaultValue={item?.fields.title} /></label>
    <label className="fw-field">{t("op.description")}<textarea name="description" required minLength={10} maxLength={3000} defaultValue={item?.fields.description} /></label>
    <label className="fw-field">{t("op.location")}<input name="location" required minLength={2} maxLength={120} defaultValue={item?.fields.location} /></label>
    <label className="fw-field">{t("op.arrangement")}<select name="workMode" defaultValue={item?.fields.workMode ?? "onsite"}><option value="onsite">{t("op.wm.onsite")}</option><option value="hybrid">{t("op.wm.hybrid")}</option><option value="remote">{t("op.wm.remote")}</option></select></label>
    <label className="fw-field">{t("op.salary")}<input name="salary" type="number" min="0" max="1000000000" step="0.01" defaultValue={item?.fields.salary ?? ""} /></label>
    <PayFields currency={item?.fields.currency ?? "LKR"} period={item?.fields.payPeriod ?? "month"} />
    <label className="fw-field">{t("op.status")}<select name="status" defaultValue={item?.status ?? "draft"}><option value="draft">{t("op.s.draft")}</option><option value="published">{t("op.s.published")}</option><option value="closed">{t("op.s.closed")}</option></select></label>
    <label className="fw-field">{t("op.expires")}<input name="expiresAt" type="date" required defaultValue={expiry} /></label>
    <button className="fw-primary">{t("op.saveChanges")}</button></fieldset></form>{error && <p role="alert">{error}</p>}<button className="fw-secondary" disabled={busy} onClick={cancel}>{t("op.cancel")}</button></section>;
}
