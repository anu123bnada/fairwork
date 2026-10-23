"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { appRequest } from "@/features/authority/client";
import { notificationList,notificationReceipt,type Notifications } from "@/features/identity/notifications-schema";
export function NotificationFeed(){
 const [data,setData]=useState<Notifications|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;appRequest("/api/v1/notifications").then(raw=>{if(active)setData(notificationList.parse(raw));}).catch(()=>{if(active)setError("Activity could not be loaded. Retry when signed in and connected.");}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
 async function load(more=false){setBusy(true);setError("");try{const cursor=more?data?.nextCursor:null;const query=cursor?`?${new URLSearchParams({cursorAt:cursor.cursorAt!,cursorKey:cursor.cursorKey!})}`:"";const next=notificationList.parse(await appRequest(`/api/v1/notifications${query}`));setData(old=>more&&old?{...next,items:[...old.items,...next.items]}:next);}catch{setData(null);setError("Activity could not be loaded. Retry when signed in and connected.");}finally{setBusy(false);}}
 async function mark(eventKey:string){setBusy(true);setError("");try{notificationReceipt.parse(await appRequest("/api/v1/notifications",{eventKey}));setData(old=>old?{...old,items:old.items.map(item=>item.eventKey===eventKey?{...item,read:true}:item)}:null);}catch{setData(null);setError("Read status could not be saved. Reload to check access.");}finally{setBusy(false);}}
 return <section aria-label="Account notifications"><p className="fw-page-subtitle">Offer, agreement, work and organization activity</p><p>In-app activity only. Email and push delivery are not connected. Historical approval notices do not establish current authority. Open the related record for its current status.</p>
 {busy&&<p role="status">Loading activity…</p>}{error&&<p role="alert">{error}</p>}
 {data?.items.length===0&&<p>No accessible activity yet.</p>}
 {data?.items.map(item=><article className="fw-card fw-notification" key={item.eventKey}><div><strong>{item.title}</strong>{item.message&&<p>{item.message}</p>}<p>{new Date(item.recordedAt).toLocaleString()} · {item.read?"Read":"Unread"}</p><Link href={item.href}>Open related record</Link>{!item.read&&<button className="fw-secondary" disabled={busy} onClick={()=>void mark(item.eventKey)}>Mark as read</button>}</div></article>)}
 <button className="fw-secondary" disabled={busy} onClick={()=>void load()}>Refresh activity</button>{data?.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void load(true)}>Load older activity</button>}
 </section>;
}
