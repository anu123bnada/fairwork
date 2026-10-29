"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { appRequest } from "@/features/authority/client";
import { notificationList,notificationReceipt,type Notifications } from "@/features/identity/notifications-schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import { groupByDay } from "@/features/identity/notification-groups";
import "./notifications-experience.css";
import "./feature-tokens.css";
import { categories, essentialCategories, filterNotifications, hiddenFromStorage, STORAGE_KEY, toggleCategory, type NotificationCategory } from "@/features/identity/notification-preferences";
function readHidden(): NotificationCategory[] { try { return hiddenFromStorage(window.localStorage.getItem(STORAGE_KEY)); } catch { return []; } }
export function NotificationFeed(){
 const { t } = useI18n();
 const [data,setData]=useState<Notifications|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const [hidden,setHidden]=useState<NotificationCategory[]>([]);
 useEffect(()=>{const stored=readHidden();const timer=window.setTimeout(()=>setHidden(stored),0);return()=>window.clearTimeout(timer);},[]);
 function choose(category:NotificationCategory,visible:boolean){const next=toggleCategory(hidden,category,visible);setHidden(next);try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{/* the choice still applies for this visit */}}
 useEffect(()=>{let active=true;appRequest("/api/v1/notifications").then(raw=>{if(active)setData(notificationList.parse(raw));}).catch(()=>{if(active)setError(t("nf.loadError"));}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[t]);
 async function load(more=false){setBusy(true);setError("");try{const cursor=more?data?.nextCursor:null;const query=cursor?`?${new URLSearchParams({cursorAt:cursor.cursorAt!,cursorKey:cursor.cursorKey!})}`:"";const next=notificationList.parse(await appRequest(`/api/v1/notifications${query}`));setData(old=>more&&old?{...next,items:[...old.items,...next.items]}:next);}catch{setData(null);setError("Activity could not be loaded. Retry when signed in and connected.");}finally{setBusy(false);}}
 async function mark(eventKey:string){setBusy(true);setError("");try{notificationReceipt.parse(await appRequest("/api/v1/notifications",{eventKey}));setData(old=>old?{...old,items:old.items.map(item=>item.eventKey===eventKey?{...item,read:true}:item)}:null);}catch{setData(null);setError(t("nf.readFail"));}finally{setBusy(false);}}
 const view=data?filterNotifications(data.items,hidden):null;
 const [unreadOnly,setUnreadOnly]=useState(false);
 const unreadCount=view?view.shown.filter(item=>!item.read).length:0;
 const groups=groupByDay(view?view.shown.filter(item=>!unreadOnly||!item.read):[],new Date());
 return <section aria-label={t("nf.aria")}><p className="fw-page-subtitle">{t("nf.subtitle")}</p><p>{t("nf.intro")}</p>
 <details className="fw-list-card"><summary>{t("nf.prefs")}</summary>
  <p>{t("nf.prefsNote")}</p>
  {categories.map(category=><label className="fw-field" key={category}><span><input type="checkbox" checked={!hidden.includes(category)} disabled={essentialCategories.includes(category)} onChange={event=>choose(category,event.target.checked)}/> {t(`nf.c.${category}` as MessageKey)}</span></label>)}
 </details>
 {busy&&<p role="status">{t("nf.loading")}</p>}{error&&<p role="alert">{error}</p>}
 {data?.items.length===0&&<p>{t("nf.none")}</p>}
 {view&&view.hiddenCount>0&&<p role="status">{view.hiddenCount===1?t("nf.hiddenOne"):t("nf.hiddenMany",{count:view.hiddenCount})}</p>}
 {view&&<p className="oq-nf-summary" role="status">{unreadCount===0?t("nf.allRead"):t("nf.unreadCount",{count:unreadCount})}<label className="oq-nf-toggle"><input type="checkbox" checked={unreadOnly} onChange={event=>setUnreadOnly(event.target.checked)}/> {t("nf.unreadOnly")}</label></p>}
 {groups.map(group=><div className="oq-nf-group" key={group.key}><h3 className="fw-section-label">{t(group.key==="today"?"nf.today":"nf.earlier")}</h3>{group.items.map(item=><article className="fw-card fw-notification" key={item.eventKey}><div><strong>{item.title}</strong>{item.message&&<p>{item.message}</p>}<p>{new Date(item.recordedAt).toLocaleString()} · {item.read?t("nf.read"):t("nf.unread")}</p><Link href={item.href}>{t("nf.open")}</Link>{!item.read&&<button className="fw-secondary" disabled={busy} onClick={()=>void mark(item.eventKey)}>{t("nf.mark")}</button>}</div></article>)}</div>)}
 <button className="fw-secondary" disabled={busy} onClick={()=>void load()}>{t("nf.refresh")}</button>{data?.nextCursor&&<button className="fw-secondary" disabled={busy} onClick={()=>void load(true)}>{t("nf.older")}</button>}
 </section>;
}
