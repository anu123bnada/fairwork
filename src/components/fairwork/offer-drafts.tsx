"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { useI18n } from "@/i18n/use-i18n";
import { draftContent, draftPage, draftReceipt, type DraftPage } from "@/features/offer/draft-schema";

export function OfferDrafts({ onUse }: { onUse: (draft: DraftPage["items"][number]["content"]) => void }) {
 const { t } = useI18n();
 const [page,setPage]=useState<DraftPage|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const [role,setRole]=useState(""),[employer,setEmployer]=useState(""),[text,setText]=useState("");
 const [selected,setSelected]=useState<{id:string;revision:number}|null>(null),[notice,setNotice]=useState("");
 const pending=useRef<{fingerprint:string;id:string;key:string}|null>(null),saving=useRef(false);
 useEffect(()=>{let active=true;appRequest("/api/v1/offers/drafts").then(raw=>{if(active)setPage(draftPage.parse(raw));}).catch(()=>{if(active)setError(t("dr.loadError"));}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[t]);
 async function load(cursor:string|null=null){setBusy(true);setError("");try{const next=draftPage.parse(await appRequest(`/api/v1/offers/drafts${cursor?`?cursor=${cursor}`:""}`));setPage(old=>({...next,items:cursor?[...(old?.items??[]),...next.items]:next.items}));}catch{setPage(null);setError(t("dr.loadError"));}finally{setBusy(false);}}
 async function save(event:FormEvent){event.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError("");setNotice("");try{
  const content=draftContent.parse({role,employer,text});const fingerprint=JSON.stringify([selected,content]);
  if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,id:selected?.id??crypto.randomUUID(),key:crypto.randomUUID()};
  const result=draftReceipt.parse(await appRequest("/api/v1/offers/drafts",{operation:"save",id:pending.current.id,expectedRevision:selected?.revision??0,idempotencyKey:pending.current.key,content}));
  setSelected({id:result.id,revision:result.revision});setNotice(t("dr.saved",{revision:result.revision}));await load();
 }catch{setError(t("dr.saveError"));}finally{saving.current=false;setBusy(false);}}
 return <details className="fw-list-card"><summary>{t("dr.summary")}</summary>
  <p>{t("dr.intro")}</p>
  {busy&&<p role="status">{t("dr.loading")}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <form onSubmit={event=>void save(event)}><fieldset disabled={busy}>
   <label className="fw-field">{t("dr.role")}<input required maxLength={120} value={role} onChange={event=>{setRole(event.target.value);setNotice("");}} /></label>
   <label className="fw-field">{t("dr.employer")}<input maxLength={200} value={employer} onChange={event=>{setEmployer(event.target.value);setNotice("");}} /></label>
   <label className="fw-field" htmlFor="private-draft-text">{t("dr.text")}</label><textarea id="private-draft-text" maxLength={10000} value={text} onChange={event=>{setText(event.target.value);setNotice("");}} />
   <button className="fw-primary">{t("dr.save")}</button>
   <button type="button" className="fw-secondary" onClick={()=>{setSelected(null);setRole("");setEmployer("");setText("");setNotice("");pending.current=null;}}>{t("dr.new")}</button>
  </fieldset></form>
  {page?.items.length===0&&<p>{t("dr.none")}</p>}
  {page?.items.map(item=><article className="fw-question-card" key={item.id}><strong>{item.content.role}</strong><p>{t("dr.itemLine",{employer:item.content.employer||t("dr.noEmployer"),revision:item.revision})}</p>
   <button className="fw-secondary" disabled={busy} onClick={()=>{setSelected(item);setRole(item.content.role);setEmployer(item.content.employer);setText(item.content.text);setNotice("");setError("");}}>{t("dr.edit")}</button>
   <button className="fw-secondary" disabled={busy} onClick={()=>onUse(item.content)}>{t("dr.use")}</button>
  </article>)}
  <button className="fw-secondary" disabled={busy} onClick={()=>void load()}>{t("dr.reload")}</button>
  {page?.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void load(page.nextCursor)}>{t("dr.more")}</button>}
 </details>;
}
