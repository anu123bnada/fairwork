"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { appRequest, ApiRequestError } from "@/features/authority/client";
import { workflowCommandSchema, workflowReadSchema, type AgreementWorkflow, type AgreementVersion } from "@/features/offer/workflow-schema";
import { participantWorkflowId } from "@/features/offer/participant-path";
import { agreementReadSchema } from "@/features/offer/read-schema";

export function CreateVersionedAgreement({ offerId, version, termHash, representativeId }: { offerId:string;version:number;termHash:string;representativeId?:string|null }) {
  const [representative,setRepresentative]=useState(representativeId??"");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const pending=useRef<{ fingerprint:string; agreementId:string; idempotencyKey:string }|null>(null);
  const router=useRouter();
  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const fingerprint=JSON.stringify([offerId,version,termHash,representative]);
      if(pending.current?.fingerprint!==fingerprint) pending.current={fingerprint,agreementId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID()};
      const {agreementId,idempotencyKey}=pending.current;
      await appRequest("/api/v1/agreement-workflows",workflowCommandSchema.parse({operation:"create",agreementId,idempotencyKey,offerId,offerVersion:version,expectedSourceHash:termHash,representativeId:representative}));
      router.push(`/app/agreement-workflow?workflowId=${agreementId}`);
    } catch(caught) {setError(caught instanceof ApiRequestError?caught.message:"Check the representative ID and retry. No agreement has been assumed saved.");}
    finally {setBusy(false);}
  }
  return <details className="fw-card fw-offer-detail-card"><summary>Create a versioned agreement</summary>
    <p>Freeze this saved offer with explicit acknowledgements and independent confirmation. Existing confirmations will remain separate.</p>
    <form onSubmit={event=>void create(event)}>
      <label className="fw-field">Designated representative ID<input required value={representative} onChange={event=>setRepresentative(event.target.value)} pattern={"[0-9a-fA-F\\-]{36}"} /></label>
      <p className="fw-notice">Use the agreed participant’s account ID. The server checks current company authority; the ID grants no access.</p>
      <button className="fw-secondary" disabled={busy}>{busy?"Saving draft…":"Create secure draft"}</button>
      {error&&<p role="alert" className="fw-error">{error}</p>}
    </form>
  </details>;
}

const statusLabels:Record<AgreementVersion["status"],string>={ready_for_review:"Ready for review",awaiting_answers:"Awaiting answers",awaiting_acknowledgements:"Awaiting independent acknowledgements",awaiting_confirmations:"Awaiting confirmations",effective:"Both participants confirmed",declined:"This version was declined",superseded:"Superseded version",revision_conflict:"Source or authority changed — a new version is required"};

