"use client";
import { useEffect, useState } from "react";
import { ApiRequestError, appRequest } from "@/features/authority/client";
import { collectPrivatePassportExport } from "@/features/work/passport-export";
import { cvDocument, cvList, cvSaved, cvTemplates, emptyCv, cvDocumentLimit, type CvContent, type CvSummary } from "@/features/cv/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import { CvAnalyzer } from "./cv-analyzer";
import "./cv-builder.css";

type Draft = { id: string; title: string; template: (typeof cvTemplates)[number]; targetRole: string; content: CvContent; revision: number };
type Verified = Awaited<ReturnType<typeof collectPrivatePassportExport>>["records"];
const blank = (name: string): Draft => ({ id: crypto.randomUUID(), title: "", template: "classic", targetRole: "", content: { ...emptyCv, basics: { ...emptyCv.basics, fullName: name } }, revision: 0 });

// A CV the person writes and keeps privately. Everything typed here is self-reported. Verified employment is read live from the Work Passport when shown, never stored.
export function CvBuilder({ displayName }: { displayName: string }) {
  const { t } = useI18n();
  const [list, setList] = useState<CvSummary[] | null>(null), [draft, setDraft] = useState<Draft | null>(null), [busy, setBusy] = useState(true);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [verified, setVerified] = useState<Verified | null>(null);

  async function loadList() {
    setBusy(true); setError("");
    try { setList(cvList.parse(await appRequest("/api/v1/cv")).items); }
    catch { setList(null); setError(t("cv.loadError")); }
    finally { setBusy(false); }
  }
  // First load: state changes only after the request returns, and not at all if the screen was left meanwhile.
  useEffect(() => {
    let live = true;
    (async () => {
      try { const value = cvList.parse(await appRequest("/api/v1/cv")); if (live) setList(value.items); }
      catch { if (live) setError(t("cv.loadError")); }
      finally { if (live) setBusy(false); }
    })();
    return () => { live = false; };
  }, [t]);

  // Verified work is fetched again each time it is switched on, so it reflects the Passport's current eligibility, suppression and revocation. Switching it off clears it.
  const wantsVerified = draft?.content.includeVerifiedWork === true;
  useEffect(() => {
    if (!wantsVerified) return;
    let live = true;
    collectPrivatePassportExport(cursor => appRequest("/api/v1/passport" + (cursor ? `?cursor=${cursor}` : "")), new Date().toISOString())
      .then(file => { if (live) setVerified(file.records); })
      .catch(() => { if (live) setVerified([]); });
    return () => { live = false; };
  }, [wantsVerified]);

  async function open(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const doc = cvDocument.parse(await appRequest(`/api/v1/cv?id=${id}`));
      setDraft({ id: doc.id, title: doc.title, template: doc.template, targetRole: doc.targetRole ?? "", content: doc.content, revision: doc.revision });
    } catch { setError(t("cv.loadError")); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const body = { id: draft.id, title: draft.title.trim(), template: draft.template, targetRole: draft.targetRole.trim() || null, content: cleaned(draft.content), expectedRevision: draft.revision };
      const result = cvSaved.parse(await appRequest("/api/v1/cv", body));
      setDraft({ ...draft, revision: result.revision, content: body.content }); setNotice(t("cv.saved")); await loadList();
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.code === "VERSION_CONFLICT" ? t("cv.conflict") : caught instanceof ApiRequestError && caught.code === "VALIDATION_FAILED" ? t("cv.invalid") : t("cv.saveError"));
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm(t("cv.confirmDelete"))) return;
    setBusy(true); setError("");
    try { await appRequest("/api/v1/cv/remove", { id }); if (draft?.id === id) setDraft(null); await loadList(); }
    catch { setError(t("cv.deleteError")); setBusy(false); }
  }
  const set = (change: (content: CvContent) => CvContent) => setDraft(current => current ? { ...current, content: change(current.content) } : current);

  if (!draft) return <section className="oq-cv" aria-label={t("cv.aria")}>
    <p>{t("cv.intro")}</p>
    {busy && <p role="status">{t("cv.loading")}</p>}{error && <p role="alert">{error}</p>}
    <button className="fw-primary" disabled={busy || (list?.length ?? 0) >= cvDocumentLimit} onClick={() => { setDraft(blank(displayName)); setNotice(""); setError(""); }}>{t("cv.new")}</button>
    {list && list.length >= cvDocumentLimit && <p>{t("cv.limit", { count: cvDocumentLimit })}</p>}
    {list && list.length === 0 && !busy && <p>{t("cv.none")}</p>}
    <ul className="oq-cv-list">{list?.map(item => <li key={item.id}>
      <strong>{item.title}</strong>{item.targetRole ? ` · ${item.targetRole}` : ""} · {t(`cv.tpl.${item.template}`)} · {new Date(item.updatedAt).toLocaleDateString()}
      <button className="fw-secondary" disabled={busy} onClick={() => void open(item.id)}>{t("cv.open")}</button>
      <button className="fw-secondary" disabled={busy} onClick={() => void remove(item.id)}>{t("cv.delete")}</button>
    </li>)}</ul>
  </section>;

  const c = draft.content;
  return <section className="oq-cv" aria-label={t("cv.aria")}>
    <div className="oq-cv-editor">
      <button className="fw-secondary" disabled={busy} onClick={() => { setDraft(null); setNotice(""); setError(""); void loadList(); }}>{t("cv.back")}</button>
      {busy && <p role="status">{t("cv.loading")}</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <p>{t("cv.selfReported")}</p>
      <label className="fw-field">{t("cv.docTitle")}<input maxLength={80} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="fw-field">{t("cv.targetRole")}<input maxLength={120} value={draft.targetRole} onChange={event => setDraft({ ...draft, targetRole: event.target.value })} /></label>
      <label className="fw-field">{t("cv.template")}<select value={draft.template} onChange={event => setDraft({ ...draft, template: event.target.value as Draft["template"] })}>{cvTemplates.map(value => <option key={value} value={value}>{t(`cv.tpl.${value}`)}</option>)}</select></label>
      <h3>{t("cv.basics")}</h3>
      {([["fullName", 120], ["headline", 120], ["email", 254], ["phone", 40], ["location", 120]] as const).map(([key, max]) =>
        <label className="fw-field" key={key}>{t(`cv.f.${key}`)}<input maxLength={max} value={c.basics[key]} onChange={event => set(x => ({ ...x, basics: { ...x.basics, [key]: event.target.value } }))} /></label>)}
      <label className="fw-field">{t("cv.summary")}<textarea maxLength={1000} value={c.summary} onChange={event => set(x => ({ ...x, summary: event.target.value }))} /></label>
      <Group title={t("cv.education")} items={c.education} max={10} blank={{ school: "", qualification: "", start: "", end: "", notes: "" }} onChange={items => set(x => ({ ...x, education: items }))}
        fields={[["school", 120], ["qualification", 160], ["start", 20], ["end", 20], ["notes", 300]]} label={key => t(`cv.f.${key}` as MessageKey)} add={t("cv.add")} remove={t("cv.removeItem")} />
      <Group title={t("cv.experience")} items={c.experience} max={15} blank={{ employer: "", role: "", start: "", end: "", details: "" }} onChange={items => set(x => ({ ...x, experience: items }))}
        fields={[["employer", 120], ["role", 120], ["start", 20], ["end", 20], ["details", 600]]} label={key => t(`cv.f.${key}` as MessageKey)} add={t("cv.add")} remove={t("cv.removeItem")} />
      <label className="fw-field">{t("cv.skills")}<input value={c.skills.join(", ")} onChange={event => set(x => ({ ...x, skills: event.target.value.split(",").map(s => s.trim().slice(0, 40)).filter(Boolean).slice(0, 30) }))} /></label>
      <Group title={t("cv.projects")} items={c.projects} max={10} blank={{ name: "", description: "", link: "" }} onChange={items => set(x => ({ ...x, projects: items }))}
        fields={[["name", 100], ["description", 500], ["link", 300]]} label={key => t(`cv.f.${key}` as MessageKey)} add={t("cv.add")} remove={t("cv.removeItem")} />
      <label className="fw-field">{t("cv.achievements")}<textarea value={c.achievements.join("\n")} onChange={event => set(x => ({ ...x, achievements: event.target.value.split("\n").map(s => s.slice(0, 200)).filter(s => s.trim()).slice(0, 15) }))} /></label>
      <Group title={t("cv.certifications")} items={c.certifications} max={10} blank={{ name: "", issuer: "", year: "" }} onChange={items => set(x => ({ ...x, certifications: items }))}
        fields={[["name", 120], ["issuer", 120], ["year", 10]]} label={key => t(`cv.f.${key}` as MessageKey)} add={t("cv.add")} remove={t("cv.removeItem")} />
      <Group title={t("cv.links")} items={c.basics.links} max={5} blank={{ label: "", url: "" }} onChange={items => set(x => ({ ...x, basics: { ...x.basics, links: items } }))}
        fields={[["label", 40], ["url", 300]]} label={key => t(`cv.f.${key}` as MessageKey)} add={t("cv.add")} remove={t("cv.removeItem")} />
      <Group title={t("cv.references")} items={c.references} max={3} blank={{ name: "", relationship: "", contact: "" }} onChange={items => set(x => ({ ...x, references: items }))}
        fields={[["name", 120], ["relationship", 120], ["contact", 200]]} label={key => t(`cv.f.${key}` as MessageKey)} add={t("cv.add")} remove={t("cv.removeItem")} />
      <label className="oq-cv-check"><input type="checkbox" checked={c.includeVerifiedWork} onChange={event => { const on = event.target.checked; if (!on) setVerified(null); set(x => ({ ...x, includeVerifiedWork: on })); }} /> {t("cv.includeVerified")}</label>
      <p>{t("cv.verifiedNote")}</p>
      <button className="fw-primary" disabled={busy || !draft.title.trim()} onClick={() => void save()}>{t("cv.save")}</button>
      <button className="fw-secondary" disabled={busy} onClick={() => window.print()}>{t("cv.print")}</button>
      <p>{t("cv.printNote")}</p>
      <CvAnalyzer content={c} />
    </div>
    <CvSheet draft={draft} verified={verified} />
  </section>;
}

