import { test,expect,type BrowserContext } from "@playwright/test";
import { assessOfferTerms } from "../../src/features/offer/assessment";
import { mkdirSync } from "node:fs";
import type { WorkRecord,WorkVersion } from "../../src/features/work/schema";
const worker="40000000-0000-4000-8000-000000000012",rep="40000000-0000-4000-8000-000000000013",id="40000000-0000-4000-8000-000000000021",company="40000000-0000-4000-8000-000000000001";
const time="2026-10-14T01:00:00Z",hash="a".repeat(64),evidenceHash="b".repeat(64);
type Model={initialized:boolean;record:WorkRecord};
function model():Model {return {initialized:true,record:{workId:id,agreementId:id,workerId:worker,companyId:company,representativeId:rep,currentVersion:1,integrityEvents:[],versions:[{version:1,state:"verified",contentHash:hash,evidenceHash,createdAt:time,submittedAt:time,content:{schemaVersion:"work-record.v1",role:"Motorcycle Technician",periodStart:"2026-10-12",periodEnd:"2026-10-12",hours:"8",tasks:"Motorcycle maintenance completed",evidence:[{id:company,ownerId:worker,text:"Private maintenance log",recordedAt:time}],agreement:{id,version:1,contentHash:hash,authorityDecisionId:company,effectiveAt:time,scope:"Motorcycle maintenance"}},decision:{id:company,actorId:rep,authorityDecisionId:company,outcome:"verified",reason:"Reviewed exact work",contentHash:hash,evidenceHash,recordedAt:time}}]}};}
// Transport fixtures only; PostgreSQL tests independently prove authorization and eligibility.
async function session(context:BrowserContext,state:Model,actor=worker,requests:Record<string,unknown>[]=[]){
 await context.route("**/api/v1/me",route=>route.fulfill({json:{data:{id:actor,displayName:"Nimal Perera",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await context.route("**/api/v1/passport**",route=>{
  if(route.request().method()==="POST"){requests.push(route.request().postDataJSON());state.initialized=true;return route.fulfill({json:{data:{passportId:id,ownerId:actor,createdAt:time}}});}
  const v=state.record.versions.at(-1)!;
  const entries=state.initialized&&v.state==="verified"?[{workId:id,version:v.version,role:v.content.role,periodStart:v.content.periodStart,periodEnd:v.content.periodEnd,hours:v.content.hours,summary:v.content.tasks,companyId:company,companyName:"AutoCare Garage",agreementId:id,agreementVersion:1,agreementHash:hash,agreementEffectiveAt:time,verificationId:company,verifiedAt:time,verifierId:rep,authorityDecisionId:company,evidenceCount:1,evidenceHash}]:[];
  return route.fulfill({json:{data:{policyVersion:"private-work-passport.v1",passportId:state.initialized?id:null,ownerId:actor,createdAt:state.initialized?time:null,entries,nextCursor:null}}});
 });
 await context.route("**/api/v1/agreement-workflows**",route=>route.fulfill({json:{data:{agreementId:id,workerId:worker,companyId:company,representativeId:rep,currentVersion:1,effectiveVersion:1,versions:[{version:1,state:"confirmed",status:"effective",contentHash:hash,itemSetHash:evidenceHash,unresolvedIds:[],createdAt:time,proposedAt:time,acknowledgements:[],decisions:[],content:{schemaVersion:"agreement-terms.v1",workerId:worker,companyId:company,representativeId:rep,authorityDecisionId:company,source:{offerId:id,version:1,termHash:hash,snapshot:{responsibilities:"Motorcycle maintenance"}},terms:{responsibilities:"Motorcycle maintenance"},unresolved:[],sharedQuestions:[],answers:[]}}]}}}));
 await context.route("**/api/v1/work-records**",route=>{
  const v=state.record.versions.at(-1)!;
  if(route.request().method()==="GET")return route.fulfill({json:{data:new URL(route.request().url()).searchParams.has("workId")?state.record:{items:[{workId:id,version:v.version,state:v.state,hours:v.content.hours,periodStart:v.content.periodStart,periodEnd:v.content.periodEnd}],nextCursor:null}}});
  const body=route.request().postDataJSON();requests.push(body);
  if(body.expectedVersion!==v.version||body.expectedState!==v.state)return route.fulfill({status:409,json:{error:{code:"VERSION_CONFLICT"}}});
  if(body.operation==="withdraw"||body.operation==="retract"){v.state=body.operation==="withdraw"?"withdrawn":"invalidated";state.record.integrityEvents!.push({id:crypto.randomUUID(),version:v.version,operation:body.operation,actorId:actor,reason:body.reason,nextVersion:null,decisionId:body.operation==="retract"?company:null,recordedAt:time});}
  if(body.operation==="correct"){v.state="superseded";const next:WorkVersion=structuredClone(v);next.version++;next.state="draft";next.decision=null;next.submittedAt=null;Object.assign(next.content,body.payload,{evidence:body.payload.evidence.map((text:string)=>({id:company,ownerId:worker,text,recordedAt:time}))});state.record.versions.push(next);state.record.currentVersion=next.version;state.record.integrityEvents!.push({id:crypto.randomUUID(),version:v.version,operation:"correct",actorId:actor,reason:body.reason,nextVersion:next.version,decisionId:null,recordedAt:time});}
  if(body.operation==="submit"){v.state="submitted";v.submittedAt=time;}
  if(body.operation==="decide"){v.state=body.outcome;v.decision={id:company,actorId:actor,authorityDecisionId:company,outcome:body.outcome,reason:body.reason,contentHash:hash,evidenceHash,recordedAt:time};}
  const latest=state.record.versions.at(-1)!;return route.fulfill({json:{data:{workId:id,version:latest.version,state:latest.state,contentHash:hash,evidenceHash,actorId:actor,operation:body.operation,decisionId:latest.decision?.id??null,recordedAt:time}}});
 });
}


const terms={role:"Workshop Assistant",salary:80000,currency:"LKR",hoursPerWeek:40,probation:"unpaid trial is required"};
const unresolved=[{id:"40000000-0000-4000-8000-0000000000a1",field:"startDate",question:"When does the job start?",required:true}];
const offer={offerId:id,companyId:company,workerId:worker,representativeId:null,requesterId:worker,requesterRole:"WORKER",version:1,termHash:hash,snapshot:terms,changes:[],unresolved};
const offers=[{offerId:id,companyId:company,version:2,role:"Motorcycle Technician",createdAt:"2026-10-27T09:00:00Z",questions:3,archived:false,decision:"interested",lifecycleRevision:1}];
const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function signedIn(context:BrowserContext){
 const state=model();
 await context.route("**/api/v1/**",r=>r.fulfill({status:503,json:{error:{code:"SERVICE_UNAVAILABLE"}}}));
 await session(context,state);
 await context.route("**/api/v1/offers?*",r=>r.fulfill({json:{data:{items:offers,nextCursor:null}}}));
 await context.route("**/api/v1/companies**",r=>r.fulfill({json:{data:{items:[],scope:"your_authorized_organizations",externalSourceConfigured:false}}}));
 await context.route("**/api/v1/offers/drafts**",r=>r.fulfill({json:{data:{items:[],nextCursor:null}}}));
 await context.route("**/api/v1/agreements?*",r=>r.fulfill({json:{data:{offer,agreementId:id,confirmation:null,answers:[],canConfirm:false}}}));
 await context.route("**/api/v1/offers/assessment?*",r=>r.fulfill({json:{data:{offerId:id,offerVersion:1,termHash:hash,assessment:assessOfferTerms(terms)}}}));
 await context.route("**/api/v1/offers/analyses**",r=>r.fulfill({json:{data:{offerId:id,items:[]}}}));
 await context.route("**/api/v1/agreement-expiries",r=>r.fulfill({json:{data:{items:[{agreementId:id,version:1,expiresAt:"2026-11-20T00:00:00Z",expired:false,role:"worker"}]}}}));
 await context.route("**/api/v1/work-cases**",r=>r.fulfill({json:{data:{items:[{caseId:id,workId:id,workVersion:1,revision:1,status:"open",openedAt:time}],nextCursor:null}}}));
 await context.route("**/api/v1/notifications**",r=>r.fulfill({json:{data:{items:[{eventKey:"a",kind:"work_decision",title:"Work record verified",message:"Your employer verified a record.",href:"/app/work-record",recordedAt:new Date().toISOString(),read:false},{eventKey:"b",kind:"agreement_decision",title:"Agreement confirmed",message:"",href:"/app/agreement-workflow",recordedAt:"2026-10-20T00:00:00Z",read:true}],nextCursor:null}}}));
}

const routes:[string,string][]=[["/app/home","dashboard"],["/app/add-offer","addoffer"],[`/app/check?offerId=${id}`,"check"],["/app/agreement-workflow","agreements"],[`/app/agreement-workflow?workflowId=${id}`,"agreementdetail"],["/app/work-record","workrecords"],[`/app/work-record?workId=${id}`,"workrecorddetail"],["/app/passport","passport"],["/app/cases","cases"],["/app/notifications","notifications"],["/app/settings","settings"],["/app/employer","organizations"]];
for(const [name,width,height] of [["desktop",1440,900],["mobile",390,844]] as const)
for(const scheme of ["light","dark"] as const)
for(const [route,label] of routes)
test(`design system ${label} ${name} ${scheme}: no overflow, no raw ids, no errors`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});
 try{
  await signedIn(context);
  const page=await context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto(route);await page.waitForTimeout(1500);
  mkdirSync("test-results/design",{recursive:true});
  await page.screenshot({path:`test-results/design/${label}-${name}-${scheme}.png`,fullPage:true});
  const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,text:document.body.innerText,theme:document.documentElement.dataset.theme}));
  expect(m.overflow,"horizontal overflow").toBeLessThanOrEqual(0);
  expect(UUID.test(m.text),"raw identifier visible").toBe(false);
  expect(errors).toEqual([]);
 }finally{await context.close();}
});

