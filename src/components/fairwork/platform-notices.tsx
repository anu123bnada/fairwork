"use client";
import {useEffect,useState} from "react";
import {appRequest} from "@/features/authority/client";
export function PlatformNotices(){
 const [notices,setNotices]=useState<string[]>([]);
 useEffect(()=>{let active=true;appRequest("/api/v1/platform-notices").then(result=>{if(active)setNotices([result.announcement,result.maintenance_notice].filter((v):v is string=>typeof v==="string"&&v.trim().length>0));}).catch(()=>{if(active)setNotices([]);});return()=>{active=false;};},[]);
 if(!notices.length)return null;
 return <aside aria-label="Platform notices" className="fw-notice" role="status">{notices.map((notice,index)=><p key={index}>{notice}</p>)}</aside>;
}
