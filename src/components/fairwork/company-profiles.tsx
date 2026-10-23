"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { companyProfileSchema, companyResultsSchema, type CompanyProfile } from "@/features/authority/company-schema";
export function CompanyProfiles() {
 const [items, setItems] = useState<Array<{companyId:string;name:string|null}>>([]);
 const [profile, setProfile] = useState<CompanyProfile | null>(null), [error, setError] = useState("");
 const [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
 const keys = useRef(new Map<string,string>());
 useEffect(() => {
  let active = true;
  appRequest("/api/v1/companies").then(raw => { if(active) setItems(companyResultsSchema.parse(raw).items); })
   .catch(e => { if(active) setError(e.message); }).finally(() => { if(active) setReady(true); });
  return () => { active = false; };
 }, []);
 async function search(event:FormEvent<HTMLFormElement>) {
  event.preventDefault(); const query = String(new FormData(event.currentTarget).get("query") ?? "");
  setBusy(true);setError("");setProfile(null);setItems([]);
  try { setItems(companyResultsSchema.parse(await appRequest(`/api/v1/companies?query=${encodeURIComponent(query)}`)).items); }
  catch(e) {setError(e instanceof Error?e.message:"Search unavailable.");} finally {setBusy(false);}
 }
 async function open(companyId:string) {
  setBusy(true);setError("");setProfile(null);
  try {setProfile(companyProfileSchema.parse(await appRequest(`/api/v1/companies?companyId=${companyId}`)));}
  catch(e) {setError(e instanceof Error?e.message:"Profile unavailable.");}finally{setBusy(false);}
 }
 async function save(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();if(!profile)return;
  const data=new FormData(event.currentTarget);
  const body={companyId:profile.companyId,expectedVersion:profile.history[0]?.version??0,claims:{description:String(data.get("description")),website:String(data.get("website")),location:String(data.get("location")),industry:String(data.get("industry"))}};
  const fingerprint=JSON.stringify(body);let key=keys.current.get(fingerprint);if(!key){key=crypto.randomUUID();keys.current.set(fingerprint,key);}
  setBusy(true);setError("");
  try{setProfile(companyProfileSchema.parse(await appRequest("/api/v1/companies",body,key)));}
  catch(e){setProfile(null);setItems([]);setError(e instanceof Error?e.message:"Profile update unavailable.");}finally{setBusy(false);}
 }
 return <section className="fw-card" style={{padding:20}} aria-label="Company information">
  <h3>Company information</h3><p>Search organizations linked to your authorized work. No external company registry or verification provider is connected.</p>
  <form onSubmit={event=>void search(event)}><label className="fw-field">Search your organizations<input name="query" maxLength={120}/></label><button className="fw-secondary" disabled={busy}>Search organizations</button></form>
  {!ready&&<p role="status">Loading organizations…</p>}
  {ready&&!items.length&&<p>No authorized organizations match.</p>}
  {items.map(item=><button className="fw-secondary" key={item.companyId} disabled={busy} onClick={()=>void open(item.companyId)}>{item.name??"Organization"}</button>)}
  {profile&&<article>
   <h4>{profile.companyName}</h4><p>Unverified representative claims · Synthetic authority · Not registry verification</p>
   <p>Organization ID: <span style={{overflowWrap:"anywhere"}}>{profile.companyId}</span></p>
   {profile.history[0]?<><p role="status">Saved company revision {profile.history[0].version}</p><p>Source: an authorized representative submission, {new Date(profile.history[0].submittedAt).toLocaleString()}. Freshness is the submission date, not an independent recheck.</p>
   <dl>{Object.entries(profile.history[0].claims).map(([field,value])=><div key={field}><dt>{field}</dt><dd style={{overflowWrap:"anywhere"}}>{value||"Not stated"}</dd></div>)}</dl></>:<p>No company claims have been submitted.</p>}
   {profile.canEdit&&<form key={`${profile.companyId}:${profile.history[0]?.version??0}`} onSubmit={event=>void save(event)}>
    {([['description','Company description'],['website','Company website (HTTPS)'],['location','Company location'],['industry','Company industry']] as const).map(([field,label])=><label className="fw-field" key={field}>{label}<input name={field} maxLength={field==='website'?400:500} defaultValue={profile.history[0]?.claims[field]??""}/></label>)}
    <p>Submit only information you are authorized to publish to work participants. Corrections create a new revision and preserve earlier claims.</p><button className="fw-primary" disabled={busy}>Save company claims</button>
   </form>}
   {profile.history.length>1&&<details><summary>Previous claims and corrections</summary>{profile.history.slice(1).map(item=><div key={item.version}><strong>Revision {item.version} · {new Date(item.submittedAt).toLocaleString()}</strong><p>{item.claims.description}</p></div>)}</details>}
  </article>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
