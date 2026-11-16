"use client";
import { useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "@/features/authority/client";
import { listRecordsOf, readRecordById, removeRecordById, saveRecordBody } from "@/features/records/client";
import { careerProfileContent, educationLevels, emptyCareerProfile, evidenceLevels, learningFormats, type CareerProfileContent } from "@/features/records/schema";
import { analyzeCareer, NOT_A_QUALIFICATION, progressSummary, setProgress, STANDING_LABEL, type Analysis, type Resource, type SkillItem } from "@/features/careers/analyzer";
import { FRAMEWORK_LABEL, referenceCareers } from "@/features/careers/reference";
import "./records.css";
import "./intelligence.css";

type Draft = { id: string; revision: number; profile: CareerProfileContent };
const EVIDENCE_TEXT: Record<(typeof evidenceLevels)[number], string> = { self_reported: "Self-reported, no proof", demonstrated: "I have used it in real work or a project", evidence_attached: "I hold proof (link or document) and describe it" };
const today = () => new Date().toISOString().slice(0, 10);
const TITLE = "My career profile";

// Career goal profile + gap analysis + free learning path. The profile is a private record kept in the person's own account (the existing personal-records service); the analysis is
// recomputed from it on every change by fixed rules. Nothing on this screen is AI-generated, and nothing is independently verified.
export function CareerIntelligence() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [skillName, setSkillName] = useState(""), [qualName, setQualName] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const items = await listRecordsOf("career_profile");
        if (!live) return;
        if (items[0]) {
          const doc = await readRecordById(items[0].id);
          if (live && doc.kind === "career_profile") setDraft({ id: doc.id, revision: doc.revision, profile: doc.content });
        } else setDraft({ id: crypto.randomUUID(), revision: 0, profile: emptyCareerProfile });
      } catch {
        // Show an empty form so the analysis still works, and say plainly that nothing can be loaded or stored. Saving as revision 0 can never overwrite an existing profile.
        if (live) { setDraft({ id: crypto.randomUUID(), revision: 0, profile: emptyCareerProfile }); setError("Your saved profile could not be loaded, so you are starting from an empty one. The analysis works, but changes may not be stored: this can happen on a server that has not yet been updated for this feature."); }
      }
      finally { if (live) setBusy(false); }
    })();
    return () => { live = false; };
  }, []);

  const analysis: Analysis | null = useMemo(() => draft ? analyzeCareer(draft.profile) : null, [draft]);
  const change = (patch: Partial<CareerProfileContent>) => setDraft(current => current ? { ...current, profile: { ...current.profile, ...patch } } : current);

  async function persist(next: Draft, message = "Saved to your private account.") {
    setBusy(true); setError(""); setNotice("");
    const parsed = careerProfileContent.safeParse(next.profile);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the fields and try again."); setBusy(false); return; }
    try {
      const result = await saveRecordBody({ id: next.id, kind: "career_profile", title: TITLE, status: "active", content: parsed.data, expectedRevision: next.revision });
      setDraft({ ...next, revision: result.revision }); setNotice(message);
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.code === "VERSION_CONFLICT" ? "This profile changed in another window. Reload the page to see the latest version; your edits here were not saved."
        : caught instanceof ApiRequestError && caught.code === "VALIDATION_FAILED" ? "This could not be stored. Check that the fields are filled in correctly; if they are, the server may not yet support saving this profile."
        : "Saving is not available right now, so this change was not stored. This can happen on a server that has not yet been updated for this feature.");
    } finally { setBusy(false); }
  }
  async function remove() {
    if (!draft || draft.revision === 0 || !window.confirm("Delete your career profile and learning progress? This cannot be undone.")) return;
    setBusy(true); setError("");
    try { await removeRecordById(draft.id); setDraft({ id: crypto.randomUUID(), revision: 0, profile: emptyCareerProfile }); setNotice("Your career profile was deleted."); }
    catch { setError("The profile could not be deleted. Try again."); } finally { setBusy(false); }
  }
  const mark = (resourceId: string, status: "not_started" | "started" | "completed", evidenceLink = "") => {
    if (!draft) return;
    void persist({ ...draft, profile: setProgress(draft.profile, resourceId, status, today(), evidenceLink) }, status === "completed" ? "Marked complete. Your gaps were recalculated." : "Progress saved. Your gaps were recalculated.");
  };

  if (!draft || !analysis) return <section className="oq-ci" aria-label="Career gap analyzer">{busy && <p role="status">Loading your career profile…</p>}{error && <p role="alert">{error}</p>}</section>;
  const p = draft.profile, progress = progressSummary(p);
  const goalValue = p.primaryGoal.careerId || (p.primaryGoal.title ? "custom" : "");
  const addSkill = () => { const name = skillName.trim(); if (!name || p.skills.some(item => item.name.toLowerCase() === name.toLowerCase())) return; change({ skills: [...p.skills, { id: crypto.randomUUID(), name: name.slice(0, 60), kind: "technical", evidence: "self_reported", note: "" }] }); setSkillName(""); };
  const addQual = () => { const name = qualName.trim(); if (!name) return; change({ qualifications: [...p.qualifications, { id: crypto.randomUUID(), name: name.slice(0, 120), kind: "certification", evidence: "self_reported", note: "" }] }); setQualName(""); };

  return <section className="oq-ci" aria-label="Career gap analyzer">
    <div className="oq-ci-card oq-ci-hero">
      <h2>{p.primaryGoal.title ? `Your goal: ${p.primaryGoal.title}` : "Choose your career goal"}</h2>
      <p>{analysis.framework === "none" ? "Tell us your goal and what you already have. We compare it with what the role usually asks for and build a free learning path for the gaps." : summary(analysis)}</p>
      <p className="oq-ci-note">Rules-based explanation. No AI model was used and nothing here is a prediction of hiring or eligibility.</p>
    </div>
    {busy && <p role="status">Working…</p>}{error && <p role="alert">{error}</p>}{notice && !error && <p role="status">{notice}</p>}

    <div className="oq-ci-card">
      <h3>1. Your goal and learning preferences</h3>
      <label className="fw-field">Primary career goal
        <select value={goalValue} onChange={event => { const value = event.target.value; const career = referenceCareers.find(item => item.id === value); change({ primaryGoal: career ? { careerId: career.id, title: career.title } : { careerId: "", title: value === "custom" ? p.primaryGoal.title : "" } }); }}>
          <option value="">Choose a goal</option>
          {referenceCareers.map(career => <option key={career.id} value={career.id}>{career.title}</option>)}
          <option value="custom">Something else (my own goal)</option>
        </select></label>
      {goalValue === "custom" && <>
        <label className="fw-field">Your goal<input maxLength={120} value={p.primaryGoal.title} onChange={event => change({ primaryGoal: { careerId: "", title: event.target.value } })} /></label>
        <label className="fw-field">Requirements you know this goal needs (one per line)<textarea rows={4} value={p.customRequirements.join("\n")} onChange={event => change({ customRequirements: event.target.value.split("\n").map(line => line.trim().slice(0, 60)).filter(Boolean).slice(0, 30) })} /></label>
        <p className="oq-ci-note">ORYQEN has no reference framework for this goal, so it compares your profile only with the requirements you list here. They are not checked against what employers ask for.</p></>}
      {[0, 1, 2].slice(0, Math.min(3, p.altGoals.length + 1)).map(index => <label className="fw-field" key={index}>{`Alternative goal ${index + 1} (optional)`}<input maxLength={120} value={p.altGoals[index]?.title ?? ""} onChange={event => { const goals = [...p.altGoals]; const value = event.target.value; if (value) goals[index] = { careerId: "", title: value }; else goals.splice(index, 1); change({ altGoals: goals }); }} /></label>)}
      <label className="fw-field">Current education level<select value={p.educationLevel} onChange={event => change({ educationLevel: event.target.value as CareerProfileContent["educationLevel"] })}>{educationLevels.map(level => <option key={level} value={level}>{level === "none" ? "No formal education yet" : level[0]!.toUpperCase() + level.slice(1)}</option>)}</select></label>
      <div className="oq-ci-grid">
        <label className="fw-field">Preferred learning language<input maxLength={40} value={p.learning.language} onChange={event => change({ learning: { ...p.learning, language: event.target.value } })} /></label>
        <label className="fw-field">Preferred format<select value={p.learning.format} onChange={event => change({ learning: { ...p.learning, format: event.target.value as CareerProfileContent["learning"]["format"] } })}>{learningFormats.map(format => <option key={format} value={format}>{format === "any" ? "No preference" : format[0]!.toUpperCase() + format.slice(1)}</option>)}</select></label>
        <label className="fw-field">Learning time per week (hours)<input type="number" min={0} max={80} value={p.learning.hoursPerWeek} onChange={event => change({ learning: { ...p.learning, hoursPerWeek: Math.max(0, Math.min(80, Math.round(Number(event.target.value) || 0))) } })} /></label>
      </div>
    </div>

    <div className="oq-ci-card">
      <h3>2. What you have</h3>
      <p className="oq-ci-note">Only you can say what you have. ORYQEN does not verify any of it, so entries are never shown as verified. Add proof details to be clear about how strong each claim is.</p>
      <h4>Skills</h4>
      <div className="oq-ci-actions"><input aria-label="Add a skill" placeholder="For example HTML" maxLength={60} value={skillName} onChange={event => setSkillName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addSkill(); } }} /><button className="fw-secondary" onClick={addSkill} disabled={!skillName.trim()}>Add skill</button></div>
      <ul className="oq-ci-list">{p.skills.map(item => <li className="oq-ci-row" key={item.id}>
        <header><strong>{item.name}</strong><button className="fw-secondary" onClick={() => change({ skills: p.skills.filter(other => other.id !== item.id) })} aria-label={`Remove ${item.name}`}>Remove</button></header>
        <label className="fw-field">How sure can you show it<select value={item.evidence} onChange={event => change({ skills: p.skills.map(other => other.id === item.id ? { ...other, evidence: event.target.value as typeof item.evidence } : other) })}>{evidenceLevels.map(level => <option key={level} value={level}>{EVIDENCE_TEXT[level]}</option>)}</select></label>
        {item.evidence !== "self_reported" && <label className="fw-field">{item.evidence === "demonstrated" ? "Where you used it" : "Link or description of your proof"}<input maxLength={300} value={item.note} onChange={event => change({ skills: p.skills.map(other => other.id === item.id ? { ...other, note: event.target.value } : other) })} /></label>}
      </li>)}</ul>
      <h4>Qualifications and certificates</h4>
      <div className="oq-ci-actions"><input aria-label="Add a qualification" placeholder="For example Workplace safety training certificate" maxLength={120} value={qualName} onChange={event => setQualName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addQual(); } }} /><button className="fw-secondary" onClick={addQual} disabled={!qualName.trim()}>Add qualification</button></div>
      <ul className="oq-ci-list">{p.qualifications.map(item => <li className="oq-ci-row" key={item.id}>
        <header><strong>{item.name}</strong><button className="fw-secondary" onClick={() => change({ qualifications: p.qualifications.filter(other => other.id !== item.id) })} aria-label={`Remove ${item.name}`}>Remove</button></header>
        <label className="fw-field">Type<select value={item.kind} onChange={event => change({ qualifications: p.qualifications.map(other => other.id === item.id ? { ...other, kind: event.target.value as typeof item.kind } : other) })}><option value="academic">Academic</option><option value="professional">Professional</option><option value="certification">Certification</option></select></label>
        <label className="fw-field">Evidence<select value={item.evidence === "evidence_attached" ? "evidence_attached" : "self_reported"} onChange={event => change({ qualifications: p.qualifications.map(other => other.id === item.id ? { ...other, evidence: event.target.value as typeof item.evidence } : other) })}><option value="self_reported">Self-reported, no proof</option><option value="evidence_attached">I hold the certificate (describe it below)</option></select></label>
        {item.evidence === "evidence_attached" && <label className="fw-field">Where the proof is kept<input maxLength={300} value={item.note} onChange={event => change({ qualifications: p.qualifications.map(other => other.id === item.id ? { ...other, note: event.target.value } : other) })} /></label>}
      </li>)}</ul>
      <label className="fw-field">Work experience<textarea rows={3} maxLength={2000} value={p.experience} onChange={event => change({ experience: event.target.value })} /></label>
      <label className="fw-field">Projects and practical experience<textarea rows={3} maxLength={2000} value={p.projects} onChange={event => change({ projects: event.target.value })} /></label>
      <div className="oq-ci-actions"><button className="fw-primary" disabled={busy} onClick={() => void persist(draft)}>Save profile</button>{draft.revision > 0 && <button className="fw-secondary" disabled={busy} onClick={() => void remove()}>Delete my profile</button>}</div>
      <p className="oq-ci-note">Stored privately in your own account for one purpose: this analysis. Only you can read it.</p>
    </div>

    <Results analysis={analysis} progress={progress} mark={mark} busy={busy} />
  </section>;
}

