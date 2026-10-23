"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { offerListSchema, type OfferList } from "@/features/offer/list-schema";
import { OrganizationRequests } from "./organization-requests";
import { CompanyProfiles } from "./company-profiles";

export function SavedOffers({ context = "WORKER" }: { context?: "WORKER" | "EMPLOYER" }) {
  const [list, setList] = useState<OfferList | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const load = useCallback(async (cursor: string | null = null) => {
    setBusy(true); setError("");
    try {
      const page = offerListSchema.parse(await appRequest(`/api/v1/offers?context=${context}${cursor ? `&cursor=${cursor}` : ""}`));
      setList(previous => ({ ...page, items: cursor ? [...(previous?.items ?? []), ...page.items] : page.items }));
    } catch (caught) { setList(null); setError(caught instanceof Error ? caught.message : "Saved offers could not be loaded."); }
    finally { setBusy(false); }
  }, [context]);
  useEffect(() => {
    let active = true;
    appRequest(`/api/v1/offers?context=${context}`).then(raw => {
      if (active) setList(offerListSchema.parse(raw));
    }).catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Saved offers could not be loaded."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [context]);
  return <section className="fw-list-card" aria-label="Saved offers">
    <h3>{context === "EMPLOYER" ? "Offers you represent" : "Your saved offers"}</h3>
    {list?.items.map(item => <div className="fw-list-row" key={item.offerId}>
      <span><strong>{item.role || "Untitled offer"}</strong><br />Revision {item.version} · {item.questions} clarification questions</span>
      <Link className="fw-small-action" href={`/app/agreement?offerId=${item.offerId}`}>Open offer</Link>
    </div>)}
    {!busy && !error && list?.items.length === 0 && <p>No saved offers are available in this workspace.</p>}
    {busy && <p role="status">Loading saved offers…</p>}
    {error && <p role="alert">{error}</p>}
    <button className="fw-secondary" disabled={busy} onClick={() => void load()}>Refresh offers</button>
    {list?.nextCursor && <button className="fw-secondary" disabled={busy} onClick={() => void load(list.nextCursor)}>Load more offers</button>}
  </section>;
}

export function EmployerWorkspace() {
  return <>
    <header className="fw-employer-top"><Link href="/app/settings">Back to settings</Link><span className="fw-pill fw-employer-pill">EMPLOYER VIEW</span></header>
    <div className="fw-employer-heading"><h2>Your employer workspace</h2><p>Only offers where you are the designated representative with current organization authority appear here.</p></div>
    <SavedOffers context="EMPLOYER" />
    <OrganizationRequests />
    <CompanyProfiles />
    <section className="fw-card fw-employer-new-offer"><span><strong>Create an offer</strong><br /><small>Approved organization membership is required. Selecting employer does not grant access.</small></span><Link className="fw-small-action" href="/app/add-offer">+ New</Link></section>
    <Link className="fw-secondary" href="/app/work-record">Review work records</Link>
    <Link className="fw-secondary" href="/app/cases">Case review</Link>
  </>;
}
