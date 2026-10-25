"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { employmentContent, employmentPage, employmentReceipt, type EmploymentPage } from "@/features/work/employment-schema";

type Entry = EmploymentPage["items"][number];

export function EmploymentHistory() {
 const [page,setPage]=useState<EmploymentPage|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [employer,setEmployer]=useState(""),[role,setRole]=useState(""),[startDate,setStartDate]=useState(""),[endDate,setEndDate]=useState("");
 const [current,setCurrent]=useState(false),[skills,setSkills]=useState(""),[achievements,setAchievements]=useState("");
 const [selected,setSelected]=useState<{id:string;revision:number}|null>(null);
 const pending=useRef<{fingerprint:string;id:string;key:string}|null>(null),saving=useRef(false);
 async function load(cursor:string|null=null){setBusy(true);setError("");try{const next=employmentPage.parse(await appRequest(`/api/v1/me/employment-history${cursor?`?cursor=${cursor}`:""}`));setPage(old=>({...next,items:cursor?[...(old?.items??[]),...next.items]:next.items}));}catch{setPage(null);setError("Employment history could not be loaded. Retry when connected.");}finally{setBusy(false);}}
 useEffect(()=>{let active=true;appRequest("/api/v1/me/employment-history").then(raw=>{if(active)setPage(employmentPage.parse(raw));}).catch(()=>{if(active)setError("Employment history could not be loaded. Retry when connected.");}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
 function reset(){setSelected(null);setEmployer("");setRole("");setStartDate("");setEndDate("");setCurrent(false);setSkills("");setAchievements("");pending.current=null;}
 function edit(item:Entry){const c=item.content;setSelected({id:item.id,revision:item.revision});setEmployer(c.employer);setRole(c.role);setStartDate(c.startDate);setEndDate(c.endDate??"");setCurrent(c.current);setSkills(c.skills.join(", "));setAchievements(c.achievements);setNotice("");setError("");}
 async function save(event:FormEvent){event.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError("");setNotice("");try{
  const parsed=employmentContent.safeParse({employer,role,startDate,endDate:current?null:endDate||null,current,skills:skills.split(",").map(s=>s.trim()).filter(Boolean),achievements});
  if(!parsed.success){setError("Check the entry: employer, role and a start month are required; a past role needs an end month that is not before the start.");return;}
  const content=parsed.data,fingerprint=JSON.stringify([selected,content]);
  if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,id:selected?.id??crypto.randomUUID(),key:crypto.randomUUID()};
  const result=employmentReceipt.parse(await appRequest("/api/v1/me/employment-history",{operation:"save",id:pending.current.id,expectedRevision:selected?.revision??0,idempotencyKey:pending.current.key,content}));
  setSelected({id:result.id,revision:result.revision});setNotice(`Saved privately · revision ${result.revision}`);await load();
 }catch{setError("Entry save could not be confirmed. Retry unchanged to reuse the same request, or reload before editing a conflicting revision.");}finally{saving.current=false;setBusy(false);}}
 const sorted=[...(page?.items??[])].sort((a,b)=>b.content.startDate.localeCompare(a.content.startDate));
 return <section className="fw-list-card fw-employment" aria-label="Self-reported employment history">
  <h3>Employment history</h3>
  <p>Private and self-reported. Nothing here is verified, shared or shown on a Work Passport. Verification requires a separate confirmation by an authorized party.</p>
  {busy&&<p role="status">Loading or saving…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <form onSubmit={event=>void save(event)}><fieldset disabled={busy}>
   <label className="fw-field">Employer<input required maxLength={200} value={employer} onChange={e=>setEmployer(e.target.value)} /></label>
   <label className="fw-field">Job title<input required maxLength={120} value={role} onChange={e=>setRole(e.target.value)} /></label>
   <label className="fw-field">Start month<input required type="month" value={startDate} onChange={e=>setStartDate(e.target.value)} /></label>
   <label className="fw-check"><input type="checkbox" checked={current} onChange={e=>setCurrent(e.target.checked)} /> I currently work here</label>
   {!current&&<label className="fw-field">End month<input required type="month" value={endDate} onChange={e=>setEndDate(e.target.value)} /></label>}
   <label className="fw-field">Skills (comma separated, up to 20)<input value={skills} onChange={e=>setSkills(e.target.value)} /></label>
   <label className="fw-field">Achievements<textarea maxLength={2000} value={achievements} onChange={e=>setAchievements(e.target.value)} /></label>
   <button className="fw-primary">{selected?"Save new revision":"Add entry"}</button>
   <button type="button" className="fw-secondary" onClick={()=>{reset();setNotice("");}}>Start new entry</button>
  </fieldset></form>
  {page?.items.length===0&&<p>No employment entries yet.</p>}
  <ol aria-label="Employment timeline">{sorted.map(item=><li key={item.id}><article className="fw-question-card"><strong>{item.content.role}</strong> at {item.content.employer}
   <p>{item.content.startDate} – {item.content.current?"present":item.content.endDate} · Self-reported · Revision {item.revision}</p>
   {item.content.skills.length>0&&<p>Skills: {item.content.skills.join(", ")}</p>}{item.content.achievements&&<p>{item.content.achievements}</p>}
   <button className="fw-secondary" disabled={busy} onClick={()=>edit(item)}>Edit entry</button></article></li>)}</ol>
  <button className="fw-secondary" disabled={busy} onClick={()=>void load()}>Reload history</button>
  {page?.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void load(page.nextCursor)}>Load more entries</button>}
 </section>;
}
