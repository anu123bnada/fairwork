import { z } from "zod";

const authScreens = new Set(["guidance", "opportunities", "settings", "add-offer", "work-record", "cases", "passport", "notifications", "share", "agreement", "agreement-workflow", "check", "questions"]);

// Only a record identifier is carried across sign-in, never an arbitrary redirect.
// The destination still authenticates and authorizes its participant read.
export function participantOfferId(search: string): string | null {
  const values = new URLSearchParams(search).getAll("offerId");
  if (values.length !== 1) return null;
  const parsed = z.uuid().safeParse(values[0]);
  return parsed.success ? parsed.data : null;
}

export function participantWorkflowId(search:string):string|null {
  const values=new URLSearchParams(search).getAll("workflowId");
  if(values.length!==1)return null;
  const parsed=z.uuid().safeParse(values[0]);
  return parsed.success?parsed.data:null;
}

export function participantDestination(search:string):string|null {
  const grantId=participantGrantId(search);
  if(grantId)return `/app/share?grantId=${grantId}`;
  const caseId=participantCaseId(search);
  if(caseId)return `/app/cases?caseId=${caseId}`;
  const workId=participantWorkId(search);
  if(workId)return `/app/work-record?workId=${workId}`;
  const workflowId=participantWorkflowId(search);
  if(workflowId)return `/app/agreement-workflow?workflowId=${workflowId}`;
  const basisId=participantAgreementBasisId(search);
  if(basisId)return `/app/work-record?agreementBasisId=${basisId}`;
  const offerId=participantOfferId(search);
  if(offerId)return `/app/agreement?offerId=${offerId}`;
  const screens=new URLSearchParams(search).getAll("screen");
  if(screens.length===1&&authScreens.has(screens[0]!))return `/app/${screens[0]}`;
  const workspaces=new URLSearchParams(search).getAll("workspace");
  return workspaces.length===1&&workspaces[0]==="employer"?"/app/employer":null;
}

// Preserve a fixed navigation hint across public auth pages, never a role or URL.
export function participantAuthQuery(search:string):string {
  const destination=participantDestination(search);
  const query=new URLSearchParams(destination?.split("?")[1]??"");
  const screen=destination?.slice("/app/".length);
  if(screen&&authScreens.has(screen))query.set("screen",screen);
  const workspaces=new URLSearchParams(search).getAll("workspace");
  if(workspaces.length===1&&workspaces[0]==="employer")query.set("workspace","employer");
  return query.toString();
}

export function participantSignInPath(pathname: string, search: string): string {
  const query = new URLSearchParams(participantAuthQuery(search));
  if (!query.size) {
    if (pathname === "/app/employer") query.set("workspace", "employer");
    else if (pathname.startsWith("/app/") && authScreens.has(pathname.slice(5))) query.set("screen", pathname.slice(5));
  }
  return `/sign-in${query.size ? `?${query}` : ""}`;
}

// Navigation hint only. Work Record must re-read and authorize the effective
// agreement before creating a draft; the URL never supplies trusted terms.
export function participantAgreementBasisId(search:string):string|null {
  const values=new URLSearchParams(search).getAll("agreementBasisId");
  if(values.length!==1)return null;
  const parsed=z.uuid().safeParse(values[0]);
  return parsed.success?parsed.data:null;
}

export function participantGrantId(search:string):string|null {
  const values=new URLSearchParams(search).getAll("grantId");
  if(values.length!==1)return null;
  const parsed=z.uuid().safeParse(values[0]);
  return parsed.success?parsed.data:null;
}

export function participantWorkId(search:string):string|null {
  const values=new URLSearchParams(search).getAll("workId");
  if(values.length!==1)return null;
  const parsed=z.uuid().safeParse(values[0]);
  return parsed.success?parsed.data:null;
}

export function participantCaseId(search:string):string|null {
  const values=new URLSearchParams(search).getAll("caseId");
  if(values.length!==1)return null;
  const parsed=z.uuid().safeParse(values[0]);
  return parsed.success?parsed.data:null;
}