test("the chosen theme applies on every route before paint, persists across reloads and follows the device when set to match",async({browser})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:"light"});
 try{
  await signedIn(context);
  const page=await context.newPage();
  const canvas=()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue("--oq-canvas").trim().toLowerCase());
  await page.goto("/app/passport");
  expect(await canvas()).toBe("#f5f7ff");
  await page.getByRole("group",{name:"Appearance"}).getByRole("button",{name:"Dark"}).click();
  expect(await page.evaluate(()=>localStorage.getItem("oryqen.appearance"))).toBe("dark");
  expect(await canvas()).toBe("#090f24");
  for(const route of ["/app/work-record","/app/cases","/app/agreement-workflow","/app/notifications"]){
   await page.goto(route);
   expect(await page.evaluate(()=>document.documentElement.dataset.theme),route).toBe("dark");
   expect(await canvas(),route).toBe("#090f24");
  }
  await page.reload();expect(await canvas()).toBe("#090f24");
  await page.getByRole("group",{name:"Appearance"}).getByRole("button",{name:"Match device"}).click();
  expect(await page.evaluate(()=>localStorage.getItem("oryqen.appearance"))).toBeNull();
  expect(await canvas()).toBe("#f5f7ff");
  await page.emulateMedia({colorScheme:"dark"});
  expect(await canvas()).toBe("#090f24");
 }finally{await context.close();}
});

