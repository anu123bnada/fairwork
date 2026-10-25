"use client";
import { useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { companyResultsSchema } from "@/features/authority/company-schema";
import { teamRoster, type TeamRoster } from "@/features/authority/team-schema";

type Entry = { companyId: string; name: string | null; roster: TeamRoster | null; error: boolean };
const day = (value: string) => new Date(value).toLocaleDateString();

// Read-only. Adding, renewing or removing a representative stays an independent operator
// decision (a request, reviewed with evidence); nothing here changes anyone's authority.
export function TeamRoster() {
  const [entries, setEntries] = useState<Entry[] | null>(null), [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const companies = companyResultsSchema.parse(await appRequest("/api/v1/companies")).items;
      const loaded = await Promise.all(companies.map(async (c): Promise<Entry> => {
        try { return { ...c, roster: teamRoster.parse(await appRequest(`/api/v1/organizations/team?companyId=${c.companyId}`)), error: false }; }
        catch { return { ...c, roster: null, error: true }; }
      }));
      if (active) setEntries(loaded);
    })().catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  return <section className="fw-list-card" aria-label="Organization team">
    <h3>Organization team</h3>
    <p>Representatives with approved authority for your organizations. Authority is time-limited and granted only after independent review. To add, renew or remove a representative, submit a request above; you cannot change anyone's authority here.</p>
    {error && <p role="alert">Your organizations could not be loaded. Retry when connected.</p>}
    {!entries && !error && <p role="status">Loading team…</p>}
    {entries?.length === 0 && <p>No organization authorizations yet. Request or join an organization above.</p>}
    {entries?.map(entry => <article className="fw-question-card" key={entry.companyId}>
      <h4>{entry.name ?? "Organization"}</h4>
      {entry.error && <p role="alert">This team could not be loaded.</p>}
      <ul>{entry.roster?.members.map((m, i) => <li key={i}><strong>{m.self ? "You" : `Representative ${i + 1}`}</strong> · {m.status}{m.status === "active" ? ` until ${day(m.expiresAt!)}` : m.status === "expired" ? ` on ${day(m.expiresAt!)}` : m.status === "pending" ? ` from ${day(m.effectiveAt)}` : ""}</li>)}</ul>
    </article>)}
  </section>;
}
