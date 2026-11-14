"use client";
import { useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { assessOfferTerms, savedAssessmentSchema, type assessmentSchema } from "@/features/offer/assessment";
import type { z } from "zod";
import { AnalysisHistory } from "./analysis-history";
import { JurisdictionCheck } from "./jurisdiction-check";
import { localizeAssessment, statusLabel } from "@/features/offer/localize-text";
import { useI18n } from "@/i18n/use-i18n";
import { userMessage } from "@/lib/user-error";

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
  }).catch(e=>{if(active)setError(userMessage(e, t("as.unavailable")));});
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

function AssessmentDetails({assessment:engine,basis}:{assessment:z.infer<typeof assessmentSchema>;basis:string}) {
 const { t } = useI18n();
 const assessment=localizeAssessment(engine,t);
 const card=(item:typeof assessment.items[number])=><article className={`fw-question-card ui-finding is-${item.status}`} key={item.id}><h4>{t("as.itemTitle",{label:item.label,points:item.points,status:statusLabel(item.status,t)})}</h4>{item.evidence!==null&&<blockquote style={{overflowWrap:"anywhere"}}>{item.evidence}</blockquote>}<p>{item.explanation}</p><p className="ui-finding-next">{item.recommendation}</p></article>;
 const attention=(["concern","missing","uncertain"] as const).map(status=>({status,items:assessment.items.filter(item=>item.status===status)})).filter(group=>group.items.length>0);
 const stated=assessment.items.filter(item=>item.status==="stated");
 return <div className="ui-assess">
   <div className="ui-assess-hero">
     <div className="ui-assess-score" role="img" aria-label={`${assessment.score}/100`} style={{["--ui-score" as string]:`${Math.max(0,Math.min(100,assessment.score))}%`}}><strong>{assessment.score}</strong><span>/100</span></div>
     <div className="ui-assess-summary"><p><strong>{t("as.scoreRest",{basis})}</strong></p><p>{assessment.meaning}</p></div>
   </div>
   <p className="ui-assess-counts">{t("as.counts",{stated:assessment.statedCount,missing:assessment.missingCount,uncertain:assessment.uncertainCount,concern:assessment.concernCount})}</p>
   <div className="ui-assess-cats">{assessment.categories.map(category=><div className="ui-assess-cat" key={category.label}><span>{category.label}</span><span>{category.score}/{category.maximum}</span><meter min={0} max={category.maximum} value={category.score} aria-label={category.label} /></div>)}</div>
   {attention.map(group=><section className={`ui-assess-group is-${group.status}`} key={group.status} aria-label={statusLabel(group.status,t)}><p className="ui-assess-group-title">{statusLabel(group.status,t)} <span>{group.items.length}</span></p><ul className="ui-assess-chips">{group.items.map(item=><li key={item.id}>{item.label}</li>)}</ul></section>)}
   <details className="ui-assess-stated"><summary>{t("as.detailsSummary")}</summary>{[...attention.flatMap(group=>group.items),...stated].map(card)}</details>
   <p className="ui-assess-note">{t("as.employerNote")}</p>
   <p className="ui-assess-note">{assessment.limitations}</p><small>{t("as.engine",{version:assessment.version})}</small>
 </div>;
}