for(const [name,width,height] of [["desktop",1440,900],["mobile",390,844]] as const)
for(const scheme of ["light","dark"] as const)
test(`a new account sees a guided start, not an empty dashboard (${name} ${scheme})`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});
 try{
  await signedIn(context);
  await context.route("**/api/v1/offers?*",r=>r.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await context.route("**/api/v1/work-records",r=>r.fulfill({json:{data:{items:[],nextCursor:null}}}));
  const page=await context.newPage();
  await page.goto("/app/home");
  const start=page.getByRole("region",{name:"Recent offers"});
  await expect(start).toContainText("Your first offer starts here");
  const steps=start.getByRole("list").getByRole("link");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toHaveAttribute("href","/app/add-offer");
  await expect(steps.nth(1)).toHaveAttribute("href","/app/check");
  await expect(steps.nth(2)).toHaveAttribute("href","/app/work-record");
  await expect(page.getByRole("region",{name:"Welcome and next step"}).getByRole("link",{name:/Add offer/}).first()).toHaveAttribute("href","/app/add-offer");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
  mkdirSync("test-results/design",{recursive:true});
  await page.screenshot({path:`test-results/design/newuser-${name}-${scheme}.png`,fullPage:true});
 }finally{await context.close();}
});

test("the offer workbench shows the selected offer and switches on selection",async({browser})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 try{
  await signedIn(context);
  const second={offerId:"40000000-0000-4000-8000-000000000099",companyId:company,version:1,role:"Warehouse Assistant",createdAt:"2026-10-20T09:00:00Z",questions:0,archived:false,decision:"considering",lifecycleRevision:0};
  await context.route("**/api/v1/offers?*",r=>r.fulfill({json:{data:{items:[...offers,second],nextCursor:null}}}));
  const page=await context.newPage();
  await page.goto("/app/home");
  const wb=page.getByRole("region",{name:"Recent offers"});
  const detail=wb.getByRole("article",{name:"Selected offer"});
  await expect(detail).toContainText("Motorcycle Technician");
  await expect(detail.getByRole("link",{name:"Review offer: Motorcycle Technician"})).toHaveAttribute("href",`/app/agreement?offerId=${id}`);
  await wb.getByRole("button",{name:/Warehouse Assistant/}).click();
  await expect(detail).toContainText("Warehouse Assistant");
  await expect(detail).toContainText("Considering");
  await expect(detail.getByRole("link",{name:"See findings"})).toHaveAttribute("href",`/app/check?offerId=${second.offerId}`);
  await expect(wb.getByRole("button",{name:/Warehouse Assistant/})).toHaveAttribute("aria-pressed","true");
 }finally{await context.close();}
});

