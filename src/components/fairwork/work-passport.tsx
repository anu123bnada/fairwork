"use client";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { appRequest,ApiRequestError } from "@/features/authority/client";
import { passportSchema,passportReceiptSchema,type Passport } from "@/features/work/passport-schema";
import { collectPrivatePassportExport } from "@/features/work/passport-export";

export function WorkPassportScreen({displayName}:{displayName:string}) {
 const [passport,setPassport]=useState<Passport|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState<Error|null>(null);
 const initializeKey=useRef<string|null>(null);
 const requestSequence=useRef(0);
 useEffect(()=>{
  let active=true;
  void appRequest("/api/v1/passport").then(value=>{if(active)setPassport(passportSchema.parse(value));}).catch(caught=>{if(active)setError(caught instanceof Error?caught:new Error("Passport could not be loaded."));}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[]);
 async function reload(){
  const sequence=++requestSequence.current;setBusy(true);setError(null);setPassport(null);
  try{const next=passportSchema.parse(await appRequest("/api/v1/passport"));if(sequence===requestSequence.current)setPassport(next);}
  catch(caught){if(sequence===requestSequence.current)setError(caught instanceof Error?caught:new Error("Passport could not be loaded."));}
  finally{if(sequence===requestSequence.current)setBusy(false);}
 }
 async function initialize(){
  if(busy)return;setBusy(true);setError(null);
  try{initializeKey.current??=crypto.randomUUID();passportReceiptSchema.parse(await appRequest("/api/v1/passport",{idempotencyKey:initializeKey.current}));await reload();}
  catch(caught){setPassport(null);setError(caught instanceof Error?caught:new Error("Passport creation could not be confirmed. Reload and retry."));}
  finally{setBusy(false);}
 }
 async function more(){
  if(busy||!passport?.nextCursor)return;setBusy(true);setError(null);
  try{const page=passportSchema.parse(await appRequest(`/api/v1/passport?cursor=${passport.nextCursor}`));setPassport(previous=>previous?{...page,entries:[...previous.entries,...page.entries]}:page);}
  catch(caught){setPassport(null);setError(caught instanceof Error?caught:new Error("Passport could not be loaded."));}
  finally{setBusy(false);}
 }
 async function download(){
  if(busy)return;setBusy(true);setError(null);
  try{
   // Always recheck current authorization and suppression; never export cached rows.
   const file=await collectPrivatePassportExport(cursor=>appRequest("/api/v1/passport"+(cursor?`?cursor=${cursor}`:"")),new Date().toISOString());
   const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:"application/json"}));
   const link=document.createElement("a");link.href=url;link.download="oryqen-private-passport.json";link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(caught){setPassport(null);setError(caught instanceof Error?caught:new Error("Private download failed."));}
  finally{setBusy(false);}
 }
 return <div className="fw-demo-passport fw-live-passport">
  <section className="fw-progress-card fw-passport-card fw-demo-passport-card">
   <div className="fw-passport-person"><span className="fw-avatar">{displayName.slice(0,1)}</span><span><strong>{displayName}</strong><br/><span>Work Passport</span></span></div>
   <p className="fw-demo-role">Your independently verified work</p>
   <div className="fw-demo-passport-meta"><span>PRIVATE</span><span>{busy?"Loading…":error?"Unavailable":`${passport?.entries.length??0} verified records loaded`}</span></div>
   <p className="fw-passport-private-note">Only you can view this Passport.</p>
  </section>
  {busy&&<p role="status">Loading private Passport…</p>}
  {error&&<section className="fw-card fw-offer-detail-card"><p className="fw-error" role="alert">{error.message}</p>{error instanceof ApiRequestError&&error.code==="AUTH_REQUIRED"&&<Link href="/sign-in">Sign in to reopen your Passport</Link>}</section>}
  {!busy&&!error&&passport&&!passport.passportId&&<section className="fw-demo-previous-role"><strong>Create your private Passport</strong><span>Show eligible work after independent verification.</span><button className="fw-primary" onClick={()=>void initialize()}>Create private Passport</button></section>}
  {!busy&&!error&&passport?.passportId&&<>
   <h3 className="fw-section-label">Verified work history</h3>
   {!passport.entries.length?<div className="fw-demo-previous-role"><strong>No eligible verified work yet</strong><span>Pending, disputed, rejected, corrected and withdrawn records are excluded.</span><Link href="/app/work-record">View work records</Link></div>:<div className="fw-demo-skill-list" aria-label="Verified work history">{passport.entries.map(entry=><article className="fw-passport-entry" key={entry.workId}>
    <Link className="fw-demo-skill" href={`/app/work-record?workId=${entry.workId}`}><span className="fw-passport-check" aria-hidden>✓</span><strong>{entry.role}</strong><span>{entry.companyName??"Employer reference"}</span></Link>
    <div className="fw-passport-entry-detail"><p>{entry.periodStart} – {entry.periodEnd} · {entry.hours} hours</p><p>{entry.summary}</p><p>Verified {new Date(entry.verifiedAt).toLocaleDateString()} · revision {entry.version}</p><p>{entry.evidenceCount} evidence statements · private contents</p><Link href={`/app/agreement-workflow?workflowId=${entry.agreementId}`}>Agreement revision {entry.agreementVersion}</Link><details><summary>Verification reference</summary><p>{entry.verificationId}</p><p>Employer reference: {entry.companyId}</p><p>Verifier: {entry.verifierId}</p></details></div>
   </article>)}</div>}
   {passport.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void more()}>Load more verified work</button>}
   <h3 className="fw-section-label">Skills</h3><div className="fw-demo-previous-role"><span>Skill verification is not yet available. Work records do not certify skills.</span></div>
  </>}
  <button className="fw-secondary" disabled={busy} onClick={()=>void reload()}>Reload private Passport</button>
  {passport?.passportId&&!error&&<details className="fw-list-card"><summary>Download a private copy</summary><p>Downloads recheck every page, up to 1,000 eligible records. Eligibility can change while pages are read. This file is not a signed certificate or a live verification link. It cannot be remotely revoked or updated. Keep it private.</p><button className="fw-secondary" disabled={busy} onClick={()=>void download()}>Download private JSON</button></details>}
  <div className="fw-demo-passport-action"><p className="fw-disclaimer">Preview selected fields before granting access to a named account. Raw evidence stays private.</p><Link className="fw-primary" href="/app/share">Share Work Passport</Link></div>
 </div>;
}