export function AgreementWorkflowScreen({ actorId }: { actorId:string }) {
  const [workflow,setWorkflow]=useState<AgreementWorkflow|null>(null);
  const [busy,setBusy]=useState(()=>typeof window!=="undefined"&&Boolean(participantWorkflowId(window.location.search)));
  const [error,setError]=useState<Error|null>(null);
  const [checked,setChecked]=useState<string[]>([]);
  const [shareChecked,setShareChecked]=useState(false);
  const [openId,setOpenId]=useState("");
  const keys=useRef(new Map<string,string>());
  const generation=useRef(0);
  const [selectedId,setSelectedId]=useState(()=>typeof window==="undefined"?"":participantWorkflowId(window.location.search)??"");
  const load=useCallback(async(id:string)=>{
    const token=++generation.current;setBusy(true);setError(null);setChecked([]);setShareChecked(false);
    try {
      const next=workflowReadSchema.parse(await appRequest(`/api/v1/agreement-workflows?agreementId=${encodeURIComponent(id)}`));
      if(token===generation.current){setWorkflow(next);setSelectedId(id);}
    }catch(caught){if(token===generation.current){setWorkflow(null);setError(caught instanceof Error?caught:new Error("Agreement could not be verified."));}}
    finally{if(token===generation.current)setBusy(false);}
  },[]);
  useEffect(()=>{
    const id=participantWorkflowId(window.location.search);
    let active=true;
    if(id) void appRequest(`/api/v1/agreement-workflows?agreementId=${encodeURIComponent(id)}`)
      .then(data=>{if(active){setWorkflow(workflowReadSchema.parse(data));setSelectedId(id);}})
      .catch(caught=>{if(active)setError(caught instanceof Error?caught:new Error("Agreement could not be verified."));})
      .finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[]);
  const current=workflow?.versions.find(v=>v.version===workflow.currentVersion);
  const effective=workflow?.versions.find(v=>v.version===workflow.effectiveVersion);
  const mine=current?.acknowledgements.find(a=>a.actorId===actorId);
  const decision=current?.decisions.find(d=>d.actorId===actorId);
  const worker=workflow?.workerId===actorId;

  async function send(operation:"propose"|"acknowledge"|"confirm"|"decline"|"amend") {
    if(!workflow||!current||busy)return;
    setBusy(true);setError(null);
    try {
      const expected={agreementId:workflow.agreementId,expectedVersion:current.version,expectedHash:current.contentHash,expectedState:current.state};
      let input:Record<string,unknown>;
      if(operation==="amend") {
        const saved=agreementReadSchema.parse(await appRequest(`/api/v1/agreements?offerId=${current.content.source.offerId}`));
        input={operation,...expected,offerId:saved.offer.offerId,offerVersion:saved.offer.version,expectedSourceHash:saved.offer.termHash};
      } else if(operation==="propose") input={operation,...expected,sharedQuestionIds:current.content.sharedQuestions.map(q=>q.id)};
      else input={operation:operation==="acknowledge"?operation:"decide",...expected,expectedItemSetHash:current.itemSetHash,acknowledgedItemIds:operation==="acknowledge"?checked:current.unresolvedIds,...(operation==="acknowledge"?{}:{decision:operation})};
      const fingerprint=JSON.stringify(input);
      let key=keys.current.get(fingerprint);if(!key){key=crypto.randomUUID();keys.current.set(fingerprint,key);}
      await appRequest("/api/v1/agreement-workflows",workflowCommandSchema.parse({...input,idempotencyKey:key}));
      await load(workflow.agreementId);
    }catch(caught){setError(caught instanceof Error?caught:new Error("The action could not be verified. Retry with the same displayed version."));}
    finally{setBusy(false);}
  }
  return <>
    <h2 className="fw-page-title">Agreement summary</h2>
    <p className="fw-page-subtitle">Independent review of one saved version.</p>
    {busy&&<p role="status" className="fw-notice">Verifying saved agreement…</p>}
    {error&&<div className="fw-error" role="alert"><p>{error instanceof ApiRequestError?error.message:"The saved agreement could not be verified. Check your connection and retry."}</p>
      {error instanceof ApiRequestError&&error.code==="AUTH_REQUIRED"?<Link href={`/sign-in?workflowId=${selectedId}`}>Sign in to reopen this agreement</Link>:<button className="fw-secondary" disabled={busy||!selectedId} onClick={()=>void load(selectedId)}>Reload authoritative agreement</button>}
    </div>}
    {!workflow&&!busy&&<form className="fw-card fw-offer-detail-card" onSubmit={event=>{event.preventDefault();setSelectedId(openId);void load(openId);}}>
      <label className="fw-field">Versioned agreement ID<input value={openId} onChange={event=>setOpenId(event.target.value)} required pattern={"[0-9a-fA-F\\-]{36}"} /></label><button className="fw-secondary">Open versioned agreement</button>
    </form>}
    {workflow&&<>
      <p className="fw-notice">Designated worker: {workflow.workerId}<br/>Employer representative: {workflow.representativeId}</p>
      {!current&&<p className="fw-notice">The worker is preparing a private amendment. Previously shared versions remain below.</p>}
      {effective&&effective.version!==current?.version&&<section className="fw-card fw-offer-detail-card" aria-label="Currently effective agreement"><strong>Last confirmed version {effective.version}</strong><p>Its recorded confirmations remain unchanged while an amendment is reviewed.</p><TermSummary version={effective}/></section>}
      {current&&<>
        <p className={current.status==="effective"?"fw-success":"fw-notice"} role="status">Version {current.version} · {statusLabels[current.status]}</p>
        <div className="fw-signatures">{[{id:workflow.workerId,label:"Worker"},{id:workflow.representativeId,label:"Employer"}].map(party=><div className="fw-signature" key={party.id}><span className="fw-signature-avatar" aria-hidden="true">{party.label[0]}</span><span><strong>{party.label}</strong><br/>{current.decisions.find(d=>d.actorId===party.id)?.decision==="confirm"?"Confirmed":current.decisions.find(d=>d.actorId===party.id)?.decision==="decline"?"Declined":current.acknowledgements.some(a=>a.actorId===party.id)?"Acknowledged; not confirmed":"Awaiting acknowledgement"}</span></div>)}</div>
        <TermSummary version={current}/>
        <section className="fw-card fw-offer-detail-card" aria-label="Unresolved acknowledgements"><h3>Unresolved items</h3>
          <p>Acknowledging an item does not resolve it or declare it safe. Each participant must review every item independently.</p>
          {current.content.unresolved.map(item=><label className="fw-field" key={item.itemId}><span>{item.fieldId}</span><span>{item.explanation}</span>
            <span><input type="checkbox" aria-label={`Acknowledge ${item.fieldId}`} disabled={busy||Boolean(mine)||current.state!=="proposed"||current.status==="revision_conflict"} checked={Boolean(mine)||checked.includes(item.itemId)} onChange={event=>setChecked(previous=>event.target.checked?[...previous,item.itemId]:previous.filter(id=>id!==item.itemId))}/> I understand this item remains unresolved</span>
          </label>)}
          {!current.unresolvedIds.length&&<p>No unresolved items in this version. Review the complete terms before recording your acknowledgement.</p>}
          {current.state==="proposed"&&!mine&&<button className="fw-secondary" disabled={busy||current.status==="revision_conflict"||checked.length!==current.unresolvedIds.length} onClick={()=>void send("acknowledge")}>Record my acknowledgement</button>}
        </section>
        <section className="fw-card fw-offer-detail-card"><h3>Shared questions and attributed answers</h3>
          {!current.content.sharedQuestions.length&&<p>No generated questions in this source revision.</p>}
          {current.content.sharedQuestions.map(q=>{const answer=current.content.answers.find(a=>a.questionId===q.id);return <div className="fw-list-row" key={q.id}><span>{q.question}</span><strong>{answer?`${answer.answer} — recorded by ${answer.answeredBy===workflow.workerId?"the worker":"the source representative"} on ${new Date(answer.answeredAt).toLocaleString()}`:"Answer not yet recorded"}</strong></div>;})}
          <p>Answers are attributed observations. They do not replace the saved terms above.</p>
        </section>
        {worker&&current.state==="draft"&&<section className="fw-card fw-offer-detail-card">
          <label><input type="checkbox" checked={shareChecked} onChange={event=>setShareChecked(event.target.checked)}/> Share these terms, unresolved items and all {current.content.sharedQuestions.length} listed questions and answers with the designated representative.</label>
          <button className="fw-primary" disabled={busy||!shareChecked||current.status!=="ready_for_review"} onClick={()=>void send("propose")}>Propose this version</button>
          {current.status==="awaiting_answers"&&<Link href={`/app/questions?offerId=${current.content.source.offerId}`}>Record required answers, then create a fresh version</Link>}
        </section>}
        {current.state==="proposed"&&!decision&&<div className="fw-card fw-offer-detail-card">
          <button className="fw-primary" disabled={busy||!mine||current.status==="revision_conflict"} onClick={()=>void send("confirm")}>Confirm this exact version</button>
          <button className="fw-secondary" disabled={busy||current.status==="revision_conflict"} onClick={()=>void send("decline")}>Decline this version</button>
        </div>}
        {worker&&<details className="fw-card fw-offer-detail-card"><summary>Prepare an amendment</summary><p>Edit the source offer first to change its terms. A fresh version also captures new answers or renewed authority. Previous consent is never copied.</p>
          <Link href={`/app/add-offer?offerId=${current.content.source.offerId}`}>Edit source offer</Link>
          <button className="fw-secondary" disabled={busy} onClick={()=>void send("amend")}>Freeze latest saved source as a new version</button>
        </details>}
        <details className="fw-card fw-offer-detail-card"><summary>Revision receipt</summary><p>Source revision {current.content.source.version} · Saved {new Date(current.createdAt).toLocaleString()}</p><p style={{overflowWrap:"anywhere"}}>Content SHA-256: {current.contentHash}</p><p style={{overflowWrap:"anywhere"}}>Item-set SHA-256: {current.itemSetHash}</p>{current.decisions.map(receipt=><p key={receipt.actorId}>{receipt.actorId}: {receipt.decision} at {new Date(receipt.recordedAt).toLocaleString()}</p>)}</details>
      </>}
      <section className="fw-card fw-offer-detail-card"><label className="fw-field">Versioned participant link<input readOnly value={`/app/agreement-workflow?workflowId=${workflow.agreementId}`} onFocus={event=>event.target.select()}/></label><p>The link grants no access. Each participant signs in independently.</p><button className="fw-secondary" disabled={busy} onClick={()=>void load(workflow.agreementId)}>Reload saved version</button></section>
      {worker&&effective&&<Link className="fw-dark-button" href={`/app/work-record?agreementBasisId=${workflow.agreementId}`}>Open Work Record</Link>}
      <details className="fw-card fw-offer-detail-card"><summary>Version history ({workflow.versions.length})</summary>{workflow.versions.map(version=><section key={version.version}><h3>Version {version.version} · {statusLabels[version.status]}</h3><TermSummary version={version}/><p>{version.decisions.length} independent decisions · {version.acknowledgements.length} acknowledgements</p></section>)}</details>
    </>}
  </>;
}

function TermSummary({version}:{version:AgreementVersion}) {
  // The original manual offer permits extra named fields. They are bound into
  // the source hash too, so participants must be able to review their values.
  return <><section className="fw-term-card" aria-label={`Saved terms version ${version.version}`}>{Object.entries(version.content.terms).map(([field,value])=><div className="fw-term-row" key={field}><span>{field.replaceAll("_"," ").replaceAll("."," ")}</span><strong>{value===null?"Unresolved":String(value)}</strong><span className={`fw-state-dot${value===null?" muted":""}`}/></div>)}</section>
    <details className="fw-card fw-offer-detail-card"><summary>Exact saved source fields · revision {version.content.source.version}</summary>{Object.entries(version.content.source.snapshot).map(([field,value])=><div className="fw-list-row" key={field}><span>{field}</span><strong style={{overflowWrap:"anywhere"}}>{String(value)}</strong></div>)}</details></>;
}
