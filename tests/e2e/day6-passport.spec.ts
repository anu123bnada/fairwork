import { test,expect,type BrowserContext } from "@playwright/test";
import { translate } from "../../src/i18n";
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

test("private initialization, refresh and a new browser session recover the same history",async({browser})=>{
 const first=await browser.newContext(),second=await browser.newContext(),state=model(),requests:Record<string,unknown>[]=[];state.initialized=false;
 try{await session(first,state,worker,requests);await session(second,state);const a=await first.newPage(),b=await second.newPage();await a.goto("/app/passport");await a.getByRole("button",{name:"Create private Passport"}).click();await expect(a.getByRole("button",{name:"Create private Passport"})).toHaveCount(0);await expect(a.getByRole("link",{name:/Motorcycle Technician/})).toBeVisible();await a.reload();await expect(a.getByRole("link",{name:/Motorcycle Technician/})).toBeVisible();await b.goto("/app/passport");await expect(b.getByRole("link",{name:/Motorcycle Technician/})).toBeVisible();expect(requests).toHaveLength(1);expect(Object.keys(requests[0]!)).toEqual(["idempotencyKey"]);await expect(b.getByText("Private maintenance log")).toHaveCount(0);await expect(b.getByRole("link",{name:"Agreement revision 1"})).toHaveAttribute("href",`/app/agreement-workflow?workflowId=${id}`);
 }finally{await first.close();await second.close();}
});
test("withdrawal requires a reason, keeps history and removes the Passport entry after reload",async({context,page})=>{
 const state=model(),requests:Record<string,unknown>[]=[];await session(context,state,worker,requests);await page.goto(`/app/work-record?workId=${id}`);await page.getByText("Withdraw this record",{exact:true}).click();await expect(page.getByRole("button",{name:"Confirm withdrawal"})).toBeDisabled();await page.getByLabel("Withdrawal reason").fill("I no longer present this record");await page.getByRole("button",{name:"Confirm withdrawal"}).click();await expect(page.getByRole("status").filter({hasText:"Record version"})).toContainText("Withdrawn");await expect(page.getByText(/Historical decision/).first()).toBeVisible();await expect(page.getByRole("button",{name:"Reopen as a new draft"})).toHaveCount(0);await page.reload();await expect(page.getByText(/I no longer present this record/)).toBeVisible();await page.getByRole("link",{name:/View Work Passport/}).click();await expect(page.getByText("No eligible verified work yet")).toBeVisible();await expect(page.getByRole("link",{name:/Motorcycle Technician/})).toHaveCount(0);expect(requests[0]).toMatchObject({operation:"withdraw",expectedVersion:1,expectedEvidenceHash:evidenceHash});
});
test("correction creates a fresh draft and independent review restores only the new Passport revision",async({browser})=>{
 const first=await browser.newContext(),second=await browser.newContext(),state=model(),requests:Record<string,unknown>[]=[];
 try{await session(first,state,worker,requests);await session(second,state,rep,requests);const a=await first.newPage(),b=await second.newPage();await a.goto(`/app/work-record?workId=${id}`);await a.getByRole("button",{name:"Reopen as a new draft"}).click();await a.getByLabel("Correction reason").fill("Correct hours from the source log");await a.getByRole("button",{name:"Load agreement basis"}).click();await a.getByLabel("Hours",{exact:true}).fill("7");await a.getByRole("button",{name:"Save private draft"}).click();await expect(a.getByRole("status").filter({hasText:"Record version"})).toContainText("2 · Draft");await a.goto("/app/passport");await expect(a.getByText("No eligible verified work yet")).toBeVisible();await a.goto(`/app/work-record?workId=${id}`);await a.getByRole("checkbox",{name:/Share this exact record/}).check();await a.getByRole("button",{name:"Submit for verification"}).click();await b.goto(`/app/work-record?workId=${id}`);await b.getByLabel("Review reason").fill("Independently checked corrected hours");await b.getByRole("button",{name:"Verify exact record"}).click();await expect(b.getByRole("status").filter({hasText:"Record version"})).toContainText("2 · Verified");await a.goto("/app/passport");await expect(a.getByText(/Verified .*revision 2/)).toBeVisible();expect(requests.map(r=>r.operation)).toEqual(["correct","submit","decide"]);
 }finally{await first.close();await second.close();}
});
test("verifier retraction preserves its receipt and suppresses the worker Passport",async({context,page})=>{
 const state=model();await session(context,state,rep);await page.goto(`/app/work-record?workId=${id}`);await page.getByText("Retract my verification",{exact:true}).click();await page.getByLabel("Retraction reason").fill("My evidence review was incorrect");await page.getByRole("button",{name:"Confirm retraction"}).click();await expect(page.getByRole("status").filter({hasText:"Record version"})).toContainText("Verification retracted");await expect(page.getByText(/Historical decision/).first()).toBeVisible();await session(context,state,worker);await page.goto("/app/passport");await expect(page.getByText("No eligible verified work yet")).toBeVisible();
});
test("offline and expired Passport reads clear stale data; original mobile surfaces remain usable",async({context,page})=>{
 await session(context,model());mkdirSync("test-results/day6-visual",{recursive:true});
 for(const width of [390,378,320]){await page.setViewportSize({width,height:width===378?744:844});await page.goto("/app/passport");await expect(page.getByRole("link",{name:/Motorcycle Technician/})).toBeVisible();await page.screenshot({path:`test-results/day6-visual/${width}-passport.png`,fullPage:false,animations:"disabled"});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.route("**/api/v1/passport**",route=>route.abort());await page.getByRole("button",{name:"Reload private Passport"}).click();await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();await expect(page.getByRole("link",{name:/Motorcycle Technician/})).toHaveCount(0);
 await page.route("**/api/v1/passport**",route=>route.fulfill({status:401,json:{error:{code:"AUTH_REQUIRED"}}}));await page.getByRole("button",{name:"Reload private Passport"}).click();await expect(page.getByRole("link",{name:"Sign in to reopen your Passport"})).toBeVisible();await page.screenshot({path:"test-results/day6-visual/320-expired.png",fullPage:true,animations:"disabled"});
});

for (const locale of ["si","ta","de"] as const) {
 test(`the Work Passport screen is translated in ${locale}`,async({context,page})=>{
  await session(context,model());
  await page.goto("/app/settings");await page.getByLabel("Language").selectOption(locale);
  await page.goto("/app/passport");
  await expect(page.getByText(translate(locale,"pp.tagline"))).toBeVisible();
  await expect(page.getByText(translate(locale,"pp.onlyYou"))).toBeVisible();
  await expect(page.getByRole("heading",{name:translate(locale,"pp.history")})).toBeVisible();
  await expect(page.getByRole("link",{name:translate(locale,"pp.share")})).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\bpp\.[a-zA-Z.]+\b/);
 });
}
