"use client";
import Link from "next/link";
import { useState } from "react";
import { appRequest } from "@/features/authority/client";
import { analyzeCv, type CvAnalysis } from "@/features/cv/analyze";
import { matchListings, type ListingMatch } from "@/features/cv/match";
import type { CvContent } from "@/features/cv/schema";
import { opportunityPage } from "@/features/opportunities/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";

type Listing = { id: string; title: string; description: string; location: string; companyName: string | null };
// CV Analyzer: rules on the CV being edited (saved or not), an optional job description for a keyword comparison, and the published listings that mention the person's skills.
// Rules-based, not AI: it cannot verify claims, and it never invents listings.
export function CvAnalyzer({ content }: { content: CvContent }) {
  const { t } = useI18n();
  const [job, setJob] = useState("");
  const [result, setResult] = useState<CvAnalysis | null>(null);
  const [matches, setMatches] = useState<ListingMatch<Listing>[] | null>(null);
  const [listingCount, setListingCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [listingError, setListingError] = useState(false);

  async function analyze() {
    setBusy(true); setListingError(false); setMatches(null); setListingCount(null);
    setResult(analyzeCv(content, { jobDescription: job }));
    try {
      const page = opportunityPage.parse(await appRequest("/api/v1/opportunities?view=discover"));
      const listings: Listing[] = page.items.filter(item => item.status === "published").map(item => ({ id: item.id, title: item.fields.title, description: item.fields.description, location: item.fields.location, companyName: item.companyName }));
      setListingCount(listings.length); setMatches(matchListings(content.skills, listings));
    } catch { setListingError(true); }
    finally { setBusy(false); }
  }

  return <details className="fw-list-card oq-cv-analyzer">
    <summary>{t("cv.an.title")}</summary>
    <p>{t("cv.an.intro")}</p>
    <label className="fw-field">{t("cv.an.job")}<textarea value={job} maxLength={6000} rows={5} onChange={event => setJob(event.target.value)} /></label>
    <button type="button" className="fw-primary" disabled={busy} onClick={() => void analyze()}>{busy ? t("cv.an.working") : t("cv.an.run")}</button>
    {result && <div aria-label={t("cv.an.resultAria")} className="oq-cv-an-result">
      <p><strong>{t("cv.an.score", { score: result.score })}</strong></p>
      <ul aria-label={t("cv.an.breakdown")}>{result.sections.map(section => <li key={section.id}>{t(`cv.an.s.${section.id}` as MessageKey)}: {section.points}/{section.max}</li>)}</ul>
      <h4>{t("cv.an.findings")}</h4>
      {result.findings.length === 0 && <p>{t("cv.an.noFindings")}</p>}
      {result.findings.map(finding => <article className="fw-question-card" key={finding.id} data-severity={finding.severity}>
        <strong>{finding.title}</strong> <span>({t(`ai.sev.${finding.severity}` as MessageKey)})</span>
        <p>{finding.detail}</p><p><strong>{t("cv.an.fix")}</strong> {finding.fix}</p>
      </article>)}
      <h4>{t("cv.an.ats")}</h4>
      <ul>{result.atsNotes.map(note => <li key={note}>{note}</li>)}</ul>
      {result.keywords.provided && <section aria-label={t("cv.an.kwAria")}>
        <h4>{t("cv.an.kw")}</h4>
        <p>{result.keywords.coverage === null ? t("cv.an.kwNone") : t("cv.an.kwCoverage", { matched: result.keywords.matched.length, percent: result.keywords.coverage })}</p>
        {result.keywords.matched.length > 0 && <p>{t("cv.an.kwMatched")} {result.keywords.matched.join(", ")}</p>}
        {result.keywords.missing.length > 0 && <><p>{t("cv.an.kwMissing")} {result.keywords.missing.join(", ")}</p><p className="fw-notice">{t("cv.an.kwCaution")}</p></>}
      </section>}
      <section aria-label={t("cv.an.recAria")}>
        <h4>{t("cv.an.rec")}</h4>
        {listingError && <p role="alert">{t("cv.an.recError")}</p>}
        {!listingError && matches === null && busy && <p role="status">{t("cv.an.recLoading")}</p>}
        {matches && listingCount === 0 && <p>{t("cv.an.recNoListings")}</p>}
        {matches && (listingCount ?? 0) > 0 && matches.length === 0 && <p>{t("cv.an.recNone")}</p>}
        {matches && matches.map(({ listing, matched }) => <article className="fw-question-card" key={listing.id}>
          <strong>{listing.title}</strong>{listing.companyName ? ` · ${listing.companyName}` : ""} · {listing.location}
          <p>{t("cv.an.recWhy", { skills: matched.join(", ") })}</p>
        </article>)}
        <p><Link className="fw-secondary" href="/app/opportunities">{t("cv.an.recOpen")}</Link></p>
        <p className="fw-notice">{t("cv.an.recNote")}</p>
      </section>
      <p className="fw-notice">{t("cv.an.limits")}</p>
    </div>}
  </details>;
}
