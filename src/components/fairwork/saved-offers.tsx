"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { TeamRoster } from "./team-roster";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { offerListSchema, type OfferList } from "@/features/offer/list-schema";
import { offerDecision, offerLifecycleResult } from "@/features/offer/lifecycle-schema";
import { OrganizationRequests } from "./organization-requests";
import { CompanyProfiles } from "./company-profiles";
import { OfferComparison } from "./offer-comparison";

export function SavedOffers({ context = "WORKER" }: { context?: "WORKER" | "EMPLOYER" }) {
  const [list, setList] = useState<OfferList | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<string[] | null>(null);
  const [view, setView] = useState("active");
  const pendingKeys = useRef(new Map<string, string>());
  const saving = useRef(false);
  const load = useCallback(async (cursor: string | null = null) => {
    setBusy(true); setError(""); setSelected([]); setComparison(null);
    try {
      const page = offerListSchema.parse(await appRequest(`/api/v1/offers?context=${context}&view=${view}${cursor ? `&cursor=${cursor}` : ""}`));
      setList(previous => ({ ...page, items: cursor ? [...(previous?.items ?? []), ...page.items] : page.items }));
    } catch (caught) { setList(null); setError(caught instanceof Error ? caught.message : "Saved offers could not be loaded."); }
    finally { setBusy(false); }
  }, [context, view]);
  useEffect(() => {
    let active = true;
    appRequest(`/api/v1/offers?context=${context}&view=${view}`).then(raw => {
      if (active) setList(offerListSchema.parse(raw));
    }).catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Saved offers could not be loaded."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [context, view]);
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
    } catch (caught) { setError(`${caught instanceof Error ? caught.message : "The change could not be saved."} Refresh to check the saved state, or retry the same action.`); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="fw-list-card" aria-label="Saved offers">
    <h3>{context === "EMPLOYER" ? "Offers you represent" : "Your saved offers"}</h3>
    <p>Archive and decisions are private to you. Accepting here records your intention; it does not sign or confirm an agreement.</p>
    <label className="fw-field">Offer view<select value={view} disabled={busy} onChange={event => { setList(null); setError(""); setSelected([]); setComparison(null); setBusy(true); setView(event.target.value); }}><option value="active">Active offers</option><option value="archived">Archived offers</option><option value="all">All offers</option></select></label>
    {list && list.items.length > 1 && <p>Select two or three offers to compare their saved terms.</p>}
    {list?.items.map(item => <div className="fw-list-row" key={item.offerId}>
      <label><input type="checkbox" aria-label={`Compare ${item.role || "Untitled offer"}`} checked={selected.includes(item.offerId)} disabled={busy || (!selected.includes(item.offerId) && selected.length >= 3)} onChange={event => { setComparison(null); setSelected(previous => event.target.checked ? [...previous, item.offerId] : previous.filter(id => id !== item.offerId)); }} /> <strong>{item.role || "Untitled offer"}</strong><br />Revision {item.version} · {item.questions} clarification questions</label>
      <Link className="fw-small-action" href={`/app/agreement?offerId=${item.offerId}`}>Open offer</Link>
      <label className="fw-field">Your decision for {item.role || "Untitled offer"}<select disabled={busy} value={item.decision ?? "considering"} onChange={event => void update(item, item.archived ?? false, event.target.value)}><option value="considering">Considering</option><option value="interested">Interested</option><option value="accepted">Accepted privately</option><option value="declined">Declined privately</option></select></label>
      <button className="fw-secondary" disabled={busy} onClick={() => void update(item, !item.archived, item.decision ?? "considering")}>{item.archived ? "Restore offer" : "Archive offer"}</button>
    </div>)}
    {!busy && !error && list?.items.length === 0 && <p>No saved offers are available in this workspace.</p>}
    {busy && <p role="status">Loading saved offers…</p>}
    {error && <p role="alert">{error}</p>}
    {list && list.items.length > 1 && <button className="fw-secondary" disabled={busy || selected.length < 2} onClick={() => setComparison([...selected])}>Compare selected offers ({selected.length}/3)</button>}
    {comparison && <><button className="fw-secondary" onClick={() => setComparison(null)}>Close comparison</button><OfferComparison key={comparison.join(",")} ids={comparison} /></>}
    <button className="fw-secondary" disabled={busy} onClick={() => void load()}>Refresh offers</button>
    {list?.nextCursor && <button className="fw-secondary" disabled={busy} onClick={() => void load(list.nextCursor)}>Load more offers</button>}
  </section>;
}

export function EmployerWorkspace() {
  return <>
    <header className="fw-employer-top"><Link href="/app/settings">Back to settings</Link><span className="fw-pill fw-employer-pill">EMPLOYER VIEW</span></header>
    <div className="fw-employer-heading"><h2>Your employer workspace</h2><p>Only offers where you are the designated representative with current organization authority appear here.</p></div>
    <section className="fw-list-card" aria-label="Employer onboarding"><h3>Set up your organization</h3><ol><li>Request a new organization or join an existing one below.</li><li>Check your request status after independent review.</li><li>Once authorized, complete company information and manage your offers.</li></ol><p>Account registration is complete. Organization verification is separate; no real employer verification service is connected.</p></section>
    <OrganizationRequests />
    <CompanyProfiles />
    <TeamRoster />
    <Link className="fw-secondary" href="/app/opportunities">Manage opportunity listings</Link>
    <SavedOffers context="EMPLOYER" />
    <section className="fw-card fw-employer-new-offer"><span><strong>Create an offer</strong><br /><small>Approved organization membership is required. Selecting employer does not grant access.</small></span><Link className="fw-small-action" href="/app/add-offer">+ New</Link></section>
    <Link className="fw-secondary" href="/app/work-record">Review work records</Link>
    <Link className="fw-secondary" href="/app/cases">Case review</Link>
  </>;
}