// Empty rows and stray blanks are dropped on save so a document never stores placeholders.
function cleaned(content: CvContent): CvContent {
  const any = (row: Record<string, string>) => Object.values(row).some(value => value.trim() !== "");
  return {
    ...content,
    education: content.education.filter(any), experience: content.experience.filter(any), projects: content.projects.filter(any),
    certifications: content.certifications.filter(any), references: content.references.filter(any),
    basics: { ...content.basics, links: content.basics.links.filter(any) },
  };
}

function Group<T extends Record<string, string>>({ title, items, max, blank, fields, label, add, remove, onChange }: {
  title: string; items: T[]; max: number; blank: T; fields: readonly (readonly [keyof T & string, number])[]; label: (key: string) => string; add: string; remove: string; onChange: (items: T[]) => void;
}) {
  return <fieldset className="oq-cv-group"><legend>{title}</legend>
    {items.map((item, index) => <div key={index} className="oq-cv-row">
      {fields.map(([key, limit]) => <label className="fw-field" key={key}>{label(key)}<input maxLength={limit} value={item[key]} onChange={event => onChange(items.map((row, i) => i === index ? { ...row, [key]: event.target.value } : row))} /></label>)}
      <button type="button" className="fw-secondary" onClick={() => onChange(items.filter((_, i) => i !== index))}>{remove}</button>
    </div>)}
    <button type="button" className="fw-secondary" disabled={items.length >= max} onClick={() => onChange([...items, { ...blank }])}>{add}</button>
  </fieldset>;
}

