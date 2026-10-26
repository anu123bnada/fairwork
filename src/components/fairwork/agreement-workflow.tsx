"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { appRequest, ApiRequestError } from "@/features/authority/client";
import { workflowCommandSchema, workflowReadSchema, type AgreementWorkflow, type AgreementVersion } from "@/features/offer/workflow-schema";
import { participantWorkflowId } from "@/features/offer/participant-path";
import { agreementReadSchema } from "@/features/offer/read-schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";

export function CreateVersionedAgreement({ offerId, version, termHash, representativeId }: { offerId:string;version:number;termHash:string;representativeId?:string|null }) {
  const { t } = useI18n();
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
    } catch(caught) {setError(caught instanceof ApiRequestError?caught.message:t("ag.create.error"));}
    finally {setBusy(false);}
  }
  return <details className="fw-card fw-offer-detail-card"><summary>{t("ag.create.summary")}</summary>
    <p>{t("ag.create.intro")}</p>
    <form onSubmit={event=>void create(event)}>
      <label className="fw-field">{t("ag.create.rep")}<input required value={representative} onChange={event=>setRepresentative(event.target.value)} pattern={"[0-9a-fA-F\\-]{36}"} /></label>
      <p className="fw-notice">{t("ag.create.repNote")}</p>
      <button className="fw-secondary" disabled={busy}>{busy?t("ag.create.saving"):t("ag.create.button")}</button>
      {error&&<p role="alert" className="fw-error">{error}</p>}
    </form>
  </details>;
}

const statusKey=(status:AgreementVersion["status"])=>`ag.st.${status}` as MessageKey;

