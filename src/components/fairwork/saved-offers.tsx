"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { TeamRoster } from "./team-roster";
import { CompanyResearch } from "./company-research";
import Link from "next/link";
import { useI18n } from "@/i18n/use-i18n";
import { appRequest, ApiRequestError } from "@/features/authority/client";
import { offerListSchema, type OfferList } from "@/features/offer/list-schema";
import { offerDecision, offerLifecycleResult } from "@/features/offer/lifecycle-schema";
import { OrganizationRequests } from "./organization-requests";
import { CompanyProfiles } from "./company-profiles";
import { RecruiterEmployerPanel } from "./recruiter-employer";
import { filterOffers } from "@/features/offer/list-filter";
import { OrganizationPlan } from "./org-plan-panel";
import { OfferComparison } from "./offer-comparison";

export function SavedOffers({ context = "WORKER" }: { context?: "WORKER" | "EMPLOYER" }) {
  const { t } = useI18n();
  const [list, setList] = useState<OfferList | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<string[] | null>(null);
  const [view, setView] = useState("active");
  const [query, setQuery] = useState(""), [decisionFilter, setDecisionFilter] = useState("all");
  const pendingKeys = useRef(new Map<string, string>());
  const saving = useRef(false);
  const load = useCallback(async (cursor: string | null = null) => {
    setBusy(true); setError(""); setSelected([]); setComparison(null);
    try {
      const page = offerListSchema.parse(await appRequest(`/api/v1/offers?context=${context}&view=${view}${cursor ? `&cursor=${cursor}` : ""}`));
      setList(previous => ({ ...page, items: cursor ? [...(previous?.items ?? []), ...page.items] : page.items }));
    } catch (caught) { setList(null); setError(caught instanceof ApiRequestError ? caught.message : "Saved offers could not be loaded."); }
    finally { setBusy(false); }
  }, [context, view]);
  useEffect(() => {
    let active = true;
    appRequest(`/api/v1/offers?context=${context}&view=${view}`).then(raw => {
      if (active) setList(offerListSchema.parse(raw));
    }).catch(caught => { if (active) setError(caught instanceof ApiRequestError ? caught.message : "Saved offers could not be loaded."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [context, view]);
  // Searching or filtering must cover every saved offer, not only the first page: while either is active, keep loading the remaining pages (at most 200 offers).
  useEffect(() => {
    if (!(query.trim() || decisionFilter !== "all") || !list?.nextCursor || busy || list.items.length >= 200) return;
    let active = true; const cursor = list.nextCursor;
    void Promise.resolve().then(() => { if (active) return load(cursor); });
    return () => { active = false; };
  }, [query, decisionFilter, list, busy, load]);
  async function update(item: OfferList["items"][number], archived: boolean, decision: string) {
    if (saving.current || busy) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const input = { offerId: item.offerId, archived, decision: offerDecision.parse(decision), expectedRevision: item.lifecycleRevision ?? 0 };
      const fingerprint = JSON.stringify(input);
      let key = pendingKeys.current.get(fingerprint);
      if (!key) { key = crypto.randomUUID(); pendingKeys.current.set(fingerprint, key); }
      offerLifecycleResult.parse(await appRequest("/api/v1/offers/lifecycle", { ...input, idempotencyKey: key }));
      await load();
    } catch (caught) { setError(`${caught instanceof ApiRequestError ? caught.message : "The change could not be saved."} Refresh to check the saved state, or retry the same action.`); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="fw-list-card" aria-label={t("offers.region")}>
    <h3>{context === "EMPLOYER" ? t("offers.employerTitle") : t("offers.title")}</h3>
    <p>{t("offers.privacy")}</p>
    <label className="fw-field">{t("offers.view")}<select value={view} disabled={busy} onChange={event => { setList(null); setError(""); setSelected([]); setComparison(null); setBusy(true); setView(event.target.value); }}><option value="active">{t("offers.viewActive")}</option><option value="archived">{t("offers.viewArchived")}</option><option value="all">{t("offers.viewAll")}</option></select></label>
    {list && list.items.length > 0 && <>
      <label className="fw-field">{t("offers.search")}<input type="search" maxLength={80} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="fw-field">{t("offers.filterDecision")}<select value={decisionFilter} onChange={event => setDecisionFilter(event.target.value)}><option value="all">{t("offers.allDecisions")}</option><option value="considering">{t("offers.considering")}</option><option value="interested">{t("offers.interested")}</option><option value="accepted">{t("offers.accepted")}</option><option value="declined">{t("offers.declined")}</option></select></label>
      <small>{t("offers.searchNote")}</small>
    </>}
    {list && list.items.length > 1 && <p>{t("offers.compareHint")}</p>}
    {list && list.items.length > 0 && filterOffers(list.items, query, decisionFilter).length === 0 && <p>{t("offers.noMatch")}</p>}
    {list && filterOffers(list.items, query, decisionFilter).map(item => <div className="fw-list-row" key={item.offerId}>
      <label><input type="checkbox" aria-label={t("offers.compareAria", { role: item.role || t("offers.untitled") })} checked={selected.includes(item.offerId)} disabled={busy || (!selected.includes(item.offerId) && selected.length >= 3)} onChange={event => { setComparison(null); setSelected(previous => event.target.checked ? [...previous, item.offerId] : previous.filter(id => id !== item.offerId)); }} /> <strong>{item.role || t("offers.untitled")}</strong><br />{t("offers.revision", { version: item.version, count: item.questions })}</label>
      <Link className="fw-small-action" href={`/app/agreement?offerId=${item.offerId}`}>{t("offers.open")}</Link>
      <label className="fw-field">{t("offers.decisionFor", { role: item.role || t("offers.untitled") })}<select disabled={busy} value={item.decision ?? "considering"} onChange={event => void update(item, item.archived ?? false, event.target.value)}><option value="considering">{t("offers.considering")}</option><option value="interested">{t("offers.interested")}</option><option value="accepted">{t("offers.accepted")}</option><option value="declined">{t("offers.declined")}</option></select></label>
      <button className="fw-secondary" disabled={busy} onClick={() => void update(item, !item.archived, item.decision ?? "considering")}>{item.archived ? t("offers.restore") : t("offers.archive")}</button>
    </div>)}
    {!busy && !error && list?.items.length === 0 && <p>{t("offers.empty")}</p>}
    {busy && <p role="status">{t("offers.loading")}</p>}
    {error && <p role="alert">{error}</p>}
    {list && list.items.length > 1 && <button className="fw-secondary" disabled={busy || selected.length < 2} onClick={() => setComparison([...selected])}>{t("offers.compareButton", { count: selected.length })}</button>}
    {comparison && <><button className="fw-secondary" onClick={() => setComparison(null)}>{t("offers.closeCompare")}</button><OfferComparison key={comparison.join(",")} ids={comparison} /></>}
    <button className="fw-secondary" disabled={busy} onClick={() => void load()}>{t("offers.refresh")}</button>
    {list?.nextCursor && <button className="fw-secondary" disabled={busy} onClick={() => void load(list.nextCursor)}>{t("offers.more")}</button>}
  </section>;
}

export function EmployerWorkspace() {
  return <>
    <header className="fw-employer-top"><Link href="/app/settings">Back to settings</Link><span className="fw-pill fw-employer-pill">EMPLOYER VIEW</span></header>
    <div className="fw-employer-heading"><h2>Your employer workspace</h2><p>Only offers where you are the designated representative with current organization authority appear here.</p></div>
    <section className="fw-list-card" aria-label="Employer onboarding"><h3>Set up your organization</h3><ol><li>Request a new organization or join an existing one below.</li><li>Check your request status after independent review.</li><li>Once authorized, complete company information and manage your offers.</li></ol><p>Account registration is complete. Organization verification is separate; no real employer verification service is connected.</p></section>
    <OrganizationRequests />
    <CompanyProfiles />
    <CompanyResearch />
    <RecruiterEmployerPanel />
    <OrganizationPlan />
    <TeamRoster />
    <Link className="fw-secondary" href="/app/opportunities">Manage opportunity listings</Link>
    <SavedOffers context="EMPLOYER" />
    <section className="fw-card fw-employer-new-offer"><span><strong>Create an offer</strong><br /><small>Approved organization membership is required. Selecting employer does not grant access.</small></span><Link className="fw-small-action" href="/app/add-offer">+ New</Link></section>
    <Link className="fw-secondary" href="/app/work-record">Review work records</Link>
    <Link className="fw-secondary" href="/app/cases">Case review</Link>
  </>;
}
