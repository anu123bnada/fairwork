"use client";
import { useState } from "react";
import { checkJurisdiction } from "@/features/jurisdiction/check";
import { SELECTABLE_COUNTRIES } from "@/features/jurisdiction/references";

const KIND: Record<string, string> = { within: "Within the rule", exceeds: "Above the rule", needs_info: "Needs more information", info: "Note" };

// Country-aware reference check. It shows cited rules only where ORYQEN has verified a primary
// source, and says so plainly everywhere else. It never states that an employer broke the law.
export function JurisdictionCheck({ hoursPerWeek }: { hoursPerWeek?: unknown }) {
  const parsed = typeof hoursPerWeek === "number" || typeof hoursPerWeek === "string" ? Number(hoursPerWeek) : NaN;
  const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const [country, setCountry] = useState("DE"), [days, setDays] = useState("");
  const dayCount = /^[1-7]$/.test(days) ? Number(days) : null;
  const result = checkJurisdiction({ country, hoursPerWeek: hours, daysPerWeek: dayCount }, new Date());
  return <section aria-label="Country employment references">
    <h4>Country employment references</h4>
    <p>Compare this offer with cited public rules for one country. References are shown only where ORYQEN has checked a primary source. This is information for your own review, not legal advice, and it never concludes that an employer broke the law.</p>
    <label className="fw-field">Country<select value={country} onChange={event => setCountry(event.target.value)}>{SELECTABLE_COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <label className="fw-field">Working days per week (from the offer)<input inputMode="numeric" maxLength={1} value={days} onChange={event => setDays(event.target.value.replace(/[^1-7]/g, ""))} /></label>
    <p>Weekly hours in this offer: {hours === null ? "not stated" : hours}.</p>
    {result.support === "source_unavailable"
      ? <div role="note"><p><strong>No verified rules for {result.name} yet.</strong> {result.reason}</p>
        {result.whereToCheck.length > 0 && <ul>{result.whereToCheck.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a></li>)}</ul>}</div>
      : <>
        {result.stale && <p role="alert">These references were last checked more than 180 days ago. Re-check them against the source before relying on them.</p>}
        <ul>{result.findings.map(f => <li key={f.id}><strong>{KIND[f.kind]}:</strong> {f.title}. {f.detail}
          {f.rule && <details><summary>Source: {f.rule.sourceTitle}</summary>
            <p>{f.rule.publisher}. Retrieved {f.rule.retrievedOn}. {f.rule.sourceDate ? `Source date ${f.rule.sourceDate}.` : "The source shows no date."} Status: {f.rule.sourceStatus === "unofficial_consolidation" ? "unofficial consolidated text" : "official text"}. {f.rule.validity.note}</p>
            <p>Applies to: {f.rule.scope}</p>
            <blockquote lang={f.rule.quoteLanguage}>{f.rule.quote}</blockquote>
            <p><a href={f.rule.sourceUrl} target="_blank" rel="noopener noreferrer">Open the source</a></p></details>}</li>)}</ul>
        <details><summary>What this check does not cover</summary><ul>{result.limitations.map(text => <li key={text}>{text}</li>)}</ul></details>
      </>}
  </section>;
}
