"use client";
import { useI18n } from "@/i18n/use-i18n";
import { useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { researchResponse, type Finding, type ResearchResponse } from "@/features/research/schema";

const COUNTRIES: [string, string][] = [["", "Any country"], ["LK", "Sri Lanka"], ["DE", "Germany"], ["GB", "United Kingdom"], ["IN", "India"], ["US", "United States"], ["AU", "Australia"], ["SG", "Singapore"], ["AE", "United Arab Emirates"]];
const KIND_LABEL: Record<Finding["kind"], string> = { supports: "Supports", contradicts: "Does not match", outdated: "May be outdated", info: "Note", limitation: "Limit of this check" };
const when = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "unknown";

// Independent registry research. Results are third-party evidence with a source and a time; they are
// never merged with employer-submitted claims and never turned into a score.
export function CompanyResearch() {
  const { t } = useI18n();
  const [name, setName] = useState(""), [country, setCountry] = useState("");
  const [result, setResult] = useState<ResearchResponse | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sequence = useRef(0);
  async function search(event: FormEvent) {
    event.preventDefault();
    const current = ++sequence.current; setBusy(true); setError(""); setResult(null);
    try {
      const params = new URLSearchParams({ name: name.trim() }); if (country) params.set("country", country);
      const value = researchResponse.parse(await appRequest(`/api/v1/research/companies?${params}`));
      if (current === sequence.current) setResult(value);
    } catch (caught) {
      if (current === sequence.current) setError(caught instanceof Error ? caught.message : "Research is unavailable right now. Try again later.");
    } finally { if (current === sequence.current) setBusy(false); }
  }
  return <section className="fw-list-card fw-research" aria-label={t("research.title")}>
    <h3>{t("research.title")}</h3>
    <p>Check whether a company is recorded in a public registry (GLEIF). You see the source, the date it was retrieved, and what the record does and does not show. This is evidence for your own judgment, not a rating of the employer.</p>
    <form onSubmit={event => void search(event)}>
      <label className="fw-field">{t("research.companyName")}<input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="fw-field">{t("research.country")}<select value={country} onChange={event => setCountry(event.target.value)}>{COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      <button className="fw-primary" disabled={busy || name.trim().length < 2}>{busy ? "…" : t("research.search")}</button>
    </form>
    {busy && <p role="status">Searching the registry…</p>}
    {error && <p role="alert">{error}</p>}
    {result && <>
      <p role="status">{result.results.length ? `Showing ${result.results.length} of ${result.totalMatches} registry match${result.totalMatches === 1 ? "" : "es"} for “${result.query.name}”.` : `No registry record found for “${result.query.name}”.`}</p>
      {result.results.map(item => <article className="fw-question-card" key={item.record.identifier.value} aria-label={`Registry record: ${item.record.legalName}`}>
        <h4>{item.record.legalName}</h4>
        <p><strong>Registry record, not verified by ORYQEN.</strong> {item.record.country ?? "Country unknown"}{item.record.legalForm ? ` · ${item.record.legalForm}` : ""} · status {item.record.entityStatus.toLowerCase()}</p>
        <dl>
          <dt>Identifier</dt><dd>{item.record.identifier.scheme} {item.record.identifier.value}</dd>
          {item.record.registrationAuthority.entityId && <><dt>Business registry</dt><dd>{item.record.registrationAuthority.id ?? "authority unknown"} · number {item.record.registrationAuthority.entityId}</dd></>}
          {item.record.legalAddress && <><dt>Registered address</dt><dd>{item.record.legalAddress}</dd></>}
          <dt>Source updated</dt><dd>{when(item.record.sourceLastUpdated)} ({item.freshness.status})</dd>
          <dt>Retrieved</dt><dd>{when(item.record.retrievedAt)}{item.freshness.verifyAgainBy ? `; re-check by ${when(item.freshness.verifyAgainBy)}` : ""}</dd>
          <dt>Source</dt><dd><a href={item.record.sourceUrl} target="_blank" rel="noopener noreferrer">{item.record.providerName} record</a></dd>
        </dl>
        <ul aria-label="Findings">{item.findings.map(f => <li key={f.id}><strong>{KIND_LABEL[f.kind]}:</strong> {f.title}. {f.detail}</li>)}</ul>
      </article>)}
      <details><summary>Limits of this research</summary><ul>{result.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
    </>}
  </section>;
}