function summary(analysis: Analysis) {
  const c = analysis.counts;
  if (c.essentialTotal === 0) return "You listed your own requirements. Here is how your profile compares with them.";
  return `Your profile covers ${c.essentialAddressed} of ${c.essentialTotal} essential skills for this role in what you have told us (none of it independently verified). ${c.essentialGaps === 0 ? "No essential skill gaps remain." : `${c.essentialGaps} essential ${c.essentialGaps === 1 ? "gap is" : "gaps are"} still open.`}`;
}

function Results({ analysis, progress, mark, busy }: { analysis: Analysis; progress: { started: number; completed: number }; mark: (id: string, status: "not_started" | "started" | "completed", evidenceLink?: string) => void; busy: boolean }) {
  if (analysis.framework === "none") return <div className="oq-ci-card"><h3>3. Your gap analysis</h3><p>Choose a goal above to see what you have, what is missing and a free learning path.</p></div>;
  const c = analysis.counts, total = Math.max(1, c.essentialTotal);
  return <>
    <div className="oq-ci-card" aria-label="Gap analysis">
      <h3>3. Your gap analysis</h3>
      <p>Your current profile matches the requirements marked below. These are the gaps between your profile and your selected target. The learning path in step 4 is a practical way to work on them.</p>
      <div className="oq-ci-stats">
        <div className="oq-ci-stat"><span>Essential skills covered</span><strong>{c.essentialAddressed} / {c.essentialTotal}</strong></div>
        <div className="oq-ci-stat"><span>Essential gaps</span><strong>{c.essentialGaps}</strong></div>
        <div className="oq-ci-stat"><span>Helpful gaps</span><strong>{c.helpfulGaps}</strong></div>
        <div className="oq-ci-stat"><span>Qualification gaps</span><strong>{c.qualificationGaps}</strong></div>
      </div>
      <div className="oq-ci-bar" role="img" aria-label={`${c.essentialAddressed} of ${c.essentialTotal} essential skills covered by your own entries`}><span style={{ width: `${(100 * c.essentialAddressed) / total}%` }} /></div>
      <p className="oq-ci-note">This is a count of your own entries against a list, not a readiness score. It says nothing about your ability or about hiring. Reference: {analysis.career ? FRAMEWORK_LABEL : "requirements you listed yourself"}.</p>
      <ul className="oq-ci-list">{analysis.skills.map(skill => <li className="oq-ci-row" key={skill.name}>
        <header><strong>{skill.name}</strong><span className={skill.standing === "missing" || skill.standing === "learning" ? "oq-ci-pill-gap" : "oq-ci-pill-ok"}>{STANDING_LABEL[skill.standing]}</span></header>
        <p className="oq-ci-note">{skill.importance === "essential" ? "Essential" : skill.importance === "helpful" ? "Helpful" : "Listed by you"}. {skill.why}</p>
      </li>)}</ul>
      {analysis.qualifications.length > 0 && <><h4>Qualifications for this role</h4><ul className="oq-ci-list">{analysis.qualifications.map(item => <li className="oq-ci-row" key={item.name}>
        <header><strong>{item.name}</strong><span className={item.standing === "missing" ? "oq-ci-pill-gap" : "oq-ci-pill-warn"}>{item.standing === "missing" ? "Not in your profile" : item.standing === "evidence_attached" ? "Proof described by you, not checked by ORYQEN" : "Self-reported, not verified"}</span></header>
        <p className="oq-ci-note">{item.importance === "essential" ? "Usually expected" : "Helpful"}{item.regulated ? " · regulated" : ""}. {item.why}</p>
      </li>)}</ul></>}
      <p className="oq-ci-note">{NOT_A_QUALIFICATION}</p>
    </div>

    <div className="oq-ci-card" aria-label="Learning roadmap">
      <h3>4. Your free learning path</h3>
      {analysis.languageNote && <p className="oq-ci-note">{analysis.languageNote}</p>}
      <p className="oq-ci-note">{progress.completed} resource{progress.completed === 1 ? "" : "s"} marked complete, {progress.started} in progress. Marking a resource complete is your own record: gaps are recalculated, but a finished course is never shown as verified.</p>
      {analysis.roadmap.length === 0 ? <p>No open skill gaps remain in what you have told us. Add proof of your skills in your Portfolio, and read the qualification notes above.</p>
        : <ol className="oq-ci-list">{analysis.roadmap.map((skill, index) => <li key={skill.name}><RoadmapItem index={index + 1} skill={skill} mark={mark} busy={busy} /></li>)}</ol>}
    </div>
  </>;
}

