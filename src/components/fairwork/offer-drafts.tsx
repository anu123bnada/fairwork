"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ApiRequestError, appRequest } from "@/features/authority/client";
import { useI18n } from "@/i18n/use-i18n";
import { draftContent, draftPage, draftReceipt, type DraftPage } from "@/features/offer/draft-schema";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { DraftOfferAssessment } from "./offer-assessment";
import { RuleAnalysis } from "./rule-analysis";
import { ClauseFindings } from "./offer-intelligence";

type DraftContent = DraftPage["items"][number]["content"];
export function OfferDrafts({ onUse, current }: { onUse: (draft: DraftContent) => void; current?: DraftContent }) {
 const { t } = useI18n();
 const requestedId=useSearchParams().get("draftId");
 const [page,setPage]=useState<DraftPage|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const [role,setRole]=useState(""),[employer,setEmployer]=useState(""),[text,setText]=useState("");
 const [selected,setSelected]=useState<{id:string;revision:number}|null>(null),[notice,setNotice]=useState("");
 const [reviewId,setReviewId]=useState<string|null>(null);
 const [baseline,setBaseline]=useState(JSON.stringify({role:"",employer:"",text:""}));
 const dirty=JSON.stringify({role,employer,text})!==baseline;
 const reviewed=page?.items.find(item=>item.id===reviewId);
 const reviewedTerms=reviewed?Object.fromEntries(Object.entries({
  ...extractOfferTermsRuleBased(reviewed.content.text).detectedTerms,
  role:reviewed.content.role,employerName:reviewed.content.employer,
 }).map(([key,value])=>[key,String(value)])):null;
 const pending=useRef<{fingerprint:string;id:string;key:string}|null>(null),saving=useRef(false);
 useEffect(()=>{let active=true;async function open(){try{
  let next=draftPage.parse(await appRequest("/api/v1/offers/drafts"));
  // A dashboard link may have moved to a later page since it was displayed.
  for(let count=0;requestedId&&!next.items.some(item=>item.id===requestedId)&&next.nextCursor&&count<9;count++){
   const more=draftPage.parse(await appRequest(`/api/v1/offers/drafts?cursor=${next.nextCursor}`));next={...more,items:[...next.items,...more.items]};
  }
  if(active){setPage(next);if(requestedId){if(next.items.some(item=>item.id===requestedId))setReviewId(requestedId);else setError(t("dr.notFound"));}}
 }catch{if(active)setError(t("dr.loadError"));}finally{if(active)setBusy(false);}}void open();return()=>{active=false;};},[t,requestedId]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);
 const mayReplace=()=>!dirty||window.confirm(t("dr.discard"));
 async function load(cursor:string|null=null){setBusy(true);setError("");try{const next=draftPage.parse(await appRequest(`/api/v1/offers/drafts${cursor?`?cursor=${cursor}`:""}`));setPage(old=>({...next,items:cursor?[...(old?.items??[]),...next.items]:next.items}));}catch(caught){if(caught instanceof ApiRequestError&&[401,403].includes(caught.status)){setPage(null);setReviewId(null);}setError(t("dr.loadError"));}finally{setBusy(false);}}
 async function save(event:FormEvent){event.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError("");setNotice("");try{
  const content=draftContent.parse({role,employer,text});const fingerprint=JSON.stringify([selected,content]);
  if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,id:selected?.id??crypto.randomUUID(),key:crypto.randomUUID()};
  const result=draftReceipt.parse(await appRequest("/api/v1/offers/drafts",{operation:"save",id:pending.current.id,expectedRevision:selected?.revision??0,idempotencyKey:pending.current.key,content}));
  setSelected({id:result.id,revision:result.revision});setBaseline(JSON.stringify({role,employer,text}));pending.current=null;setNotice(t("dr.saved",{revision:result.revision}));
  // The confirmed receipt keeps the just-saved draft visible even if the list
  // refresh fails or it sorts beyond the first page.
  setPage(old=>({items:[{id:result.id,revision:result.revision,content,savedAt:new Date().toISOString()},...(old?.items??[]).filter(item=>item.id!==result.id)],nextCursor:old?.nextCursor??null}));
 }catch(caught){setError(caught instanceof ApiRequestError&&caught.code==="VERSION_CONFLICT"?t("dr.conflict"):t("dr.saveError"));}finally{saving.current=false;setBusy(false);}}
 return <details id="private-offer-drafts" className="fw-list-card" open={requestedId?true:undefined}><summary>{t("dr.summary")}</summary>
  <p>{t("dr.intro")}</p>
  {current&&<button type="button" className="fw-secondary" disabled={busy||Boolean(role||employer||text)||!current.text.trim()} onClick={()=>{
   setSelected(null);setRole(current.role);setEmployer(current.employer);setText(current.text);setNotice("");setError("");pending.current=null;
  }}>{t("dr.copyCurrent")}</button>}
  {current&&<p>{t("dr.copyHint")}</p>}
  {busy&&<p role="status">{t("dr.loading")}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <form onSubmit={event=>void save(event)}><fieldset disabled={busy}>
   {dirty&&<p role="status">{t("dr.unsaved")}</p>}
   <label className="fw-field">{t("dr.role")}<input required maxLength={120} value={role} onChange={event=>{setRole(event.target.value);setNotice("");}} /></label>
   <label className="fw-field">{t("dr.employer")}<input maxLength={200} value={employer} onChange={event=>{setEmployer(event.target.value);setNotice("");}} /></label>
   <label className="fw-field" htmlFor="private-draft-text">{t("dr.text")}</label><textarea id="private-draft-text" maxLength={10000} value={text} onChange={event=>{setText(event.target.value);setNotice("");}} />
   <button className="fw-primary">{t("dr.save")}</button>
   <button type="button" className="fw-secondary" onClick={()=>{if(!mayReplace())return;setSelected(null);setRole("");setEmployer("");setText("");setBaseline(JSON.stringify({role:"",employer:"",text:""}));setNotice("");pending.current=null;}}>{t("dr.new")}</button>
  </fieldset></form>
  {page?.items.length===0&&<p>{t("dr.none")}</p>}
  {page?.items.map(item=><article className="fw-question-card" key={item.id}><strong>{item.content.role}</strong><p>{t("dr.itemLine",{employer:item.content.employer||t("dr.noEmployer"),revision:item.revision})}</p>
   <button className="fw-secondary" disabled={busy} onClick={()=>{if(!mayReplace())return;setSelected(item);setRole(item.content.role);setEmployer(item.content.employer);setText(item.content.text);setBaseline(JSON.stringify(item.content));setNotice("");setError("");pending.current=null;}}>{t("dr.edit")}</button>
   <button className="fw-secondary" disabled={busy} onClick={()=>onUse(item.content)}>{t("dr.use")}</button>
   <button type="button" className="fw-secondary" disabled={busy} onClick={()=>setReviewId(item.id)}>{t("dr.review")}</button>
  </article>)}
  {reviewed&&reviewedTerms&&<section aria-label={t("dr.reviewRegion")} className="fw-card">
   <h3>{t("dr.reviewTitle",{role:reviewed.content.role,revision:reviewed.revision})}</h3>
   <p>{t("dr.reviewHint")}</p>
   <blockquote style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{reviewed.content.text}</blockquote>
   <RuleAnalysis text={reviewed.content.text} />
   <ClauseFindings text={reviewed.content.text} />
   <DraftOfferAssessment terms={reviewedTerms} />
   <button type="button" className="fw-secondary" onClick={()=>setReviewId(null)}>{t("dr.closeReview")}</button>
  </section>}
  <button className="fw-secondary" disabled={busy} onClick={()=>void load()}>{t("dr.reload")}</button>
  {page?.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void load(page.nextCursor)}>{t("dr.more")}</button>}
 </details>;
}
