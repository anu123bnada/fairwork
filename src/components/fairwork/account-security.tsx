"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { deactivationReceipt } from "@/features/identity/deactivation-schema";
import { z } from "zod";
const outcome=deactivationReceipt.extend({sessionsRevoked:z.boolean()});
export function AccountSecurity({revision}:{revision:number}) {
 const [factor,setFactor]=useState(""),[secret,setSecret]=useState("");
 const [ready,setReady]=useState(false),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState(""),[done,setDone]=useState(false);
 const key=useRef<{revision:number;key:string}|null>(null);
 useEffect(()=>{let active=true;appRequest("/api/v1/auth/mfa").then(result=>{if(active){setFactor(result.factors.find((f:{status:string})=>f.status==="verified")?.id??"");setReady(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 async function perform(action:()=>Promise<void>) {
  setBusy(true);setError("");setMessage("");try{await action();}catch(e){setError(e instanceof Error?e.message:"Account security is unavailable.");}finally{setBusy(false);}
 }
 function verify(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,data=new FormData(form);
  void perform(async()=>{await appRequest("/api/v1/auth/mfa",{action:"verify",factorId:factor,code:data.get("code")});setSecret("");form.reset();setVerified(true);setMessage("Authenticator verified for this session.");});
 }
 function deactivate(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const data=new FormData(event.currentTarget);
  void perform(async()=>{
   if(!key.current||key.current.revision!==revision)key.current={revision,key:crypto.randomUUID()};
   const result=outcome.parse(await appRequest("/api/v1/auth/deactivate",{expectedRevision:revision,confirmation:data.get("confirmation")},key.current.key));
   setDone(true);setSecret("");setVerified(false);
   setMessage(result.sessionsRevoked?"Your ORYQEN account is deactivated and all refresh sessions were signed out.":"Your ORYQEN account is deactivated. Auth session revocation could not be confirmed, but application access is blocked.");
  });
 }
 return <section className="fw-list-card" aria-label="Account security">
  <h3>Authenticator and account access</h3>
  {done?<><p>Existing agreements, work history and audit records are retained. This was not a deletion. Self-service reactivation is unavailable.</p><Link className="fw-secondary" href="/sign-in">Return to sign-in</Link></>:<>
   <p>Use an authenticator app for sensitive account actions. This sends no SMS and grants no employer or reviewer permissions.</p>
   {!ready&&!error&&<p role="status">Loading account security…</p>}
   {ready&&!factor&&<button className="fw-secondary" disabled={busy} onClick={()=>void perform(async()=>{const enrollment=await appRequest("/api/v1/auth/mfa",{action:"enroll"});setFactor(enrollment.factorId);setSecret(enrollment.secret);})}>Set up account authenticator</button>}
   {secret&&<><p>Add this private setup key to your authenticator app. It is shown only during enrollment; do not share it.</p><p className="fw-secret" style={{overflowWrap:"anywhere"}}>{secret}</p></>}
   {factor&&<form onSubmit={verify}><label className="fw-field">Account authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></label><button className="fw-secondary" disabled={busy}>Verify account authenticator</button></form>}
   <details><summary>Deactivate my account</summary>
    <p>Deactivation blocks your ORYQEN access and recipient access to your shared Passport. Previously downloaded copies cannot be recalled. Agreements and audit history are retained; deactivation does not erase data or retract historical confirmations. Self-service reactivation is unavailable. For deletion review, use Privacy requests before deactivating.</p>
    <form onSubmit={deactivate}><label className="fw-field">Type DEACTIVATE to confirm<input name="confirmation" required pattern="DEACTIVATE" autoComplete="off"/></label><button className="fw-secondary" disabled={busy||!verified}>Deactivate my ORYQEN account</button></form>
    {!verified&&<p>Verify your authenticator above to enable deactivation.</p>}
   </details>
  </>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
