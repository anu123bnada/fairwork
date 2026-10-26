"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { deactivationReceipt } from "@/features/identity/deactivation-schema";
import { z } from "zod";
import { useI18n } from "@/i18n/use-i18n";
const outcome=deactivationReceipt.extend({sessionsRevoked:z.boolean()});
export function AccountSecurity({revision}:{revision:number}) {
 const { t } = useI18n();
 const [factor,setFactor]=useState(""),[secret,setSecret]=useState("");
 const [ready,setReady]=useState(false),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState(""),[done,setDone]=useState(false);
 const key=useRef<{revision:number;key:string}|null>(null);
 useEffect(()=>{let active=true;appRequest("/api/v1/auth/mfa").then(result=>{if(active){setFactor(result.factors.find((f:{status:string})=>f.status==="verified")?.id??"");setReady(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 async function perform(action:()=>Promise<void>) {
  setBusy(true);setError("");setMessage("");try{await action();}catch(e){setError(e instanceof Error?e.message:t("sec.unavailable"));}finally{setBusy(false);}
 }
 function verify(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,data=new FormData(form);
  void perform(async()=>{await appRequest("/api/v1/auth/mfa",{action:"verify",factorId:factor,code:data.get("code")});setSecret("");form.reset();setVerified(true);setMessage(t("sec.verified"));});
 }
 function deactivate(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const data=new FormData(event.currentTarget);
  void perform(async()=>{
   if(!key.current||key.current.revision!==revision)key.current={revision,key:crypto.randomUUID()};
   const result=outcome.parse(await appRequest("/api/v1/auth/deactivate",{expectedRevision:revision,confirmation:data.get("confirmation")},key.current.key));
   setDone(true);setSecret("");setVerified(false);
   setMessage(result.sessionsRevoked?t("sec.deactivatedAll"):t("sec.deactivatedPartial"));
  });
 }
 return <section className="fw-list-card" aria-label={t("sec.aria")}>
  <h3>{t("sec.title")}</h3>
  {done?<><p>{t("sec.doneNote")}</p><Link className="fw-secondary" href="/sign-in">{t("sec.returnSignIn")}</Link></>:<>
   <p>{t("sec.intro")}</p>
   {!ready&&!error&&<p role="status">{t("sec.loading")}</p>}
   {ready&&!factor&&<button className="fw-secondary" disabled={busy} onClick={()=>void perform(async()=>{const enrollment=await appRequest("/api/v1/auth/mfa",{action:"enroll"});setFactor(enrollment.factorId);setSecret(enrollment.secret);})}>{t("sec.setup")}</button>}
   {secret&&<><p>{t("sec.setupKey")}</p><p className="fw-secret" style={{overflowWrap:"anywhere"}}>{secret}</p></>}
   {factor&&<form onSubmit={verify}><label className="fw-field">{t("sec.code")}<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></label><button className="fw-secondary" disabled={busy}>{t("sec.verify")}</button></form>}
   <details><summary>{t("sec.deactSummary")}</summary>
    <p>{t("sec.deactNote")}</p>
    <form onSubmit={deactivate}><label className="fw-field">{t("sec.typeConfirm")}<input name="confirmation" required pattern="DEACTIVATE" autoComplete="off"/></label><button className="fw-secondary" disabled={busy||!verified}>{t("sec.deactButton")}</button></form>
    {!verified&&<p>{t("sec.verifyFirst")}</p>}
   </details>
  </>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