export function AgreementWorkflowScreen({ actorId }: { actorId:string }) {
  const { t } = useI18n();
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
      if(token===generation.current){
        setWorkflow(next);setSelectedId(next.agreementId);
        // Keep an authorized manual lookup recoverable after refresh or sign-in.
        window.history.replaceState(null,"",`/app/agreement-workflow?workflowId=${next.agreementId}`);
      }
    }catch(caught){if(token===generation.current){setWorkflow(null);setError(caught instanceof Error?caught:new Error(t("ag.loadError")));}}
    finally{if(token===generation.current)setBusy(false);}
  },[t]);
  useEffect(()=>{
    const id=participantWorkflowId(window.location.search);
    let active=true;
    if(id) void appRequest(`/api/v1/agreement-workflows?agreementId=${encodeURIComponent(id)}`)
      .then(data=>{if(active){setWorkflow(workflowReadSchema.parse(data));setSelectedId(id);}})
      .catch(caught=>{if(active)setError(caught instanceof Error?caught:new Error(t("ag.loadError")));})
      .finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[t]);
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
    }catch(caught){setError(caught instanceof Error?caught:new Error(t("ag.actionError")));}
    finally{setBusy(false);}
  }
  return <>
    <h2 className="fw-page-title">{t("ag.title")}</h2>
    <p className="fw-page-subtitle">{t("ag.subtitle")}</p>
    <p className="fw-notice">{t("ag.notSignature")}</p>
    {busy&&<p role="status" className="fw-notice">{t("ag.verifying")}</p>}
    {error&&<div className="fw-error" role="alert"><p>{error instanceof ApiRequestError?error.message:t("ag.loadFailed")}</p>
      {error instanceof ApiRequestError&&error.code==="AUTH_REQUIRED"?<Link href={`/sign-in?workflowId=${selectedId}`}>{t("ag.signIn")}</Link>:<button className="fw-secondary" disabled={busy||!selectedId} onClick={()=>void load(selectedId)}>{t("ag.reloadAuth")}</button>}
    </div>}
    {!workflow&&!busy&&<form className="fw-card fw-offer-detail-card" onSubmit={event=>{event.preventDefault();setSelectedId(openId);void load(openId);}}>
      <label className="fw-field">{t("ag.idLabel")}<input value={openId} onChange={event=>setOpenId(event.target.value)} required pattern={"[0-9a-fA-F\\-]{36}"} /></label><button className="fw-secondary">{t("ag.openById")}</button>
    </form>}
    {workflow&&<>
      <p className="fw-notice">{t("ag.designated")}: {workflow.workerId}<br/>{t("ag.employerRep")}: {workflow.representativeId}</p>
      {!current&&<p className="fw-notice">{t("ag.preparing")}</p>}
      {effective&&effective.version!==current?.version&&<section className="fw-card fw-offer-detail-card" aria-label={t("ag.effectiveAria")}><strong>{t("ag.lastConfirmed",{version:effective.version})}</strong><p>{t("ag.lastConfirmedNote")}</p><TermSummary version={effective}/></section>}
      {current&&<>
        <p className={current.status==="effective"?"fw-success":"fw-notice"} role="status">{t("ag.versionLine",{version:current.version,status:t(statusKey(current.status))})}</p>
        <div className="fw-signatures">{[{id:workflow.workerId,label:t("ag.worker")},{id:workflow.representativeId,label:t("ag.employer")}].map(party=><div className="fw-signature" key={party.id}><span className="fw-signature-avatar" aria-hidden="true">{party.label[0]}</span><span><strong>{party.label}</strong><br/>{current.decisions.find(d=>d.actorId===party.id)?.decision==="confirm"?t("ag.confirmed"):current.decisions.find(d=>d.actorId===party.id)?.decision==="decline"?t("ag.declinedParty"):current.acknowledgements.some(a=>a.actorId===party.id)?t("ag.ackedNotConfirmed"):t("ag.awaitingAck")}</span></div>)}</div>
        <TermSummary version={current}/>
        <section className="fw-card fw-offer-detail-card" aria-label={t("ag.unresolvedAria")}><h3>{t("ag.unresolvedTitle")}</h3>
          <p>{t("ag.unresolvedNote")}</p>
          {current.content.unresolved.map(item=><label className="fw-field" key={item.itemId}><span>{item.fieldId}</span><span>{item.explanation}</span>
            <span><input type="checkbox" aria-label={t("ag.ackItem",{field:item.fieldId})} disabled={busy||Boolean(mine)||current.state!=="proposed"||current.status==="revision_conflict"} checked={Boolean(mine)||checked.includes(item.itemId)} onChange={event=>setChecked(previous=>event.target.checked?[...previous,item.itemId]:previous.filter(id=>id!==item.itemId))}/> {t("ag.understand")}</span>
          </label>)}
          {!current.unresolvedIds.length&&<p>{t("ag.noUnresolved")}</p>}
          {current.state==="proposed"&&!mine&&<button className="fw-secondary" disabled={busy||current.status==="revision_conflict"||checked.length!==current.unresolvedIds.length} onClick={()=>void send("acknowledge")}>{t("ag.recordAck")}</button>}
        </section>
        <section className="fw-card fw-offer-detail-card"><h3>{t("ag.qaTitle")}</h3>
          {!current.content.sharedQuestions.length&&<p>{t("ag.noQuestions")}</p>}
          {current.content.sharedQuestions.map(q=>{const answer=current.content.answers.find(a=>a.questionId===q.id);return <div className="fw-list-row" key={q.id}><span>{q.question}</span><strong>{answer?t("ag.answerRecorded",{answer:answer.answer,by:answer.answeredBy===workflow.workerId?t("ag.byWorker"):t("ag.byRep"),date:new Date(answer.answeredAt).toLocaleString()}):t("ag.noAnswer")}</strong></div>;})}
          <p>{t("ag.answersNote")}</p>
        </section>
        {worker&&current.state==="draft"&&<section className="fw-card fw-offer-detail-card">
          <label><input type="checkbox" checked={shareChecked} onChange={event=>setShareChecked(event.target.checked)}/> {t("ag.shareLabel",{count:current.content.sharedQuestions.length})}</label>
          <button className="fw-primary" disabled={busy||!shareChecked||current.status!=="ready_for_review"} onClick={()=>void send("propose")}>{t("ag.propose")}</button>
          {current.status==="awaiting_answers"&&<Link href={`/app/questions?offerId=${current.content.source.offerId}`}>{t("ag.recordAnswers")}</Link>}
        </section>}
        {current.state==="proposed"&&!decision&&<div className="fw-card fw-offer-detail-card">
          <button className="fw-primary" disabled={busy||!mine||current.status==="revision_conflict"} onClick={()=>void send("confirm")}>{t("ag.confirmExact")}</button>
          <button className="fw-secondary" disabled={busy||current.status==="revision_conflict"} onClick={()=>void send("decline")}>{t("ag.decline")}</button>
        </div>}
        {worker&&<details className="fw-card fw-offer-detail-card"><summary>{t("ag.amendSummary")}</summary><p>{t("ag.amendNote")}</p>
          <Link href={`/app/add-offer?offerId=${current.content.source.offerId}`}>{t("ag.editSource")}</Link>
          <button className="fw-secondary" disabled={busy} onClick={()=>void send("amend")}>{t("ag.freezeLatest")}</button>
        </details>}
        <details className="fw-card fw-offer-detail-card"><summary>{t("ag.receipt")}</summary><p>{t("ag.receiptLine",{revision:current.content.source.version,date:new Date(current.createdAt).toLocaleString()})}</p><p style={{overflowWrap:"anywhere"}}>Content SHA-256: {current.contentHash}</p><p style={{overflowWrap:"anywhere"}}>Item-set SHA-256: {current.itemSetHash}</p>{current.decisions.map(receipt=><p key={receipt.actorId}>{t("ag.receiptDecision",{actor:receipt.actorId,decision:receipt.decision,date:new Date(receipt.recordedAt).toLocaleString()})}</p>)}</details>
      </>}
      <section className="fw-card fw-offer-detail-card"><label className="fw-field">{t("ag.linkLabel")}<input readOnly value={`/app/agreement-workflow?workflowId=${workflow.agreementId}`} onFocus={event=>event.target.select()}/></label><p>{t("ag.linkNote")}</p><button className="fw-secondary" disabled={busy} onClick={()=>void load(workflow.agreementId)}>{t("ag.reloadSaved")}</button></section>
      {worker&&effective&&<Link className="fw-dark-button" href={`/app/work-record?agreementBasisId=${workflow.agreementId}`}>{t("ag.openWork")}</Link>}
      <details className="fw-card fw-offer-detail-card"><summary>{t("ag.history",{count:workflow.versions.length})}</summary>{workflow.versions.map(version=><section key={version.version}><h3>{t("ag.versionLine",{version:version.version,status:t(statusKey(version.status))})}</h3><TermSummary version={version}/><p>{t("ag.versionCounts",{decisions:version.decisions.length,acks:version.acknowledgements.length})}</p></section>)}</details>
    </>}
  </>;
}

function TermSummary({version}:{version:AgreementVersion}) {
  const { t } = useI18n();
  // The original manual offer permits extra named fields. They are bound into
  // the source hash too, so participants must be able to review their values.
  return <><section className="fw-term-card" aria-label={t("ag.termsAria",{version:version.version})}>{Object.entries(version.content.terms).map(([field,value])=><div className="fw-term-row" key={field}><span>{field.replaceAll("_"," ").replaceAll("."," ")}</span><strong>{value===null?t("ag.unresolvedValue"):String(value)}</strong><span className={`fw-state-dot${value===null?" muted":""}`}/></div>)}</section>
    <details className="fw-card fw-offer-detail-card"><summary>{t("ag.exactFields",{revision:version.content.source.version})}</summary>{Object.entries(version.content.source.snapshot).map(([field,value])=><div className="fw-list-row" key={field}><span>{field}</span><strong style={{overflowWrap:"anywhere"}}>{String(value)}</strong></div>)}</details></>;
}