function RoadmapItem({ index, skill, mark, busy }: { index: number; skill: SkillItem; mark: (id: string, status: "not_started" | "started" | "completed", link?: string) => void; busy: boolean }) {
  return <article className="oq-ci-row">
    <header><h4>{index}. {skill.name}</h4><span className="oq-ci-pill-gap">{skill.importance === "essential" ? "Essential" : skill.importance === "helpful" ? "Helpful" : "Listed by you"}</span></header>
    <p className="oq-ci-note">Why it matters: {skill.why}</p>
    {skill.noVerifiedCourse && <p className="oq-ci-note">No verified free course for this skill is in ORYQEN's catalog yet, so none is suggested. Ask a training provider or someone working in the role, or a recognised local training authority.</p>}
    {skill.resources.map(resource => <Course key={resource.course.id} resource={resource} skill={skill.name} mark={mark} busy={busy} />)}
  </article>;
}

function Course({ resource, skill, mark, busy }: { resource: Resource; skill: string; mark: (id: string, status: "not_started" | "started" | "completed", link?: string) => void; busy: boolean }) {
  const { course, status } = resource;
  const [link, setLink] = useState(resource.evidenceLink);
  return <div className="oq-ci-row" aria-label={course.title}>
    <header><strong>{course.title}</strong><span className="oq-ci-label">{status === "completed" ? "Completed" : status === "started" ? "In progress" : "Not started"}</span></header>
    <p>{course.provider} · {course.format} · free to access</p>
    <p className="oq-ci-note">Certificate: {course.certificate === "none" ? "none offered" : "not confirmed by ORYQEN; check the provider before assuming it is free"}. {course.cost}</p>
    <p className="oq-ci-note">Covers: {course.skills.join(", ")}. Addresses your gap: {skill}. Duration: {course.duration ?? "not stated by the provider"}. Recommended because it covers {skill}{resource.fitsFormat ? "" : ", although it is not in your preferred format"}.</p>
    <p className="oq-ci-note">Link checked {course.verifiedOn}{course.verification === "address-resolves" ? " (address opens; the page loads its title in the browser)" : ""}.</p>
    <div className="oq-ci-actions">
      <a className="fw-secondary oq-ci-link" href={course.url} target="_blank" rel="noopener noreferrer">Open course (new tab)</a>
      {status === "not_started" && <button className="fw-secondary" disabled={busy} onClick={() => mark(course.id, "started")}>Mark as started</button>}
      {status !== "completed" && <button className="fw-primary" disabled={busy} onClick={() => mark(course.id, "completed", link)}>Mark as completed</button>}
      {status !== "not_started" && <button className="fw-secondary" disabled={busy} onClick={() => mark(course.id, "not_started")}>Reset</button>}
    </div>
    {status !== "not_started" && <label className="fw-field">Link to your certificate or work (optional, https only)<input type="url" maxLength={300} value={link} onChange={event => setLink(event.target.value)} onBlur={() => { if (link !== resource.evidenceLink && /^(https:\/\/\S+)?$/.test(link)) mark(course.id, status, link); }} /></label>}
  </div>;
}