// The printable CV: plain headings and paragraphs in one column (ATS-friendly), styled only by the chosen template.
function CvSheet({ draft, verified }: { draft: Draft; verified: Verified | null }) {
  const { t } = useI18n();
  const c = draft.content;
  const safeLink = (url: string) => /^https:\/\/[^\s<>"']+$/.test(url) ? url : null;
  return <article className={`oq-cv-sheet oq-cv-${draft.template}`} aria-label={t("cv.sheetAria")}>
    <h1>{c.basics.fullName || t("cv.unnamed")}</h1>
    {c.basics.headline && <p className="oq-cv-headline">{c.basics.headline}</p>}
    <p>{[c.basics.email, c.basics.phone, c.basics.location].filter(Boolean).join(" | ")}</p>
    {c.basics.links.length > 0 && <p>{c.basics.links.map((link, i) => { const href = safeLink(link.url); return <span key={i}>{i > 0 ? " | " : ""}{href ? <a href={href} rel="noopener noreferrer">{link.label || href}</a> : (link.label || link.url)}</span>; })}</p>}
    {c.summary && <><h2>{t("cv.summary")}</h2><p>{c.summary}</p></>}
    {c.experience.length > 0 && <><h2>{t("cv.experience")}</h2>{c.experience.map((x, i) => <div key={i}><h3>{[x.role, x.employer].filter(Boolean).join(", ")}</h3><p>{[x.start, x.end].filter(Boolean).join(" – ")}</p>{x.details && <p>{x.details}</p>}</div>)}</>}
    {c.education.length > 0 && <><h2>{t("cv.education")}</h2>{c.education.map((x, i) => <div key={i}><h3>{[x.qualification, x.school].filter(Boolean).join(", ")}</h3><p>{[x.start, x.end].filter(Boolean).join(" – ")}</p>{x.notes && <p>{x.notes}</p>}</div>)}</>}
    {c.skills.length > 0 && <><h2>{t("cv.skills")}</h2><p>{c.skills.join(", ")}</p></>}
    {c.projects.length > 0 && <><h2>{t("cv.projects")}</h2>{c.projects.map((x, i) => <div key={i}><h3>{x.name}</h3>{x.description && <p>{x.description}</p>}{safeLink(x.link) && <p><a href={safeLink(x.link)!} rel="noopener noreferrer">{x.link}</a></p>}</div>)}</>}
    {c.certifications.length > 0 && <><h2>{t("cv.certifications")}</h2><ul>{c.certifications.map((x, i) => <li key={i}>{[x.name, x.issuer, x.year].filter(Boolean).join(", ")}</li>)}</ul></>}
    {c.achievements.length > 0 && <><h2>{t("cv.achievements")}</h2><ul>{c.achievements.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
    {c.includeVerifiedWork && <><h2>{t("cv.verifiedHeading")}</h2>
      {verified === null ? <p>{t("cv.verifiedLoading")}</p> : verified.length === 0 ? <p>{t("cv.verifiedNone")}</p> :
        <><p>{t("cv.verifiedLabel")}</p><ul>{verified.map((x, i) => <li key={i}>{[x.role, x.companyName].filter(Boolean).join(", ")} ({x.periodStart} – {x.periodEnd}, {x.hours} h)</li>)}</ul></>}</>}
    {c.references.length > 0 ? <><h2>{t("cv.references")}</h2>{c.references.map((x, i) => <p key={i}>{[x.name, x.relationship, x.contact].filter(Boolean).join(" | ")}</p>)}</> : null}
    <p className="oq-cv-footer">{t("cv.footer")}</p>
  </article>;
}
