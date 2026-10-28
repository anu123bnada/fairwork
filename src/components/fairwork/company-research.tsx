"use client";
import { useI18n } from "@/i18n/use-i18n";
import { bcp47, type LocaleCode, type MessageKey } from "@/i18n";
import { useRef, useState, type FormEvent } from "react";
import { appRequest, ApiRequestError } from "@/features/authority/client";
import { ResearchHistory } from "./research-history";
import { researchResponse, type Finding, type ResearchResponse } from "@/features/research/schema";

const COUNTRY_CODES = ["LK", "DE", "GB", "IN", "US", "AU", "SG", "AE"];
const KIND_KEY = { supports: "research.kindSupports", contradicts: "research.kindContradicts", outdated: "research.kindOutdated", info: "research.kindInfo", limitation: "research.kindLimitation" } as const satisfies Record<Finding["kind"], MessageKey>;
// Country names come from the browser's own locale data, so every supported language gets a correct name without hand translation.
const countryName = (code: string, locale: LocaleCode) => { try { return new Intl.DisplayNames([bcp47(locale)], { type: "region" }).of(code) ?? code; } catch { return code; } };

// Independent registry research. Results are third-party evidence with a source and a time; they are
// never merged with employer-submitted claims and never turned into a score.
export function CompanyResearch() {
  const { t, locale } = useI18n();
  const when = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString(bcp47(locale), { year: "numeric", month: "short", day: "numeric" }) : t("research.unknown");
  const [name, setName] = useState(""), [country, setCountry] = useState("");
  const [result, setResult] = useState<ResearchResponse | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sequence = useRef(0), [historyKey, setHistoryKey] = useState(0);
  async function search(event: FormEvent | null, override?: { name: string; country: string }) {
    event?.preventDefault();
    const queryName = (override?.name ?? name).trim(), queryCountry = override ? override.country : country;
    const current = ++sequence.current; setBusy(true); setError(""); setResult(null);
    try {
      const params = new URLSearchParams({ name: queryName }); if (queryCountry) params.set("country", queryCountry);
      const value = researchResponse.parse(await appRequest(`/api/v1/research/companies?${params}`));
      if (current === sequence.current) { setResult(value); setHistoryKey(key => key + 1); }
    } catch (caught) {
      if (current === sequence.current) setError(caught instanceof ApiRequestError ? caught.message : t("research.unavailable"));
    } finally { if (current === sequence.current) setBusy(false); }
  }
  return <section className="fw-list-card fw-research" aria-label={t("research.title")}>
    <h3>{t("research.title")}</h3>
    <p>{t("research.intro")}</p>
    <form onSubmit={event => void search(event)}>
      <label className="fw-field">{t("research.companyName")}<input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="fw-field">{t("research.country")}<select value={country} onChange={event => setCountry(event.target.value)}><option value="">{t("research.anyCountry")}</option>{COUNTRY_CODES.map(code => <option key={code} value={code}>{countryName(code, locale)}</option>)}</select></label>
      <button className="fw-primary" disabled={busy || name.trim().length < 2}>{busy ? "…" : t("research.search")}</button>
    </form>
    {busy && <p role="status">{t("research.searching")}</p>}
    {error && <p role="alert">{error}</p>}
    {result && <>
      <p role="status">{result.results.length ? t(result.totalMatches === 1 ? "research.showingOne" : "research.showingMany", { shown: result.results.length, total: result.totalMatches, query: result.query.name }) : t("research.none", { query: result.query.name })}</p>
      {result.results.map(item => <article className="fw-question-card" key={item.record.identifier.value} aria-label={t("research.recordAria", { name: item.record.legalName })}>
        <h4>{item.record.legalName}</h4>
        <p><strong>{t("research.notVerified")}</strong> {item.record.country ?? t("research.countryUnknown")}{item.record.legalForm ? ` · ${item.record.legalForm}` : ""} · {t("research.status", { status: item.record.entityStatus.toLowerCase() })}</p>
        <dl>
          <dt>{t("research.identifier")}</dt><dd>{item.record.identifier.scheme} {item.record.identifier.value}</dd>
          {item.record.registrationAuthority.entityId && <><dt>{t("research.registry")}</dt><dd>{item.record.registrationAuthority.id ?? t("research.authorityUnknown")} · {t("research.number", { value: item.record.registrationAuthority.entityId })}</dd></>}
          {item.record.legalAddress && <><dt>{t("research.address")}</dt><dd>{item.record.legalAddress}</dd></>}
          <dt>{t("research.updated")}</dt><dd>{when(item.record.sourceLastUpdated)} ({item.freshness.status})</dd>
          <dt>{t("research.retrieved")}</dt><dd>{when(item.record.retrievedAt)}{item.freshness.verifyAgainBy ? `; ${t("research.recheck", { date: when(item.freshness.verifyAgainBy) })}` : ""}</dd>
          <dt>{t("research.source")}</dt><dd><a href={item.record.sourceUrl} target="_blank" rel="noopener noreferrer">{t("research.sourceRecord", { provider: item.record.providerName })}</a></dd>
        </dl>
        <ul aria-label={t("research.findings")}>{item.findings.map(f => <li key={f.id}><strong>{t(KIND_KEY[f.kind])}:</strong> {f.title}. {f.detail}</li>)}</ul>
      </article>)}
      <details><summary>{t("research.limits")}</summary><ul>{result.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
    </>}
    <ResearchHistory refreshKey={historyKey} onSearchAgain={(again, againCountry) => { setName(again); setCountry(againCountry ?? ""); void search(null, { name: again, country: againCountry ?? "" }); }} />
  </section>;
}
