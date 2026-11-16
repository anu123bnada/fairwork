"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { opportunityPage, type OpportunityPage } from "@/features/opportunities/schema";
import { rankListings, setFeedback, type FeedbackAction } from "@/features/opportunities/intelligence";
import { listRecordsOf, readRecordById, removeRecordById, saveRecordBody } from "@/features/records/client";
import { emptyFeedback, opportunityFeedbackContent, type CareerProfileContent, type OpportunityFeedbackContent } from "@/features/records/schema";
import "./records.css";
import "./intelligence.css";

// Opportunity Intelligence. The ONLY live source is ORYQEN's own employer listings (published by organizations on ORYQEN). Every outside platform below is shown exactly as it is:
// not connected, with the reason. Nothing is scraped, no outside account is asked for, and no outside listing is invented. Matching is rule-based and explained, not AI.
const PLATFORMS: { name: string; reason: string; docs: { label: string; url: string } | null }[] = [
  { name: "LinkedIn", reason: "Not connected. LinkedIn's documentation says its job posting and talent APIs are restricted to partners it approves, and that it was not accepting new Job Posting API partners when we checked on 16 Nov 2026. Those APIs are for employers posting jobs, not for a job seeker's own search. ORYQEN has no LinkedIn approval, so it cannot read LinkedIn listings and will not scrape them.", docs: { label: "LinkedIn API documentation (Microsoft Learn)", url: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access" } },
  { name: "Facebook", reason: "Not connected. ORYQEN has no approved Meta app, and we did not find a documented, permitted way for an app like this to read job listings through the official Graph API. We will not scrape Facebook or ask for a Facebook password.", docs: { label: "Meta Graph API documentation", url: "https://developers.facebook.com/docs/graph-api/" } },
  { name: "Instagram", reason: "Not connected. ORYQEN has no approved Meta app, and the official Instagram platform documentation we reviewed is about business accounts and content, not job listings. We will not scrape Instagram or ask for an Instagram password.", docs: { label: "Instagram Platform documentation", url: "https://developers.facebook.com/docs/instagram-platform/" } },
  { name: "Fiverr", reason: "Not connected. We could not open an official Fiverr developer site on 16 Nov 2026 and found no public API for discovering freelance projects, so nothing can be claimed. We will not scrape Fiverr.", docs: null },
];
const ACTIONS: { action: FeedbackAction; label: string }[] = [{ action: "like", label: "Like" }, { action: "save", label: "Save" }, { action: "applied", label: "Already applied" }, { action: "dislike", label: "Dislike" }, { action: "hide", label: "Hide" }, { action: "not_relevant", label: "Not relevant" }];
const ACTION_WORD: Record<FeedbackAction, string> = { like: "Liked", save: "Saved", applied: "Marked as applied", dislike: "Disliked", hide: "Hidden", not_relevant: "Marked not relevant" };

export function OpportunityIntelligence() {
  const [page, setPage] = useState<OpportunityPage | null>(null), [profile, setProfile] = useState<CareerProfileContent | null>(null);
  const [feedback, setFeedbackState] = useState<{ id: string; revision: number; content: OpportunityFeedbackContent }>({ id: "", revision: 0, content: emptyFeedback });
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState(""), [updated, setUpdated] = useState<Date | null>(null), [profileMissing, setProfileMissing] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError("");
    const [listings, profiles, feedbacks] = await Promise.allSettled([appRequest("/api/v1/opportunities?view=discover"), listRecordsOf("career_profile"), listRecordsOf("opportunity_feedback")]);
    if (listings.status === "fulfilled") { try { setPage(opportunityPage.parse(listings.value)); setUpdated(new Date()); } catch { setPage(null); setError("The listings answer was not in the expected form, so none are shown."); } }
    else { setPage(null); setError("Listings could not be loaded right now. Nothing was changed."); }
    try {
      const first = profiles.status === "fulfilled" ? profiles.value[0] : undefined;
      const doc = first ? await readRecordById(first.id) : null;
      setProfile(doc && doc.kind === "career_profile" ? doc.content : null); setProfileMissing(!first && profiles.status === "fulfilled");
      const fb = feedbacks.status === "fulfilled" ? feedbacks.value[0] : undefined;
      const fdoc = fb ? await readRecordById(fb.id) : null;
      setFeedbackState(fdoc && fdoc.kind === "opportunity_feedback" ? { id: fdoc.id, revision: fdoc.revision, content: fdoc.content } : { id: crypto.randomUUID(), revision: 0, content: emptyFeedback });
    } catch { /* profile and feedback are optional; listings still show */ }
    setBusy(false);
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const ranked = useMemo(() => page ? rankListings(page.items, profile, page.preferences, feedback.content) : null, [page, profile, feedback.content]);

  async function react(listingId: string, action: FeedbackAction | null) {
    const next = setFeedback(feedback.content, listingId, action, new Date().toISOString());
    const id = feedback.id || crypto.randomUUID();
    setBusy(true); setError(""); setNotice("");
    try {
      const parsed = opportunityFeedbackContent.parse(next);
      const result = await saveRecordBody({ id, kind: "opportunity_feedback", title: "My opportunity feedback", status: "active", content: parsed, expectedRevision: feedback.revision });
      setFeedbackState({ id, revision: result.revision, content: parsed }); setNotice(action ? "Saved. Future ordering will use this." : "Your choice was removed.");
    } catch { setError("Your feedback could not be stored right now, so ordering did not change. This can happen on a server that has not yet been updated for this feature."); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!feedback.revision || !window.confirm("Delete all your feedback on opportunities? Ordering goes back to matching only.")) return;
    setBusy(true); setError("");
    try { await removeRecordById(feedback.id); setFeedbackState({ id: crypto.randomUUID(), revision: 0, content: emptyFeedback }); setNotice("Your recommendation preferences were reset and the stored feedback was deleted."); }
    catch { setError("Your feedback could not be deleted. Try again."); } finally { setBusy(false); }
  }
  const tally = feedback.content.entries.reduce<Record<string, number>>((sum, entry) => ({ ...sum, [entry.action]: (sum[entry.action] ?? 0) + 1 }), {});

  return <section className="oq-ci" aria-label="Opportunity intelligence">
    <div className="oq-ci-card oq-ci-hero">
      <h2>Opportunities matched to you</h2>
      <p>Real listings published on ORYQEN, ordered by how many of your own criteria they meet, with the reasons shown. Outside platforms are listed honestly below: none is connected.</p>
      <p className="oq-ci-note">Rules-based matching. No AI model was used. A listing that fits is not a promise of a job or of eligibility.</p>
    </div>
    {busy && <p role="status">Loading…</p>}{error && <p role="alert">{error}</p>}{notice && !error && <p role="status">{notice}</p>}
    {profileMissing && <div className="oq-ci-card"><p>You have no career profile yet, so listings can only be compared with your job preferences. <Link className="oq-ci-link" href="/app/career-intelligence">Create your career profile</Link> for goal and skill matching.</p></div>}

    <div className="oq-ci-card" aria-label="Connection center">
      <h3>Connection center</h3>
      <div className="oq-ci-row">
        <header><strong>ORYQEN employer listings</strong><span className="oq-ci-pill-ok">Connected (built in)</span></header>
        <p className="oq-ci-note">Source: listings that approved organizations publish on ORYQEN. Permissions: reads published listings and your own job preferences; no outside account is involved. {page ? `${page.items.length} listing${page.items.length === 1 ? "" : "s"} loaded` : "Not loaded"}{updated ? `, last refreshed ${updated.toLocaleTimeString()}` : ""}.</p>
        <p className="oq-ci-note">Refresh: manual only. Scheduled hourly or daily refresh is not available yet and nothing is scheduled, so there is no next refresh time.</p>
        <div className="oq-ci-actions"><button className="fw-secondary" disabled={busy} onClick={() => void load()}>Refresh now</button></div>
      </div>
      {PLATFORMS.map(platform => <div className="oq-ci-row" key={platform.name}>
        <header><strong>{platform.name}</strong><span className="oq-ci-pill-warn">Not connected</span></header>
        <p className="oq-ci-note">{platform.reason}</p>
        <p className="oq-ci-note">A future integration would use only official, approved sign-in (OAuth) with your consent, would show its permissions, and could be disconnected, with imported data deleted on request. Passwords are never asked for.</p>
        <div className="oq-ci-actions">{platform.docs && <a className="oq-ci-link" href={platform.docs.url} target="_blank" rel="noopener noreferrer">{platform.docs.label}</a>}<button className="fw-secondary" disabled aria-disabled="true">Connect (not available)</button></div>
      </div>)}
    </div>

    <div className="oq-ci-card" aria-label="Your recommendation preferences">
      <h3>Your recommendation preferences</h3>
      <p className="oq-ci-note">Ordering uses your career profile, your job preferences and your feedback below, and nothing from social media. You can inspect and reset it.</p>
      <p>{feedback.content.entries.length === 0 ? "No feedback stored yet." : Object.entries(tally).map(([action, count]) => `${ACTION_WORD[action as FeedbackAction]}: ${count}`).join(" · ")}</p>
      <div className="oq-ci-actions"><button className="fw-secondary" disabled={busy || feedback.revision === 0} onClick={() => void reset()}>Reset my feedback</button><Link className="fw-secondary oq-ci-link" href="/app/opportunities">Edit job preferences</Link><Link className="fw-secondary oq-ci-link" href="/app/applications">Application status</Link></div>
    </div>

    <div className="oq-ci-card" aria-label="Recommended listings">
      <h3>Recommended for you</h3>
      {ranked && ranked.shown.length === 0 && !busy && <p>No published listings match right now{ranked.hidden.length ? "; some are hidden by your feedback below" : ""}. Nothing is invented to fill this list.</p>}
      <ul className="oq-ci-list">{ranked?.shown.map(({ item, match, feedback: current }) => <li className="oq-ci-row" key={item.id}>
        <header><h4>{item.fields.title}</h4>{current && <span className="oq-ci-label">{ACTION_WORD[current]}</span>}</header>
        <p>{item.companyName ?? "Organization not shown"} · {item.fields.location} · {item.fields.workMode} · {item.fields.salary === null ? "pay not stated" : `${item.fields.salary} ${item.fields.currency} / ${item.fields.payPeriod}`}</p>
        <p className="oq-ci-note">Source: ORYQEN employer listing, submitted by an organization representative; the organization's identity is demonstration-provisioned and not independently verified. Last updated {new Date(item.updatedAt).toLocaleDateString()} · closes {new Date(item.expiresAt).toLocaleDateString()}. Claims in the listing are the employer's own and are not verified by ORYQEN.</p>
        <p>{match.why}</p>
        {match.matchingSkills.length > 0 && <p><strong>Matching skills:</strong> {match.matchingSkills.join(", ")}</p>}
        {match.missingRequirements.length > 0 && <p><strong>Missing requirements:</strong> {match.missingRequirements.join(", ")}</p>}
        {match.eligibilityConcerns.map(concern => <p key={concern} className="oq-ci-pill-warn">{concern}</p>)}
        <ul className="oq-ci-list" aria-label="How this listing was compared">{match.criteria.map(criterion => <li key={criterion.id}><strong>{criterion.label}: {criterion.outcome === "met" ? "met" : criterion.outcome === "not_met" ? "not met" : "cannot tell"}</strong>. <span className="oq-ci-note">{criterion.detail}</span></li>)}</ul>
        <div className="oq-ci-actions" role="group" aria-label={`Feedback on ${item.fields.title}`}>
          {ACTIONS.map(({ action, label }) => <button key={action} className="fw-secondary" aria-pressed={current === action} disabled={busy} onClick={() => void react(item.id, current === action ? null : action)}>{label}</button>)}
          <Link className="fw-primary oq-ci-link" href="/app/opportunities">Open listing and apply</Link>
        </div>
      </li>)}</ul>
      {page?.nextCursor && <p className="oq-ci-note">More listings exist. Open Job opportunities to browse all of them.</p>}
      {ranked && ranked.hidden.length > 0 && <details><summary>{ranked.hidden.length} hidden by your feedback</summary><ul className="oq-ci-list">{ranked.hidden.map(({ item, feedback: current }) => <li className="oq-ci-row" key={item.id}><strong>{item.fields.title}</strong> · {current ? ACTION_WORD[current] : ""}<div className="oq-ci-actions"><button className="fw-secondary" disabled={busy} onClick={() => void react(item.id, null)}>Show again</button></div></li>)}</ul></details>}
    </div>
  </section>;
}
