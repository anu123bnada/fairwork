"use client";
import { useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { assessOfferTerms, savedAssessmentSchema, type assessmentSchema } from "@/features/offer/assessment";
import type { z } from "zod";
import { AnalysisHistory } from "./analysis-history";
import { JurisdictionCheck } from "./jurisdiction-check";
import { localizeAssessment, statusLabel } from "@/features/offer/localize-text";
import { useI18n } from "@/i18n/use-i18n";

export function OfferAssessment({offerId,version,termHash,hoursPerWeek}:{offerId:string;version:number;termHash:string;hoursPerWeek?:unknown}) {
 const { t } = useI18n();
 const [result,setResult]=useState<z.infer<typeof savedAssessmentSchema>|null>(null);
 const [error,setError]=useState("");const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;
  appRequest(`/api/v1/offers/assessment?offerId=${encodeURIComponent(offerId)}`).then(raw=>{
   const parsed=savedAssessmentSchema.parse(raw);
   if(parsed.offerId!==offerId||parsed.offerVersion!==version||parsed.termHash!==termHash)throw new Error(t("as.changed"));
   if(active)setResult(parsed);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:t("as.unavailable"));});
  return()=>{active=false;};
 },[offerId,version,termHash,attempt,t]);
 const assessment=result?.offerId===offerId&&result.offerVersion===version&&result.termHash===termHash?result.assessment:null;
 return <section className="fw-list-card" aria-label={t("as.aria")}>
  <h3>{t("as.aria")}</h3>
  {error?<><p role="alert">{error}</p><button type="button" className="fw-secondary" onClick={()=>{setError("");setResult(null);setAttempt(n=>n+1);}}>{t("as.retry")}</button></>:!assessment?<p role="status">{t("as.loading")}</p>:<><AssessmentDetails assessment={assessment} basis={t("as.basisRevision",{n:version})} /><AnalysisHistory offerId={offerId} version={version} termHash={termHash} /><JurisdictionCheck hoursPerWeek={hoursPerWeek} /></>}
 </section>;
}

export function DraftOfferAssessment({terms}:{terms:Record<string,string>}) {
 const { t } = useI18n();
 const context=JSON.stringify(terms);
 const [result,setResult]=useState<{context:string;assessment:z.infer<typeof assessmentSchema>}|null>(null);
 return <section className="fw-list-card" aria-label={t("as.draftAria")}>
  <h3>{t("as.draftTitle")}</h3>
  <p>{t("as.draftIntro")}</p>
  <button type="button" className="fw-secondary" disabled={!Object.values(terms).some(value=>value.trim())} onClick={()=>setResult({context,assessment:assessOfferTerms(terms)})}>{t("as.draftButton")}</button>
  {result?.context===context?<AssessmentDetails assessment={result.assessment} basis={t("as.basisDraft")} />:result&&<p role="status">{t("as.draftChanged")}</p>}
 </section>;
}

export function AssessmentDetails({assessment:engine,basis}:{assessment:z.infer<typeof assessmentSchema>;basis:string}) {
 const { t } = useI18n();
 const assessment=localizeAssessment(engine,t);
 return <>
   <p><strong>{assessment.score}/100</strong> {t("as.scoreRest",{basis})}</p>
   <p>{assessment.meaning}</p>
   <p>{t("as.counts",{stated:assessment.statedCount,missing:assessment.missingCount,uncertain:assessment.uncertainCount,concern:assessment.concernCount})}</p>
   {assessment.categories.map(category=><div className="fw-list-row" key={category.label}><span>{category.label}</span><span>{category.score}/{category.maximum}</span><meter min={0} max={category.maximum} value={category.score} aria-label={category.label} /></div>)}
   <p>{t("as.employerNote")}</p>
   <details><summary>{t("as.detailsSummary")}</summary>{assessment.items.map(item=><article className="fw-question-card" key={item.id}><h4>{t("as.itemTitle",{label:item.label,points:item.points,status:statusLabel(item.status,t)})}</h4>{item.evidence!==null&&<blockquote style={{overflowWrap:"anywhere"}}>{item.evidence}</blockquote>}<p>{item.explanation}</p><p>{item.recommendation}</p></article>)}</details>
   <p>{assessment.limitations}</p><small>{t("as.engine",{version:assessment.version})}</small>
 </>;
}
