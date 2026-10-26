"use client";
import { useEffect,useRef,useState,type FormEvent } from "react";
import { z } from "zod";
import { appRequest } from "@/features/authority/client";
import { passportSchema,type Passport } from "@/features/work/passport-schema";
import { shareField,shareList,shareProjection,shareReceipt } from "@/features/work/sharing-schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
const endpoint="/api/v1/passport/sharing";
const display=(value:string)=>value.replaceAll("_"," ");
export function PassportSharing(){
 const { t } = useI18n();
 const labelOf=(field:string)=>t(`sh.f.${field}` as MessageKey);
 const [passport,setPassport]=useState<Passport|null>(null),[list,setList]=useState<z.infer<typeof shareList>|null>(null);
 const [projection,setProjection]=useState<z.infer<typeof shareProjection>|null>(null),[preview,setPreview]=useState(false),[reviewed,setReviewed]=useState(false);
 const [fields,setFields]=useState<z.infer<typeof shareField>[]>(["task_summary","verification_status"]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const pending=useRef(new Map<string,{itemId:string;grantId:string}>());
 useEffect(()=>{
  let active=true;
  Promise.all([appRequest("/api/v1/passport"),appRequest(endpoint)]).then(([p,l])=>{if(active){setPassport(passportSchema.parse(p));setList(shareList.parse(l));}}).catch(e=>{if(active)setError(e.message);});
  const grantId=new URLSearchParams(window.location.search).get("grantId");
  if(grantId&&z.uuid().safeParse(grantId).success)appRequest(`${endpoint}?grantId=${grantId}&mode=recipient`).then(p=>{if(active){setProjection(shareProjection.parse(p));setPreview(false);}}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[]);
 async function refresh(cursor:string|null=null){setList(shareList.parse(await appRequest(endpoint+(cursor?`?cursor=${cursor}`:""))));}
 async function perform(action:()=>Promise<void>){setBusy(true);setError("");setMessage("");try{await action();}catch(e){setProjection(null);setList(null);setPassport(null);setError(e instanceof Error?e.message:t("sh.unavailable"));}finally{setBusy(false);}}
 async function records(cursor:string|null){setPassport(null);setProjection(null);setReviewed(false);setPassport(passportSchema.parse(await appRequest("/api/v1/passport"+(cursor?`?cursor=${cursor}`:""))));}
 async function open(grantId:string,owner:boolean){setProjection(null);setReviewed(false);setPreview(owner);setProjection(shareProjection.parse(await appRequest(`${endpoint}?grantId=${grantId}&mode=${owner?"preview":"recipient"}`)));}
 async function prepare(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const data=new FormData(event.currentTarget);const entry=passport?.entries.find(item=>item.workId===data.get("workId"));if(!entry)return;
  await perform(async()=>{
   const expiresAt=new Date(String(data.get("expiresAt"))).toISOString();
   const fingerprint=JSON.stringify([entry.workId,entry.version,data.get("summary"),data.get("recipientId"),expiresAt,fields]);
   let ids=pending.current.get(fingerprint);if(!ids){ids={itemId:crypto.randomUUID(),grantId:crypto.randomUUID()};pending.current.set(fingerprint,ids);}
   shareReceipt.parse(await appRequest(endpoint,{operation:"select",itemId:ids.itemId,workId:entry.workId,workVersion:entry.version,summary:data.get("summary"),fields}));
   shareReceipt.parse(await appRequest(endpoint,{operation:"prepare",grantId:ids.grantId,itemId:ids.itemId,recipientId:data.get("recipientId"),expiresAt,fields}));
   await open(ids.grantId,true);await refresh();setMessage(t("sh.previewPrepared"));
  });
 }
 async function command(body:unknown){shareReceipt.parse(await appRequest(endpoint,body));setProjection(null);setReviewed(false);await refresh();}
 return <div aria-label={t("sh.aria")}>
  <p className="fw-disclaimer">{t("sh.disclaimer")}</p>
  {passport?.passportId&&passport.entries.length>0&&<form onSubmit={event=>void prepare(event)}>
   <label className="fw-field">{t("sh.record")}<select name="workId">{passport.entries.map(entry=><option value={entry.workId} key={entry.workId}>{t("sh.recordOption",{role:entry.role,end:entry.periodEnd,version:entry.version})}</option>)}</select></label>
   <p>{t("sh.pageNote")}</p>
   <label className="fw-field">{t("sh.summary")}<textarea name="summary" required maxLength={240}/></label>
   <p>{t("sh.summaryNote")}</p>
   <label className="fw-field">{t("sh.recipient")}<input name="recipientId" required pattern="[0-9a-fA-F-]{36}"/></label>
   <label className="fw-field">{t("sh.expires")}<input name="expiresAt" type="datetime-local" required/></label>
   {shareField.options.map(field=><div className="fw-list-row" key={field}><span>{labelOf(field)}</span><button type="button" className="fw-switch" role="switch" aria-checked={fields.includes(field)} aria-label={labelOf(field)} onClick={()=>{setFields(old=>old.includes(field)?old.filter(f=>f!==field):[...old,field]);setProjection(null);setReviewed(false);}}><span/></button></div>)}
   <button className="fw-primary" disabled={busy||fields.length===0}>{t("sh.prepare")}</button>
  </form>}
  {passport&&(!passport.passportId||passport.entries.length===0)&&<p>{t("sh.noEligible")}</p>}
  <button className="fw-secondary" disabled={busy} onClick={()=>void perform(()=>records(null))}>{t("sh.reloadRecords")}</button>
  {passport?.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void perform(()=>records(passport.nextCursor))}>{t("sh.nextRecords")}</button>}
  {projection&&<section className="fw-list-card" aria-label={preview?t("sh.ownerPreview"):t("sh.recipientProjection")}>
   <h3>{preview?t("sh.exactPreview"):t("sh.sharedRecord")}</h3><p>{t("sh.expiresLine",{date:new Date(projection.expiresAt).toLocaleString()})}</p>
   <p>{t("sh.recheck")}</p>
   {projection.entries.map((entry,index)=><dl key={index}>{Object.entries(entry).map(([field,value])=><div key={field}><dt>{labelOf(field)}</dt><dd>{field==="task_summary"?t("sh.ownerWritten",{value:String(value)}):display(value)}</dd></div>)}</dl>)}
   {!projection.entries.length&&<p>{t("sh.noFields")}</p>}
   {preview&&!projection.active&&projection.entries.length>0&&<><label className="fw-field"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>{t("sh.inspected")}</label><button className="fw-primary" disabled={busy||!reviewed} onClick={()=>void perform(async()=>{const id=projection.grantId;await command({operation:"activate",grantId:id});await open(id,true);setMessage(t("sh.activated"));})}>{t("sh.activate")}</button></>}
   {preview&&projection.active&&<button className="fw-secondary" disabled={busy} onClick={()=>void perform(async()=>{await navigator.clipboard.writeText(`${window.location.origin}/app/share?grantId=${projection.grantId}`);setMessage(t("sh.linkCopied"));})}>{t("sh.copyLink")}</button>}
  </section>}
  <h3>{t("sh.grants")}</h3>
  {!list&&!error&&<p role="status">{t("sh.loadingGrants")}</p>}
  {list?.items.length===0&&<p>{t("sh.noGrants")}</p>}
  {list?.items.map(grant=><article className="fw-list-card" key={grant.grantId}>
   <p>{grant.owner?t("sh.owned"):t("sh.received")} · {grant.revoked?t("sh.revoked"):new Date(grant.expiresAt)<=new Date()?t("sh.expired"):grant.active?t("sh.active"):t("sh.draft")}</p>
   {grant.owner&&<p style={{overflowWrap:"anywhere"}}>{t("sh.recipientLine",{id:grant.recipientId??""})}</p>}
   <p>{t("sh.expiresLine",{date:new Date(grant.expiresAt).toLocaleString()})}</p>
   {!grant.revoked&&new Date(grant.expiresAt)>new Date()&&<button className="fw-secondary" disabled={busy} onClick={()=>void perform(()=>open(grant.grantId,grant.owner))}>{grant.owner?t("sh.previewGrant"):t("sh.readShared")}</button>}
   {grant.owner&&!grant.revoked&&<button className="fw-secondary" disabled={busy} onClick={()=>void perform(()=>command({operation:"revoke",grantId:grant.grantId}))}>{t("sh.revoke")}</button>}
   {grant.owner&&grant.itemId&&<details><summary>{t("sh.narrow")}</summary><p>{t("sh.narrowNote")}</p>{shareField.options.map(field=><button className="fw-secondary" disabled={busy} key={field} onClick={()=>void perform(()=>command({operation:"remove_field",itemId:grant.itemId,field}))}>{t("sh.removeField",{field:labelOf(field)})}</button>)}<button className="fw-secondary" disabled={busy} onClick={()=>void perform(()=>command({operation:"remove",itemId:grant.itemId}))}>{t("sh.removeAll")}</button></details>}
  </article>)}
  <button className="fw-secondary" disabled={busy} onClick={()=>void perform(async()=>{setProjection(null);setList(null);await refresh();})}>{t("sh.refresh")}</button>
  {list?.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void perform(()=>refresh(list.nextCursor))}>{t("sh.nextGrants")}</button>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </div>;
}
