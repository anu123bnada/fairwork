"use client";
import { useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { assessOfferTerms, savedAssessmentSchema, type assessmentSchema } from "@/features/offer/assessment";
import type { z } from "zod";
import { AnalysisHistory } from "./analysis-history";

export function OfferAssessment({offerId,version,termHash}:{offerId:string;version:number;termHash:string}) {
 const [result,setResult]=useState<z.infer<typeof savedAssessmentSchema>|null>(null);
 const [error,setError]=useState("");const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;
  appRequest(`/api/v1/offers/assessment?offerId=${encodeURIComponent(offerId)}`).then(raw=>{
   const parsed=savedAssessmentSchema.parse(raw);
   if(parsed.offerId!==offerId||parsed.offerVersion!==version||parsed.termHash!==termHash)throw new Error("This offer changed. Reopen the saved offer before viewing its assessment.");
   if(active)setResult(parsed);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Assessment unavailable.");});
  return()=>{active=false;};
 },[offerId,version,termHash,attempt]);
 const assessment=result?.offerId===offerId&&result.offerVersion===version&&result.termHash===termHash?result.assessment:null;
 return <section className="fw-list-card" aria-label="Offer fairness indicators">
  <h3>Offer fairness indicators</h3>
  {error?<><p role="alert">{error}</p><button type="button" className="fw-secondary" onClick={()=>{setError("");setResult(null);setAttempt(n=>n+1);}}>Retry assessment</button></>:!assessment?<p role="status">Loading assessment of saved terms…</p>:<><AssessmentDetails assessment={assessment} basis={`Revision ${version}`} /><AnalysisHistory offerId={offerId} version={version} termHash={termHash} /></>}
 </section>;
}

export function DraftOfferAssessment({terms}:{terms:Record<string,string>}) {
 const context=JSON.stringify(terms);
 const [result,setResult]=useState<{context:string;assessment:z.infer<typeof assessmentSchema>}|null>(null);
 return <section className="fw-list-card" aria-label="Draft offer indicators">
  <h3>Review this draft locally</h3>
  <p>Review the fields above, then check clarity and protection indicators before saving. This uses local rules, not AI. No linked organization is needed for this unsaved preview; saving still requires server authorization.</p>
  <button type="button" className="fw-secondary" disabled={!Object.values(terms).some(value=>value.trim())} onClick={()=>setResult({context,assessment:assessOfferTerms(terms)})}>Check draft indicators</button>
  {result?.context===context?<AssessmentDetails assessment={result.assessment} basis="Unsaved draft · Local rules" />:result&&<p role="status">Fields changed. Check the draft again for an updated result.</p>}
 </section>;
}

function AssessmentDetails({assessment,basis}:{assessment:z.infer<typeof assessmentSchema>;basis:string}) {
 return <>
   <p><strong>{assessment.score}/100</strong> · Reviewed-term indicators · {basis}</p>
   <p>{assessment.meaning}</p>
   <p>{assessment.statedCount} stated · {assessment.missingCount} missing · {assessment.uncertainCount} uncertain · {assessment.concernCount} explicit concerns</p>
   {assessment.categories.map(category=><div className="fw-list-row" key={category.label}><span>{category.label}</span><span>{category.score}/{category.maximum}</span><meter min={0} max={category.maximum} value={category.score} aria-label={category.label} /></div>)}
   <p>Employer verification: not assessed by this score. Organization evidence and authorization must be reviewed separately. AI suggestions never change this score automatically.</p>
   <details><summary>Evidence, deductions and next steps</summary>{assessment.items.map(item=><article className="fw-question-card" key={item.id}><h4>{item.label}: {item.points}/5 · {item.status}</h4>{item.evidence!==null&&<blockquote style={{overflowWrap:"anywhere"}}>{item.evidence}</blockquote>}<p>{item.explanation}</p><p>{item.recommendation}</p></article>)}</details>
   <p>{assessment.limitations}</p><small>Scoring engine: {assessment.version}</small>
 </>;
}
