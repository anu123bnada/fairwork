"use client";
import { useEffect,useRef,useState } from "react";
import { screenshotDimensions } from "@/features/offer/screenshot-validation";

export function OfferScreenshot({onReviewed}:{onReviewed:(text:string)=>void}){
 const [text,setText]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),sequence=useRef(0);
 function stop(){sequence.current++;worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;}
 useEffect(()=>()=>{sequence.current++;worker.current?.terminate();if(timer.current)clearTimeout(timer.current);},[]);
 async function extract(file:File|undefined){
  stop();setText("");setError("");if(!file){setBusy(false);return;}
  setBusy(true);const current=sequence.current;
  timer.current=setTimeout(()=>{stop();setBusy(false);setError("Reading timed out. Try a smaller image or enter the terms manually.");},45000);
  try{
   if(file.size>5*1024*1024||file.size<8||!["image/png","image/jpeg"].includes(file.type))throw new Error("Choose a PNG or JPEG screenshot under 5 MB. PDF and SVG are not supported.");
   screenshotDimensions(new Uint8Array(await file.arrayBuffer()),file.type);
   const bitmap=await createImageBitmap(file);
   if(current!==sequence.current){bitmap.close();return;}
   const valid=bitmap.width>0&&bitmap.height>0&&bitmap.width*bitmap.height<=12000000;bitmap.close();
   if(!valid)throw new Error("Choose an image no larger than 12 megapixels.");
   const running=new Worker("/ocr/extract-worker.js");worker.current=running;
   const fail=()=>{if(current!==sequence.current)return;stop();setBusy(false);setError("Local image reader unavailable. Retry or enter the terms manually.");};
   running.onerror=fail;
   running.onmessage=event=>{
    if(current!==sequence.current)return;stop();setBusy(false);
    if(typeof event.data?.text==="string"&&event.data.text.length<=10000)setText(event.data.text);
    else setError("Text could not be read. Try a clearer English screenshot or enter the terms manually.");
   };
   running.postMessage(file);
  }catch(caught){if(current!==sequence.current)return;stop();setBusy(false);setError(caught instanceof Error?caught.message:"Image could not be opened.");}
 }
 return <section className="fw-card fw-source-panel" aria-label="Local screenshot reader">
  <h3>Read a screenshot on this device</h3>
  <p>Printed English text only. Your image stays on this device and is not saved or uploaded. Text recognition can make mistakes; review it before continuing. This is OCR, not live AI analysis.</p>
  <label className="fw-field">Offer screenshot<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event=>{void extract(event.target.files?.[0]);event.target.value="";}}/></label>
  {busy&&<><p role="status">Reading on this device…</p><button type="button" className="fw-secondary" onClick={()=>{stop();setBusy(false);setText("");}}>Cancel reading</button></>}
  {error&&<p role="alert">{error}</p>}
  {text&&<><label className="fw-field">Review extracted text<textarea value={text} maxLength={10000} onChange={event=>setText(event.target.value)}/></label><p>Remove personal details you do not need. Continuing fills the text draft only; saving terms and any optional AI consent are separate actions.</p><button type="button" className="fw-primary" disabled={!text.trim()} onClick={()=>onReviewed(text)}>Use reviewed text</button></>}
 </section>;
}
