"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { companyResultsSchema } from "@/features/authority/company-schema";

// Discovery only: selection never grants representative authority. The offer
// command still verifies the current actor, membership and participant binding.
export function OfferCompanySelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [items, setItems] = useState<Array<{ companyId: string; name: string | null }>>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);

  useEffect(() => {
    const requests = sequence;
    const ticket = ++sequence.current;
    appRequest("/api/v1/companies").then(raw => {
      if (ticket === sequence.current) setItems(companyResultsSchema.parse(raw).items);
    }).catch(() => {
      if (ticket === sequence.current) setError("Could not load your organizations. Retry the search.");
    }).finally(() => { if (ticket === sequence.current) setLoading(false); });
    return () => { requests.current++; };
  }, []);

  async function search() {
    const ticket = ++sequence.current;
    setLoading(true); setError(""); setItems([]); onChange("");
    try {
      const result = companyResultsSchema.parse(await appRequest(`/api/v1/companies?query=${encodeURIComponent(query.trim())}`));
      if (ticket === sequence.current) setItems(result.items);
    } catch {
      if (ticket === sequence.current) setError("Could not load your organizations. Retry the search.");
    } finally { if (ticket === sequence.current) setLoading(false); }
  }

  return <div>
    <label className="fw-field">Search linked organizations<input value={query} maxLength={120} onChange={event => setQuery(event.target.value)} /></label>
    <button type="button" className="fw-secondary" disabled={loading} onClick={() => void search()}>Search organizations</button>
    <div className="fw-field">
      <label htmlFor="offer-company">Company organization</label>
      <select id="offer-company" name="companyId" required value={value} onChange={event => onChange(event.target.value)} aria-describedby="offer-company-help">
        <option value="">Select a linked organization</option>
        {items.map(item => <option key={item.companyId} value={item.companyId}>{item.name ?? "Organization"} · {item.companyId}</option>)}
      </select>
    </div>
    {loading && <p role="status">Loading linked organizations…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !items.length && <p role="status">No linked organizations found. Search only includes organizations you can already access.</p>}
    <p id="offer-company-help" className="fw-notice">New worker? Ask an authorized employer representative to create your offer and send its participant link. You do not need employer membership to receive an offer. No public company directory is connected.</p>
    <p className="fw-notice">Represent an organization? <Link href="/app/employer">Request independent organization approval</Link> in the employer workspace. A request does not grant access; current local approvals use synthetic evidence.</p>
  </div>;
}
