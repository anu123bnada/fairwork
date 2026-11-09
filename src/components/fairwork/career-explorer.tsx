"use client";
import { useEffect, useMemo, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { cvDocument, cvList } from "@/features/cv/schema";
import { allSampleSkills, computeGap, exploreCareers } from "@/features/careers/gap";
import { sampleCareers } from "@/features/careers/sample-data";
import { CareerRoadmaps } from "./career-roadmap";
import { useI18n } from "@/i18n/use-i18n";
import "./records.css";

const firstId = sampleCareers[0]?.id ?? "welder";
const storageKey = "oryqen.career-skills.v1";
const readStored = (): { skills: string[]; careerId: string } => {
  try { const raw = JSON.parse(window.localStorage.getItem(storageKey) ?? "null"); if (raw && Array.isArray(raw.skills)) return { skills: raw.skills.filter((item: unknown): item is string => typeof item === "string").slice(0, 60), careerId: typeof raw.careerId === "string" ? raw.careerId : firstId }; } catch { /* storage unavailable */ }
  return { skills: [], careerId: firstId };
};

// Career Path Explorer and Skill Gap. The framework is a SYNTHETIC SAMPLE (labelled everywhere) and the person's skills are self-reported; nothing here is verified or real labour-market data.
export function CareerExplorer() {
  const { t } = useI18n();
  const [skills, setSkills] = useState<string[]>([]), [careerId, setCareerId] = useState(firstId), [typed, setTyped] = useState(""), [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => { await Promise.resolve(); if (!live) return; const stored = readStored(); setSkills(stored.skills); setCareerId(stored.careerId); setReady(true); })();
    return () => { live = false; };
  }, []);
  useEffect(() => { if (!ready) return; try { window.localStorage.setItem(storageKey, JSON.stringify({ skills, careerId })); } catch { /* storage unavailable: the page still works for this visit */ } }, [skills, careerId, ready]);

  const gap = useMemo(() => computeGap(careerId, skills), [careerId, skills]);
  const ranked = useMemo(() => exploreCareers(skills).slice(0, 4), [skills]);
  const toggle = (name: string) => setSkills(current => current.some(item => item.toLowerCase() === name.toLowerCase()) ? current.filter(item => item.toLowerCase() !== name.toLowerCase()) : [...current, name].slice(0, 60));
  const has = (name: string) => skills.some(item => item.toLowerCase() === name.toLowerCase());
  async function importFromCv() {
    setMessage("");
    try {
      const list = cvList.parse(await appRequest("/api/v1/cv")).items;
      if (list.length === 0) { setMessage(t("cx.noCv")); return; }
      const doc = cvDocument.parse(await appRequest(`/api/v1/cv?id=${list[0]?.id ?? ""}`));
      const incoming = doc.content.skills.map(item => item.trim()).filter(Boolean);
      setSkills(current => [...new Set([...current, ...incoming])].slice(0, 60));
      setMessage(t("cx.imported", { count: incoming.length }));
    } catch { setMessage(t("cx.importError")); }
  }
  return <section className="oq-rec" aria-label={t("cx.aria")}>
    <p className="fw-notice" role="note"><strong>{t("cx.sampleLabel")}</strong> {t("cx.sampleBody")}</p>
    <p>{t("cx.intro")}</p>
    <fieldset className="oq-rec-group"><legend>{t("cx.mySkills")}</legend>
      <div className="oq-rec-chips">{allSampleSkills().map(name => <button key={name} type="button" className="fw-secondary" aria-pressed={has(name)} onClick={() => toggle(name)}>{name}</button>)}</div>
      <label className="fw-field">{t("cx.addSkill")}<input maxLength={60} value={typed} onChange={e => setTyped(e.target.value)} /></label>
      <button type="button" className="fw-secondary" disabled={!typed.trim() || skills.length >= 60} onClick={() => { const value = typed.trim(); setSkills(current => current.some(item => item.toLowerCase() === value.toLowerCase()) ? current : [...current, value]); setTyped(""); }}>{t("cx.addSkillButton")}</button>
      <button type="button" className="fw-secondary" onClick={() => void importFromCv()}>{t("cx.importCv")}</button>
      {message && <p role="status">{message}</p>}
      <p>{skills.length === 0 ? t("cx.noSkills") : t("cx.skillCount", { count: skills.length })}</p>
      <p className="fw-notice">{t("cx.deviceOnly")}</p>
    </fieldset>
    <h3>{t("cx.explore")}</h3>
    <ul className="oq-rec-list" aria-label={t("cx.exploreAria")}>{ranked.map(item => <li key={item.career.id}><strong>{item.career.title}</strong> · {t("cx.coverage", { percent: item.coreCoveragePercent })} <button type="button" className="fw-secondary" onClick={() => setCareerId(item.career.id)}>{t("cx.choose")}</button></li>)}</ul>
    <label className="fw-field">{t("cx.target")}<select value={careerId} onChange={e => setCareerId(e.target.value)}>{sampleCareers.map(career => <option key={career.id} value={career.id}>{career.title}</option>)}</select></label>
    {gap && <div aria-label={t("cx.gapAria")}>
      <h3>{gap.career.title}</h3><p>{gap.career.summary}</p>
      <p aria-live="polite"><strong>{t("cx.coverage", { percent: gap.coreCoveragePercent })}</strong> <progress max={100} value={gap.coreCoveragePercent} aria-label={t("cx.coverageAria")} /></p>
      <p>{t("cx.have")}: {gap.have.length ? gap.have.join(", ") : t("cx.none")}</p>
      <p>{t("cx.missingCore")}: {gap.missingCore.length ? gap.missingCore.join(", ") : t("cx.none")}</p>
      <p>{t("cx.missingHelpful")}: {gap.missingHelpful.length ? gap.missingHelpful.join(", ") : t("cx.none")}</p>
      <h4>{t("cx.roadmap")}</h4>
      {gap.roadmap.length === 0 ? <p>{t("cx.roadmapDone")}</p> : <ol aria-label={t("cx.roadmapAria")}>{gap.roadmap.map(step => <li key={step.skill}><strong>{step.skill}</strong> ({step.weight === "core" ? t("cx.core") : t("cx.helpful")}): {step.step}</li>)}</ol>}
      {gap.nextRoles.length > 0 && <p>{t("cx.nextRoles")}: {gap.nextRoles.map(role => role.title).join(", ")}</p>}
    </div>}
    {gap && <CareerRoadmaps careerId={gap.career.id} careerTitle={gap.career.title} steps={gap.roadmap.map(step => ({ skill: step.skill, step: step.step }))} />}
    <p className="fw-notice">{t("cx.notice")}</p>
  </section>;
}