test("the dashboard work area is a keyboard-operable tab set that keeps each panel's state",async({browser})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 try{
  await signedIn(context);
  const page=await context.newPage();
  await page.goto("/app/home");
  const tabs=page.getByRole("tablist",{name:"Manage"});
  await expect(tabs.getByRole("tab")).toHaveText(["Saved offers","Work records","Research an employer"]);
  await expect(tabs.getByRole("tab",{name:"Saved offers"})).toHaveAttribute("aria-selected","true");
  await tabs.getByRole("tab",{name:"Research an employer"}).click();
  const panel=page.getByRole("region",{name:"Research an employer"});
  await panel.getByLabel("Company name").fill("Draft query");
  await tabs.getByRole("tab",{name:"Saved offers"}).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab",{name:"Work records"})).toBeFocused();
  await expect(tabs.getByRole("tab",{name:"Work records"})).toHaveAttribute("aria-selected","true");
  await page.keyboard.press("End");
  await expect(tabs.getByRole("tab",{name:"Research an employer"})).toHaveAttribute("aria-selected","true");
  await expect(panel.getByLabel("Company name")).toHaveValue("Draft query");
  await page.keyboard.press("Home");
  await expect(tabs.getByRole("tab",{name:"Saved offers"})).toHaveAttribute("aria-selected","true");
  await expect(page.getByRole("tabpanel",{name:"Research an employer"})).toBeHidden();
 }finally{await context.close();}
});

