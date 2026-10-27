"use client";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { appRequest,ApiRequestError } from "@/features/authority/client";
import { passportSchema,passportReceiptSchema,type Passport } from "@/features/work/passport-schema";
import { collectPrivatePassportExport } from "@/features/work/passport-export";
import { useI18n } from "@/i18n/use-i18n";

export function WorkPassportScreen({displayName}:{displayName:string}) {
 const { t } = useI18n();
 const [passport,setPassport]=useState<Passport|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState<Error|null>(null);
 const initializeKey=useRef<string|null>(null);
 const requestSequence=useRef(0);
 useEffect(()=>{
  let active=true;
  void appRequest("/api/v1/passport").then(value=>{if(active)setPassport(passportSchema.parse(value));}).catch(caught=>{if(active)setError(caught instanceof Error?caught:new Error(t("pp.loadError")));}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[t]);
 async function reload(){
  const sequence=++requestSequence.current;setBusy(true);setError(null);setPassport(null);
  try{const next=passportSchema.parse(await appRequest("/api/v1/passport"));if(sequence===requestSequence.current)setPassport(next);}
  catch(caught){if(sequence===requestSequence.current)setError(caught instanceof Error?caught:new Error(t("pp.loadError")));}
  finally{if(sequence===requestSequence.current)setBusy(false);}
 }
 async function initialize(){
  if(busy)return;setBusy(true);setError(null);
  try{initializeKey.current??=crypto.randomUUID();passportReceiptSchema.parse(await appRequest("/api/v1/passport",{idempotencyKey:initializeKey.current}));await reload();}
  catch(caught){setPassport(null);setError(caught instanceof Error?caught:new Error(t("pp.createError")));}
  finally{setBusy(false);}
 }
 async function more(){
  if(busy||!passport?.nextCursor)return;setBusy(true);setError(null);
  try{const page=passportSchema.parse(await appRequest(`/api/v1/passport?cursor=${passport.nextCursor}`));setPassport(previous=>previous?{...page,entries:[...previous.entries,...page.entries]}:page);}
  catch(caught){setPassport(null);setError(caught instanceof Error?caught:new Error(t("pp.loadError")));}
  finally{setBusy(false);}
 }
 async function downloadSigned(){
  if(busy)return;setBusy(true);setError(null);
  try{
   const signed=await appRequest("/api/v1/passport/signed",{}) as {jws:string;payload:unknown;keyId:string;issuer:string};
   const url=URL.createObjectURL(new Blob([JSON.stringify({format:"oryqen-signed-passport-file.v1",keyId:signed.keyId,issuer:signed.issuer,jws:signed.jws,payload:signed.payload},null,2)],{type:"application/json"}));
   const link=document.createElement("a");link.href=url;link.download="oryqen-signed-passport.json";link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(caught){setError(caught instanceof ApiRequestError&&caught.status===503?new Error(t("pp.signedUnavailable")):caught instanceof Error?caught:new Error(t("pp.downloadError")));}
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
  }catch(caught){setPassport(null);setError(caught instanceof Error?caught:new Error(t("pp.downloadError")));}
  finally{setBusy(false);}
 }
 return <div className="fw-demo-passport fw-live-passport">
  <section className="fw-progress-card fw-passport-card fw-demo-passport-card">
   <div className="fw-passport-person"><span className="fw-avatar">{displayName.slice(0,1)}</span><span><strong>{displayName}</strong><br/><span>{t("pp.title")}</span></span></div>
   <p className="fw-demo-role">{t("pp.tagline")}</p>
   <div className="fw-demo-passport-meta"><span>{t("pp.private")}</span><span>{busy?t("pp.loadingShort"):error?t("pp.unavailable"):t("pp.loadedCount",{count:passport?.entries.length??0})}</span></div>
   <p className="fw-passport-private-note">{t("pp.onlyYou")}</p>
  </section>
  {busy&&<p role="status">{t("pp.loading")}</p>}
  {error&&<section className="fw-card fw-offer-detail-card"><p className="fw-error" role="alert">{error.message}</p>{error instanceof ApiRequestError&&error.code==="AUTH_REQUIRED"&&<Link href="/sign-in">{t("pp.signIn")}</Link>}</section>}
  {!busy&&!error&&passport&&!passport.passportId&&<section className="fw-demo-previous-role"><strong>{t("pp.createTitle")}</strong><span>{t("pp.createSub")}</span><button className="fw-primary" onClick={()=>void initialize()}>{t("pp.create")}</button></section>}
  {!busy&&!error&&passport?.passportId&&<>
   <h3 className="fw-section-label">{t("pp.history")}</h3>
   {!passport.entries.length?<div className="fw-demo-previous-role"><strong>{t("pp.noneTitle")}</strong><span>{t("pp.noneSub")}</span><Link href="/app/work-record">{t("pp.viewRecords")}</Link></div>:<div className="fw-demo-skill-list" aria-label={t("pp.history")}>{passport.entries.map(entry=><article className="fw-passport-entry" key={entry.workId}>
    <Link className="fw-demo-skill" href={`/app/work-record?workId=${entry.workId}`}><span className="fw-passport-check" aria-hidden>✓</span><strong>{entry.role}</strong><span>{entry.companyName??t("pp.employerRef")}</span></Link>
    <div className="fw-passport-entry-detail"><p>{t("pp.period",{start:entry.periodStart,end:entry.periodEnd,hours:entry.hours})}</p><p>{entry.summary}</p><p>{t("pp.verified",{date:new Date(entry.verifiedAt).toLocaleDateString(),version:entry.version})}</p><p>{t("pp.evidence",{count:entry.evidenceCount})}</p><Link href={`/app/agreement-workflow?workflowId=${entry.agreementId}`}>{t("pp.agreementRev",{version:entry.agreementVersion})}</Link><details><summary>{t("pp.verifyRef")}</summary><p>{entry.verificationId}</p><p>{t("pp.employerRefLine",{id:entry.companyId})}</p><p>{t("pp.verifier",{id:entry.verifierId})}</p></details></div>
   </article>)}</div>}
   {passport.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void more()}>{t("pp.more")}</button>}
   <h3 className="fw-section-label">{t("pp.skills")}</h3><div className="fw-demo-previous-role"><span>{t("pp.skillsNote")}</span></div>
  </>}
  <button className="fw-secondary" disabled={busy} onClick={()=>void reload()}>{t("pp.reload")}</button>
  {passport?.passportId&&!error&&<details className="fw-list-card"><summary>{t("pp.downloadSummary")}</summary><p>{t("pp.downloadNote")}</p><button className="fw-secondary" disabled={busy} onClick={()=>void download()}>{t("pp.downloadButton")}</button><button className="fw-secondary" disabled={busy} onClick={()=>void downloadSigned()}>{t("pp.signedButton")}</button><p>{t("pp.signedNote")}</p><button className="fw-secondary" onClick={()=>window.print()}>{t("pp.print")}</button><p>{t("pp.printNote")}</p></details>}
  <div className="fw-demo-passport-action"><p className="fw-disclaimer">{t("pp.preview")}</p><Link className="fw-primary" href="/app/share">{t("pp.share")}</Link></div>
 </div>;
}
