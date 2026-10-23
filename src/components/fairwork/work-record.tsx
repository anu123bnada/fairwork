"use client";
import Link from "next/link";
import { useEffect,useRef,useState,type FormEvent } from "react";
import { appRequest,ApiRequestError } from "@/features/authority/client";
import { workCommandSchema,workReadSchema,workListSchema,type WorkRecord,type WorkList,type WorkVersion } from "@/features/work/schema";
import { workflowReadSchema,type AgreementWorkflow } from "@/features/offer/workflow-schema";
import { participantWorkId, participantAgreementBasisId } from "@/features/offer/participant-path";
import { integrityCommandSchema } from "@/features/work/integrity-schema";
const labels={draft:"Draft",submitted:"Pending",verified:"Verified",disputed:"Disputed",rejected:"Rejected",superseded:"Superseded",withdrawn:"Withdrawn",invalidated:"Verification retracted"};

export function WorkRecordScreen({actorId}:{actorId:string}) {
 const [record,setRecord]=useState<WorkRecord|null>(null),[list,setList]=useState<WorkList>({items:[],nextCursor:null});
 const [busy,setBusy]=useState(true),[error,setError]=useState<Error|null>(null),[editing,setEditing]=useState(()=>typeof window!=="undefined"&&!participantWorkId(window.location.search)&&Boolean(participantAgreementBasisId(window.location.search))),[share,setShare]=useState(false);
 const [agreementId,setAgreementId]=useState(()=>typeof window==="undefined"?"":participantAgreementBasisId(window.location.search)??""),[basis,setBasis]=useState<AgreementWorkflow|null>(null),[reason,setReason]=useState("");
 const [role,setRole]=useState(""),[start,setStart]=useState(""),[end,setEnd]=useState(""),[hours,setHours]=useState(""),[tasks,setTasks]=useState(""),[evidence,setEvidence]=useState<string[]>([""]);
 const keys=useRef(new Map<string,{key:string;id:string}>());
 const [selected,setSelected]=useState<string|null>(()=>typeof window==="undefined"?null:participantWorkId(window.location.search));
 const current=record?.versions.find(v=>v.version===record.currentVersion);
 const worker=record?.workerId===actorId;
 function show(next:WorkRecord){setRecord(next);setAgreementId(next.agreementId);setBasis(null);setShare(false);setEditing(false);setSelected(next.workId);setReason("");}
 async function load(id?:string|null) {
  setBusy(true);setError(null);setShare(false);setEditing(false);
  try {const next=workListSchema.parse(await appRequest("/api/v1/work-records"));setList(next);if(id){show(workReadSchema.parse(await appRequest(`/api/v1/work-records?workId=${id}`)));}else setRecord(null);}
  catch(caught){setRecord(null);setList({items:[],nextCursor:null});setError(caught instanceof Error?caught:new Error("Saved work could not be loaded."));}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  let active=true;const id=participantWorkId(window.location.search);
  void Promise.all([appRequest("/api/v1/work-records"),id?appRequest(`/api/v1/work-records?workId=${id}`):Promise.resolve(null)]).then(([rows,value])=>{
   if(active){setList(workListSchema.parse(rows));if(value)show(workReadSchema.parse(value));}
  }).catch(caught=>{if(active)setError(caught instanceof Error?caught:new Error("Saved work could not be loaded."));}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[]);
 function edit(v?:WorkVersion) {
  setRole(v?.content.role??"");setStart(v?.content.periodStart??"");setEnd(v?.content.periodEnd??"");setHours(v?.content.hours??"");setTasks(v?.content.tasks??"");setEvidence(v?.content.evidence.map(e=>e.text)??[""]);setBasis(null);setEditing(true);setShare(false);setError(null);
 }
 async function loadBasis(){setBusy(true);setError(null);setBasis(null);try {const parsed=workflowReadSchema.parse(await appRequest(`/api/v1/agreement-workflows?agreementId=${encodeURIComponent(agreementId)}`));if(parsed.workerId!==actorId||!parsed.effectiveVersion)throw new Error("An effective agreement belonging to you is required.");setBasis(parsed);}catch(caught){setError(caught instanceof Error?caught:new Error("Agreement unavailable."));}finally{setBusy(false);}}
 async function send(operation:"create"|"correct"|"withdraw"|"retract"|"submit"|"decide",outcome?:"verified"|"disputed"|"rejected") {
  if(busy)return;setBusy(true);setError(null);
  try {
   const expected=current?{expectedVersion:current.version,expectedHash:current.contentHash,expectedState:current.state,expectedEvidenceHash:current.evidenceHash}:{};
   const payload={role,periodStart:start,periodEnd:end,hours,tasks,evidence};
   const input=operation==="create"?{operation,agreementId:basis?.agreementId,agreementVersion:basis?.effectiveVersion,payload}:operation==="correct"?{operation,...expected,agreementVersion:basis?.effectiveVersion,payload,reason}:operation==="submit"?{operation,...expected}:operation==="decide"?{operation,...expected,outcome,reason}:{operation,...expected,reason};
   const fingerprint=JSON.stringify([record?.workId,input]);let pending=keys.current.get(fingerprint);if(!pending){pending={key:crypto.randomUUID(),id:record?.workId??crypto.randomUUID()};keys.current.set(fingerprint,pending);}
   const integrity=["correct","withdraw","retract"].includes(operation);
   await appRequest(integrity?"/api/v1/work-records/integrity":"/api/v1/work-records",(integrity?integrityCommandSchema:workCommandSchema).parse({...input,workId:pending.id,idempotencyKey:pending.key}));
   setSelected(pending.id);window.history.replaceState(null,"",`/app/work-record?workId=${pending.id}`);
   await load(pending.id);
  }catch(caught){setError(caught instanceof ApiRequestError?caught:new Error("Check the work period, hours and evidence, then retry. No save is assumed."));}
  finally{setBusy(false);}
 }
 async function more(){if(!list.nextCursor||busy)return;setBusy(true);setError(null);try{const page=workListSchema.parse(await appRequest(`/api/v1/work-records?cursor=${list.nextCursor}`));setList(previous=>({items:[...previous.items,...page.items],nextCursor:page.nextCursor}));}catch(caught){setError(caught instanceof Error?caught:new Error("Records could not be loaded."));}finally{setBusy(false);}}
 const verifiedHours=list.items.filter(item=>item.state==="verified").reduce((sum,item)=>sum+Number(item.hours),0);
 return <div className="fw-live-work">
  <section className="fw-progress-card fw-work-summary fw-demo-week-summary"><span className="fw-eyebrow">SAVED WORK · LOADED RECORDS</span><div><strong>{busy||error?"—":verifiedHours.toLocaleString()} hrs</strong><span>independently verified</span></div></section>
  {busy&&<p role="status">Loading saved work…</p>}
  {error&&<section className="fw-card fw-offer-detail-card"><p className="fw-error" role="alert">{error.message}</p><button className="fw-secondary" disabled={busy} onClick={()=>void load(selected)}>Reload saved work</button>{error instanceof ApiRequestError&&error.code==="AUTH_REQUIRED"&&<Link href={selected?`/sign-in?workId=${selected}`:participantAgreementBasisId(`agreementBasisId=${encodeURIComponent(agreementId)}`)?`/sign-in?agreementBasisId=${agreementId}`:"/sign-in"}>Sign in to reopen this record</Link>}</section>}
  {!busy&&!error&&!list.items.length&&<section className="fw-work-empty-card"><h3>No work recorded yet</h3><p>Log work against your independently confirmed versioned agreement. Open it and choose Open Work Record to carry its reference here.</p><Link href="/app/agreement-workflow">Open a versioned agreement</Link><br/><Link href="/app/home">Find your saved offer</Link></section>}
  {!!list.items.length&&<section className="fw-demo-week-card" aria-label="Saved work records">{list.items.map(item=><button className="fw-demo-day fw-work-row" key={item.workId} disabled={busy} onClick={()=>{setSelected(item.workId);window.history.replaceState(null,"",`/app/work-record?workId=${item.workId}`);void load(item.workId);}}><span className="fw-demo-day-label"><strong>{new Date(`${item.periodStart}T12:00:00`).toLocaleDateString(undefined,{weekday:"short"})}</strong><small>{item.periodStart.slice(5)}</small></span><span className={`fw-demo-hours-bar${item.state!=="verified"?" is-sample":""}`}><i style={{width:`${Math.min(Number(item.hours)/8*100,100)}%`}}/></span><strong className="fw-demo-hours">{item.hours} h</strong><span className={`fw-demo-day-status${item.state!=="verified"?" is-sample":""}`} aria-label={labels[item.state]}>{item.state==="verified"?"✓":"···"}</span><span className="fw-work-row-status">{labels[item.state]}</span></button>)}</section>}
  {list.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void more()}>Load more records</button>}
  {!editing&&<button className="fw-primary" disabled={busy} onClick={()=>{setRecord(null);setSelected(null);setAgreementId("");window.history.replaceState(null,"","/app/work-record");edit();}}>Log work</button>}
  <p className="fw-demo-work-note">Hours are verified by your employer.</p>
  {record&&<section className="fw-card fw-offer-detail-card" aria-label="Work record details">
   <h3>{current?labels[current.state]:"Shared history"}</h3><p role="status">Record version {record.currentVersion} · {current?labels[current.state]:"A newer private draft exists"}</p>
   <Link href={`/app/cases?workId=${record.workId}`}>Report or review a concern</Link><p>Open cases can exclude verified work from your current Passport.</p>
   {current&&<><WorkDetails version={current}/>{worker&&!editing&&current.state!=="withdrawn"&&<button className="fw-secondary" disabled={busy} onClick={()=>edit(current)}>{current.state==="draft"?"Edit draft":"Reopen as a new draft"}</button>}
    {worker&&!editing&&current.state!=="withdrawn"&&<details><summary>Withdraw this record</summary><p>Withdrawal is permanent for this record. Evidence and decisions remain in private history, and this record is removed from your Passport.</p><label className="fw-field">Withdrawal reason<textarea value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)}/></label><button className="fw-secondary" disabled={busy||!reason.trim()} onClick={()=>void send("withdraw")}>Confirm withdrawal</button></details>}
    {!worker&&current.state==="verified"&&<details><summary>Retract my verification</summary><p>Retract your own verification if your review was incorrect. The original receipt is retained and the record leaves the Passport.</p><label className="fw-field">Retraction reason<textarea value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)}/></label><button className="fw-secondary" disabled={busy||!reason.trim()} onClick={()=>void send("retract")}>Confirm retraction</button></details>}
    {worker&&current.state==="draft"&&!editing&&<><label className="fw-work-check"><input type="checkbox" checked={share} onChange={e=>setShare(e.target.checked)}/> Share this exact record and its text evidence with the designated representative.</label><button className="fw-primary" disabled={busy||!share} onClick={()=>void send("submit")}>Submit for verification</button></>}
    {!worker&&current.state==="submitted"&&<><label className="fw-field">Review reason<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></label>{(["verified","disputed","rejected"] as const).map(outcome=><button className={outcome==="verified"?"fw-primary":"fw-secondary"} disabled={busy||!reason.trim()} key={outcome} onClick={()=>void send("decide",outcome)}>{outcome==="verified"?"Verify exact record":outcome==="disputed"?"Dispute record":"Reject record"}</button>)}</>}
   </>}
   <label className="fw-field">Participant link<input readOnly value={`/app/work-record?workId=${record.workId}`} onFocus={e=>e.target.select()}/></label><p>Each participant must sign in. This link grants no access.</p><button className="fw-secondary" disabled={busy} onClick={()=>void load(record.workId)}>Reload saved work</button>
   <details><summary>Revision history ({record.versions.length})</summary>{record.versions.map(v=><section key={v.version}><h4>Version {v.version} · {labels[v.state]}</h4><WorkDetails version={v}/></section>)}</details>
   {!!record.integrityEvents?.length&&<section aria-label="Record integrity history"><h4>Corrections and withdrawals</h4>{record.integrityEvents.map(event=><p key={event.id}>Version {event.version}{event.nextVersion?` → ${event.nextVersion}`:""} · {event.operation} · {event.reason} · {new Date(event.recordedAt).toLocaleString()}</p>)}</section>}
  </section>}
  {editing&&<form className="fw-card fw-offer-detail-card" onSubmit={(event:FormEvent)=>{event.preventDefault();void send(record?"correct":"create");}}>
   <h3>{record?"Save a fresh work revision":"Log work"}</h3>
   {record&&current?.state!=="draft"&&<p>Reopening supersedes the current record. Its verification will not transfer to the new draft.</p>}
   {record&&<label className="fw-field">Correction reason<textarea required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
   <label className="fw-field">Effective agreement ID<input required readOnly={Boolean(record)} value={agreementId} onChange={e=>{setAgreementId(e.target.value);setBasis(null);}}/></label><button type="button" className="fw-secondary" disabled={busy||!agreementId} onClick={()=>void loadBasis()}>Load agreement basis</button>
   {basis&&<p className="fw-notice">Agreement revision {basis.effectiveVersion} · {basis.versions.find(v=>v.version===basis.effectiveVersion)?.content.terms.responsibilities} · Representative {basis.representativeId}</p>}
   <label className="fw-field">Role<input required value={role} maxLength={120} onChange={e=>setRole(e.target.value)}/></label>
   <label className="fw-field">Period start<input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="fw-field">Period end<input required type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
   <label className="fw-field">Hours<input required inputMode="decimal" value={hours} onChange={e=>setHours(e.target.value)} pattern="(0|[1-9][0-9]{0,4})(\.[0-9]{1,2})?"/></label>
   <label className="fw-field">Work performed<textarea required value={tasks} maxLength={4000} onChange={e=>setTasks(e.target.value)}/></label>
   {evidence.map((text,index)=><div key={index}><label className="fw-field">Text evidence {index+1}<textarea required maxLength={2000} value={text} onChange={e=>setEvidence(values=>values.map((value,i)=>i===index?e.target.value:value))}/></label><button type="button" className="fw-secondary" onClick={()=>setEvidence(values=>values.filter((_,i)=>i!==index))}>Remove statement {index+1}</button></div>)}
   <button type="button" className="fw-secondary" disabled={evidence.length>=10} onClick={()=>setEvidence(values=>[...values,""])}>Add text evidence</button><p>Statements are saved privately with your identity and server time. File uploads are not available.</p>
   <button className="fw-primary" disabled={busy||!basis}>{busy?"Saving…":"Save private draft"}</button><button type="button" className="fw-secondary" disabled={busy} onClick={()=>setEditing(false)}>Cancel edit</button>
  </form>}
  <Link className="fw-dark-button fw-record-passport-link" href="/app/passport">View Work Passport <span aria-hidden>→</span></Link>
 </div>;
}
function WorkDetails({version:v}:{version:WorkVersion}){return <div className="fw-work-details"><p>{v.content.role} · {v.content.periodStart} – {v.content.periodEnd} · {v.content.hours} hours</p><p>{v.content.tasks}</p><p>Agreement revision {v.content.agreement.version} · Effective {new Date(v.content.agreement.effectiveAt).toLocaleString()}</p><p>Agreed scope: {v.content.agreement.scope}</p><h4>Text evidence</h4>{v.content.evidence.map(e=><div key={e.id}><p>{e.text}</p><small>Recorded by the worker · {new Date(e.recordedAt).toLocaleString()}</small></div>)}{v.decision&&<p>{v.state==="superseded"||v.state==="withdrawn"||v.state==="invalidated"?"Historical decision (not current verification)":"Independent decision"}: {labels[v.decision.outcome]} · {v.decision.reason} · {new Date(v.decision.recordedAt).toLocaleString()}</p>}<details><summary>Integrity receipt</summary><p>Record SHA-256: {v.contentHash}</p><p>Evidence SHA-256: {v.evidenceHash}</p>{v.decision&&<p>Decision {v.decision.id} · Verifier {v.decision.actorId}</p>}</details></div>;}