test("the dashboard agreements card counts open proposals with an expiry date and links to agreements",async({browser})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 try{
  await signedIn(context);
  const soon=new Date(Date.now()+5*86_400_000).toISOString(),past=new Date(Date.now()-2*86_400_000).toISOString();
  await context.route("**/api/v1/agreement-expiries",r=>r.fulfill({json:{data:{items:[{agreementId:id,version:1,expiresAt:soon,expired:false,role:"worker"},{agreementId:"40000000-0000-4000-8000-0000000000b2",version:1,expiresAt:past,expired:true,role:"worker"}]}}}));
  const page=await context.newPage();
  await page.goto("/app/home");
  const card=page.locator(".fw-sum-card").filter({hasText:"Agreements"});
  await expect(card).toContainText("2");
  await expect(card).toContainText("1 expired");
  await expect(card).toContainText("Next expiry");
  await expect(card.getByRole("link",{name:/Open agreements/})).toHaveAttribute("href","/app/agreement-workflow");
 }finally{await context.close();}
});

const researchRecord={provider:"gleif",providerName:"GLEIF Global LEI Index",identifier:{scheme:"LEI",value:"254900XV5B725ZG6RS07"},legalName:"Commercial Bank of Ceylon PLC",otherNames:[],country:"LK",jurisdiction:"LK",legalForm:"Public Limited Company",entityStatus:"ACTIVE",registrationStatus:"ISSUED",corroboration:"FULLY_CORROBORATED",registrationAuthority:{id:"RA000540",entityId:"PQ116"},legalAddress:"21, Bristol Street, Colombo, 00100, LK",sourceLastUpdated:"2026-09-01T18:13:29Z",nextRenewal:"2027-09-04T19:37:18Z",sourceUrl:"https://api.gleif.org/api/v1/lei-records/254900XV5B725ZG6RS07",retrievedAt:"2026-10-26T09:00:00Z"};
for(const [name,width,height] of [["desktop",1440,900],["mobile",390,844]] as const)
for(const scheme of ["light","dark"] as const)
test(`research results show a facts grid and badged findings, never a score (${name} ${scheme})`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});
 try{
  await signedIn(context);
  await context.route("**/api/v1/organizations",r=>r.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await context.route("**/api/v1/research/companies?*",r=>r.fulfill({json:{data:{query:{name:"Commercial Bank of Ceylon",country:"LK"},totalMatches:1,source:{provider:"gleif",name:"GLEIF Global LEI Index",url:"https://www.gleif.org/en/lei-data/gleif-api",kind:"third_party_registry"},limitations:["Data comes from a third-party registry. It is not complete."],results:[{record:researchRecord,nameMatch:"close",freshness:{status:"current",sourceAgeDays:55,verifyAgainBy:"2026-11-25T09:00:00.000Z"},findings:[{id:"a",kind:"supports",title:"Registered name matches apart from the legal-form suffix",detail:"A matching name does not prove that a job offer belongs to this entity."},{id:"b",kind:"outdated",title:"Record may be outdated",detail:"Check the source date."},{id:"c",kind:"limitation",title:"What this research does not establish",detail:"It does not verify that this entity made a specific offer."}]}]}}}));
  const page=await context.newPage();
  await page.goto("/app/employer");
  const panel=page.getByRole("region",{name:"Research an employer"});
  await panel.getByLabel("Company name").fill("Commercial Bank of Ceylon");
  await panel.getByLabel("Country").selectOption("LK");
  await panel.getByRole("button",{name:"Search registry"}).click();
  const card=panel.getByRole("article",{name:/Registry record: Commercial Bank/});
  await expect(card).toContainText("Registry record, not verified by ORYQEN");
  await expect(card).toContainText("Supports:");
  await expect(card.locator(".oq-badge")).toHaveCount(4);
  await expect(panel).not.toContainText(/trust score|\d+\s*\/\s*100|\d+\s*%/i);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
  mkdirSync("test-results/design",{recursive:true});
  await card.screenshot({path:`test-results/design/research-${name}-${scheme}.png`});
 }finally{await context.close();}
});
