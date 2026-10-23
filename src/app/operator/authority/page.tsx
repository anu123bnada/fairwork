"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/fairwork/auth-shell";
import { appRequest } from "@/features/authority/client";
import { companyResult, membershipResult } from "@/features/authority/schema";
import { meSchema } from "@/features/identity/schema";
import { OrganizationRequests } from "@/components/fairwork/organization-requests";

export default function AuthorityPage() {
  const [ready,setReady]=useState(false); const [operator,setOperator]=useState(false);
  const [factor,setFactor]=useState(""); const [secret,setSecret]=useState("");
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [companyId,setCompanyId]=useState(""); const [revision,setRevision]=useState("0");
  const [decision,setDecision]=useState("approve"); const [result,setResult]=useState<Record<string,unknown>|null>(null);
  const keys=useRef(new Map<string,string>());
  async function refresh() {
    const profile=meSchema.parse(await appRequest("/api/v1/me"));
    const mfa=await appRequest("/api/v1/auth/mfa");
    setOperator(profile.capabilities.includes("authority_operator"));
    setFactor(mfa.factors.find((f:{status:string})=>f.status==="verified")?.id ?? ""); setReady(true);
  }
  useEffect(()=>{ let active=true;
    Promise.all([appRequest("/api/v1/me"),appRequest("/api/v1/auth/mfa")]).then(([raw,mfa])=>{
      if(!active)return; const profile=meSchema.parse(raw); setOperator(profile.capabilities.includes("authority_operator"));
      setFactor(mfa.factors.find((f:{status:string})=>f.status==="verified")?.id??""); setReady(true);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load your session.");});
    return ()=>{active=false;};
  },[]);
  async function perform(action:()=>Promise<void>) {
    setBusy(true);setError("");setMessage("");
    try { await action(); } catch(e) {setError(e instanceof Error?e.message:"Unable to complete the action.");}
    finally {setBusy(false);}
  }
  async function command(path:string,body:unknown) {
    // Retain the same key after a lost response. A changed payload gets a new key.
    const fingerprint=path+JSON.stringify(body); let key=keys.current.get(fingerprint);
    if(!key){key=crypto.randomUUID();keys.current.set(fingerprint,key);}
    return appRequest(path,body,key);
  }
  function verify(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=event.currentTarget;const data=new FormData(form);
    void perform(async()=>{await appRequest("/api/v1/auth/mfa",{action:"verify",factorId:factor,code:data.get("code")});setSecret("");form.reset();await refresh();setMessage("Authenticator verified. Only assigned capabilities unlock operator actions.");});
  }
  function provision(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data=new FormData(event.currentTarget);
    void perform(async()=>{const result=companyResult.parse(await command("/api/v1/operator/companies",{name:data.get("name")}));setCompanyId(result.id);setResult(result);setMessage("Synthetic company provisioned. No representative access was granted.");});
  }
  function membership(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data=new FormData(event.currentTarget);
    void perform(async()=>{
      const result=membershipResult.parse(await command("/api/v1/operator/membership-decisions",{companyId,subjectId:data.get("subjectId"),decision,expectedRevision:Number(revision),expiresAt:decision==="approve"?new Date(String(data.get("expiresAt"))).toISOString():null,reviewedEvidenceRefs:String(data.get("evidence")).split("\n").map(v=>v.trim()).filter(Boolean),reason:data.get("reason"),policyVersion:"demo-authority.v1"}));
      setRevision(String(result.revision));setResult(result);setMessage("Immutable decision recorded. Review the current authority status below.");
    });
  }
  return <AuthShell title="Demo authority">
    <p className="fw-demo">Synthetic simulation • demo_provisioned<br/>This does not verify a real employer or legal identity.</p>
    {!ready && <p><Link href="/sign-in">Sign in with a provisioned account</Link></p>}
    {ready && !operator && <section>
      <h2>Verify your authenticator</h2>
      <p>An assigned authority capability and a verified authenticator session are both required.</p>
      {!factor ? <button disabled={busy} onClick={()=>void perform(async()=>{const enrollment=await appRequest("/api/v1/auth/mfa",{action:"enroll"});setFactor(enrollment.factorId);setSecret(enrollment.secret);})}>Set up authenticator</button> : null}
      {secret && <><p>Add this setup key to your authenticator app for ORYQEN. Keep it private.</p><p className="fw-secret">{secret}</p></>}
      {factor && <form onSubmit={verify}><label>6-digit authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></label><button disabled={busy}>Verify code</button></form>}
    </section>}
    {operator && <>
      <OrganizationRequests operator />
      <section><h2>Provision demo company</h2><form onSubmit={provision}><label>Synthetic company name<input name="name" required maxLength={120}/></label><button disabled={busy}>Provision company</button></form></section>
      <section><h2>Record representative decision</h2><p>Use approved fixture IDs. You cannot approve your own account.</p><form onSubmit={membership}>
        <label>Company ID<input value={companyId} onChange={e=>{setCompanyId(e.target.value);setRevision("0");}} required/></label>
        <label>Representative account ID<input name="subjectId" onChange={()=>setRevision("0")} required/></label>
        <label>Decision<select value={decision} onChange={e=>setDecision(e.target.value)}><option value="approve">Approve synthetic representative</option><option value="revoke">Revoke authority</option></select></label>
        <label>Current membership revision (0 for first decision)<input type="number" min={0} max={999999999} value={revision} onChange={e=>setRevision(e.target.value)} required/></label>
        {decision==="approve" && <label>Expires at (local time, within 30 days)<input name="expiresAt" type="datetime-local" required/></label>}
        <label>Reviewed demo evidence references (one per line)<textarea name="evidence" placeholder="demo:fixture/representative" maxLength={1210} required/></label>
        <label>Decision reason<textarea name="reason" maxLength={500} required/></label>
        <button disabled={busy}>Record {decision === "approve" ? "approval" : "revocation"}</button>
      </form></section>
    </>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {result && <dl aria-label="Command result">{Object.entries(result).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>}
    {ready && <p><button disabled={busy} onClick={()=>void perform(async()=>{await appRequest("/api/v1/auth/sign-out",{});setSecret("");setFactor("");setOperator(false);setReady(false);setResult(null);keys.current.clear();setMessage("Signed out.");})}>Sign out</button></p>}
  </AuthShell>;
}
