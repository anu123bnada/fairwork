"use client";
import { useEffect,useRef,useState } from "react";
import { screenshotDimensions } from "@/features/offer/screenshot-validation";
import { useI18n } from "@/i18n/use-i18n";
import { ExtractionQualityNote } from "./extraction-quality-note";

export function OfferScreenshot({onReviewed}:{onReviewed:(text:string)=>void}){
 const { t } = useI18n();
 const [text,setText]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),sequence=useRef(0);
 function stop(){sequence.current++;worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;}
 useEffect(()=>()=>{sequence.current++;worker.current?.terminate();if(timer.current)clearTimeout(timer.current);},[]);
 async function extract(file:File|undefined){
  stop();setText("");setError("");if(!file){setBusy(false);return;}
  setBusy(true);const current=sequence.current;
  timer.current=setTimeout(()=>{stop();setBusy(false);setError(t("im.shot.timeout"));},45000);
  try{
   if(file.size>5*1024*1024||file.size<8||!["image/png","image/jpeg"].includes(file.type))throw new Error(t("im.shot.badFile"));
   screenshotDimensions(new Uint8Array(await file.arrayBuffer()),file.type);
   const bitmap=await createImageBitmap(file);
   if(current!==sequence.current){bitmap.close();return;}
   const valid=bitmap.width>0&&bitmap.height>0&&bitmap.width*bitmap.height<=12000000;bitmap.close();
   if(!valid)throw new Error(t("im.shot.tooBig"));
   const running=new Worker("/ocr/extract-worker.js");worker.current=running;
   const fail=()=>{if(current!==sequence.current)return;stop();setBusy(false);setError(t("im.shot.unavailable"));};
   running.onerror=fail;
   running.onmessage=event=>{
    if(current!==sequence.current)return;stop();setBusy(false);
    if(typeof event.data?.text==="string"&&event.data.text.length<=10000)setText(event.data.text);
    else setError(t("im.shot.noText"));
   };
   running.postMessage(file);
  }catch(caught){if(current!==sequence.current)return;stop();setBusy(false);setError(caught instanceof Error?caught.message:t("im.shot.openFail"));}
 }
 return <section className="fw-card fw-source-panel" aria-label={t("im.shot.aria")}>
  <h3>{t("im.shot.title")}</h3>
  <p>{t("im.shot.intro")}</p>
  <label className="fw-field">{t("im.shot.file")}<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event=>{void extract(event.target.files?.[0]);event.target.value="";}}/></label>
  {busy&&<><p role="status">{t("im.reading")}</p><button type="button" className="fw-secondary" onClick={()=>{stop();setBusy(false);setText("");}}>{t("im.shot.cancel")}</button></>}
  {error&&<p role="alert">{error}</p>}
  {text&&<><ExtractionQualityNote text={text} source="ocr"/><label className="fw-field">{t("im.review")}<textarea value={text} maxLength={10000} onChange={event=>setText(event.target.value)}/></label><p>{t("im.removePersonal")}</p><button type="button" className="fw-primary" disabled={!text.trim()} onClick={()=>onReviewed(text)}>{t("im.shot.use")}</button></>}
 </section>;
}
