"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { draftContent, draftPage, draftReceipt, type DraftPage } from "@/features/offer/draft-schema";

export function OfferDrafts({ onUse }: { onUse: (draft: DraftPage["items"][number]["content"]) => void }) {
 const [page,setPage]=useState<DraftPage|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const [role,setRole]=useState(""),[employer,setEmployer]=useState(""),[text,setText]=useState("");
 const [selected,setSelected]=useState<{id:string;revision:number}|null>(null),[notice,setNotice]=useState("");
 const pending=useRef<{fingerprint:string;id:string;key:string}|null>(null),saving=useRef(false);
 useEffect(()=>{let active=true;appRequest("/api/v1/offers/drafts").then(raw=>{if(active)setPage(draftPage.parse(raw));}).catch(()=>{if(active)setError("Drafts could not be loaded. Retry when connected.");}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
 async function load(cursor:string|null=null){setBusy(true);setError("");try{const next=draftPage.parse(await appRequest(`/api/v1/offers/drafts${cursor?`?cursor=${cursor}`:""}`));setPage(old=>({...next,items:cursor?[...(old?.items??[]),...next.items]:next.items}));}catch{setPage(null);setError("Drafts could not be loaded. Retry when connected.");}finally{setBusy(false);}}
 async function save(event:FormEvent){event.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError("");setNotice("");try{
  const content=draftContent.parse({role,employer,text});const fingerprint=JSON.stringify([selected,content]);
  if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,id:selected?.id??crypto.randomUUID(),key:crypto.randomUUID()};
  const result=draftReceipt.parse(await appRequest("/api/v1/offers/drafts",{operation:"save",id:pending.current.id,expectedRevision:selected?.revision??0,idempotencyKey:pending.current.key,content}));
  setSelected({id:result.id,revision:result.revision});setNotice(`Private draft saved · revision ${result.revision}`);await load();
 }catch{setError("Draft save could not be confirmed. Retry unchanged to reuse the same request, or reload before editing a conflicting revision.");}finally{saving.current=false;setBusy(false);}}
 return <details className="fw-list-card"><summary>Private offer drafts — no organization required</summary>
  <p>Save incomplete offer notes privately. These are self-reported drafts, not employer-verified offers or agreements. Organization linking remains a separate step.</p>
  {busy&&<p role="status">Loading or saving drafts…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <form onSubmit={event=>void save(event)}><fieldset disabled={busy}>
   <label className="fw-field">Draft role<input required maxLength={120} value={role} onChange={event=>{setRole(event.target.value);setNotice("");}} /></label>
   <label className="fw-field">Reported employer<input maxLength={200} value={employer} onChange={event=>{setEmployer(event.target.value);setNotice("");}} /></label>
   <label className="fw-field" htmlFor="private-draft-text">Draft offer text</label><textarea id="private-draft-text" maxLength={10000} value={text} onChange={event=>{setText(event.target.value);setNotice("");}} />
   <button className="fw-primary">Save private draft</button>
   <button type="button" className="fw-secondary" onClick={()=>{setSelected(null);setRole("");setEmployer("");setText("");setNotice("");pending.current=null;}}>Start new draft</button>
  </fieldset></form>
  {page?.items.length===0&&<p>No saved drafts yet.</p>}
  {page?.items.map(item=><article className="fw-question-card" key={item.id}><strong>{item.content.role}</strong><p>{item.content.employer||"Employer not recorded"} · Revision {item.revision} · Self-reported</p>
   <button className="fw-secondary" disabled={busy} onClick={()=>{setSelected(item);setRole(item.content.role);setEmployer(item.content.employer);setText(item.content.text);setNotice("");setError("");}}>Edit draft</button>
   <button className="fw-secondary" disabled={busy} onClick={()=>onUse(item.content)}>Use saved draft in a new offer</button>
  </article>)}
  <button className="fw-secondary" disabled={busy} onClick={()=>void load()}>Reload drafts</button>
  {page?.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void load(page.nextCursor)}>Load more drafts</button>}
 </details>;
}
