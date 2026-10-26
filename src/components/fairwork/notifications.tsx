"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { appRequest } from "@/features/authority/client";
import { notificationList,notificationReceipt,type Notifications } from "@/features/identity/notifications-schema";
import { categories, essentialCategories, filterNotifications, hiddenFromStorage, STORAGE_KEY, toggleCategory, type NotificationCategory } from "@/features/identity/notification-preferences";
const CATEGORY_LABEL: Record<NotificationCategory, string> = { offers: "Offer revisions", agreements: "Agreement decisions", work: "Work record decisions and integrity events", organization: "Organization decisions", cases: "Case responses and appeals" };
function readHidden(): NotificationCategory[] { try { return hiddenFromStorage(window.localStorage.getItem(STORAGE_KEY)); } catch { return []; } }
export function NotificationFeed(){
 const [data,setData]=useState<Notifications|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const [hidden,setHidden]=useState<NotificationCategory[]>([]);
 useEffect(()=>{const stored=readHidden();const timer=window.setTimeout(()=>setHidden(stored),0);return()=>window.clearTimeout(timer);},[]);
 function choose(category:NotificationCategory,visible:boolean){const next=toggleCategory(hidden,category,visible);setHidden(next);try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{/* the choice still applies for this visit */}}
 useEffect(()=>{let active=true;appRequest("/api/v1/notifications").then(raw=>{if(active)setData(notificationList.parse(raw));}).catch(()=>{if(active)setError("Activity could not be loaded. Retry when signed in and connected.");}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
 async function load(more=false){setBusy(true);setError("");try{const cursor=more?data?.nextCursor:null;const query=cursor?`?${new URLSearchParams({cursorAt:cursor.cursorAt!,cursorKey:cursor.cursorKey!})}`:"";const next=notificationList.parse(await appRequest(`/api/v1/notifications${query}`));setData(old=>more&&old?{...next,items:[...old.items,...next.items]}:next);}catch{setData(null);setError("Activity could not be loaded. Retry when signed in and connected.");}finally{setBusy(false);}}
 async function mark(eventKey:string){setBusy(true);setError("");try{notificationReceipt.parse(await appRequest("/api/v1/notifications",{eventKey}));setData(old=>old?{...old,items:old.items.map(item=>item.eventKey===eventKey?{...item,read:true}:item)}:null);}catch{setData(null);setError("Read status could not be saved. Reload to check access.");}finally{setBusy(false);}}
 const view=data?filterNotifications(data.items,hidden):null;
 return <section aria-label="Account notifications"><p className="fw-page-subtitle">Offer, agreement, work and organization activity</p><p>In-app activity only. Email and push delivery are not connected. Historical approval notices do not establish current authority. Open the related record for its current status.</p>
 <details className="fw-list-card"><summary>Notification preferences (this device)</summary>
  <p>Choose which kinds of activity this feed shows on this device. Hidden activity is still recorded and is never deleted. Case responses and appeals cannot be hidden because missing one could cost you a deadline.</p>
  {categories.map(category=><label className="fw-field" key={category}><span><input type="checkbox" checked={!hidden.includes(category)} disabled={essentialCategories.includes(category)} onChange={event=>choose(category,event.target.checked)}/> {CATEGORY_LABEL[category]}</span></label>)}
 </details>
 {busy&&<p role="status">Loading activity…</p>}{error&&<p role="alert">{error}</p>}
 {data?.items.length===0&&<p>No accessible activity yet.</p>}
 {view&&view.hiddenCount>0&&<p role="status">{view.hiddenCount} item{view.hiddenCount===1?"":"s"} hidden by your preferences.</p>}
 {view?.shown.map(item=><article className="fw-card fw-notification" key={item.eventKey}><div><strong>{item.title}</strong>{item.message&&<p>{item.message}</p>}<p>{new Date(item.recordedAt).toLocaleString()} · {item.read?"Read":"Unread"}</p><Link href={item.href}>Open related record</Link>{!item.read&&<button className="fw-secondary" disabled={busy} onClick={()=>void mark(item.eventKey)}>Mark as read</button>}</div></article>)}
 <button className="fw-secondary" disabled={busy} onClick={()=>void load()}>Refresh activity</button>{data?.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void load(true)}>Load older activity</button>}
 </section>;
}
