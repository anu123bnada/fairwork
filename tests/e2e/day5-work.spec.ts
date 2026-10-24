import { test,expect,type BrowserContext } from "@playwright/test";
import { mkdirSync } from "node:fs";
import type { WorkRecord,WorkVersion } from "../../src/features/work/schema";
const worker="40000000-0000-4000-8000-000000000012",representative="40000000-0000-4000-8000-000000000013",id="40000000-0000-4000-8000-000000000021",company="40000000-0000-4000-8000-000000000001";
const time="2026-10-14T01:00:00+00:00",hash="a".repeat(64),evidenceHash="b".repeat(64);
function version(state:WorkVersion["state"]="draft"):WorkVersion{return {version:1,state,contentHash:hash,evidenceHash,createdAt:time,submittedAt:state==="draft"?null:time,decision:null,content:{schemaVersion:"work-record.v1",agreement:{id,version:1,contentHash:hash,authorityDecisionId:company,effectiveAt:time,scope:"Engineering"},role:"Engineer",periodStart:"2026-10-12",periodEnd:"2026-10-12",hours:"8",tasks:"Maintenance completed",evidence:[{id:company,ownerId:worker,text:"Checked maintenance log",recordedAt:time}]}};}
function fixture(state:WorkVersion["state"]="draft"):WorkRecord{return {workId:id,agreementId:id,workerId:worker,companyId:company,representativeId:representative,currentVersion:1,versions:[version(state)]};}

test("document excerpts stay local until reviewed, then persist through the private work API",async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}}),model:{record:WorkRecord|null}={record:null},requests:Record<string,unknown>[]=[];
 try {
  await session(context,worker,model,requests);const page=await context.newPage();await page.goto("/app/work-record");
  await page.getByRole("button",{name:"Log work",exact:true}).click();
  await page.getByLabel("Text document",{exact:true}).setInputFiles({name:"synthetic-maintenance.txt",mimeType:"text/plain",buffer:Buffer.from("Synthetic maintenance log. Machine inspected on October 12.")});
  await expect(page.getByRole("button",{name:"Add excerpts to draft"})).toBeVisible();expect(requests).toHaveLength(0);
  await page.getByRole("button",{name:"Add excerpts to draft"}).click();
  await expect(page.getByRole("textbox",{name:"Text evidence 1",exact:true})).toHaveValue(/Original SHA-256/);
  await page.getByLabel("Effective agreement ID").fill(id);await page.getByRole("button",{name:"Load agreement basis"}).click();
  await page.getByLabel("Role",{exact:true}).fill("Engineer");await page.getByLabel("Period start").fill("2026-10-12");await page.getByLabel("Period end").fill("2026-10-12");await page.getByLabel("Hours",{exact:true}).fill("8");await page.getByLabel("Work performed").fill("Maintenance completed");
  await page.getByRole("button",{name:"Save private draft"}).click();await expect(page.getByRole("status").filter({hasText:"Record version"})).toContainText("Draft");
  await page.reload();await expect(page.getByText(/Imported excerpt 1\/1: synthetic-maintenance.txt/).first()).toBeVisible();
  expect(JSON.stringify(requests)).toContain("original file not stored");expect(JSON.stringify(requests)).not.toContain('"file"');
 } finally {await context.close();}
});
// Browser transport fixtures only. Real PostgreSQL tests enforce authorization,
// state transitions and durability. No fixture is used by production code.
async function session(context:BrowserContext,actor:string,model:{record:WorkRecord|null},requests:Record<string,unknown>[]){
 await context.route("**/api/v1/me",route=>route.fulfill({json:{data:{id:actor,displayName:"Synthetic participant",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await context.route("**/api/v1/agreement-workflows**",route=>route.fulfill({json:{data:{agreementId:id,workerId:worker,companyId:company,representativeId:representative,currentVersion:1,effectiveVersion:1,versions:[{version:1,state:"confirmed",status:"effective",contentHash:hash,itemSetHash:evidenceHash,unresolvedIds:[],createdAt:time,proposedAt:time,acknowledgements:[],decisions:[],content:{schemaVersion:"agreement-terms.v1",workerId:worker,companyId:company,representativeId:representative,authorityDecisionId:company,source:{offerId:id,version:1,termHash:hash,snapshot:{responsibilities:"Engineering"}},terms:{responsibilities:"Engineering"},unresolved:[],sharedQuestions:[],answers:[]}}]}}}));
 await context.route("**/api/v1/work-records**",async route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==="GET"){
   if(url.searchParams.has("workId"))return route.fulfill(model.record?{json:{data:model.record}}:{status:404,json:{error:{code:"NOT_FOUND"}}});
   const v=model.record?.versions.at(-1);return route.fulfill({json:{data:{items:v&&model.record?[{workId:model.record.workId,version:v.version,state:v.state,hours:v.content.hours,periodStart:v.content.periodStart,periodEnd:v.content.periodEnd}]:[],nextCursor:null}}});
  }
  const body=route.request().postDataJSON();requests.push(body);
  if(body.operation==="create"){model.record=fixture();model.record.workId=body.workId;Object.assign(model.record.versions[0]!.content,body.payload,{evidence:body.payload.evidence.map((text:string)=>({id:company,ownerId:worker,text,recordedAt:time}))});}
  const v=model.record!.versions.at(-1)!;
  if(body.operation!=="create"&&body.expectedVersion!==v.version)return route.fulfill({status:409,json:{error:{code:"VERSION_CONFLICT"}}});
  if(body.operation==="submit"){v.state="submitted";v.submittedAt=time;}
  if(body.operation==="decide"){v.state=body.outcome;v.decision={id:company,actorId:actor,authorityDecisionId:company,outcome:body.outcome,reason:body.reason,contentHash:v.contentHash,evidenceHash:v.evidenceHash,recordedAt:time};}
  if(body.operation==="revise"||body.operation==="reopen"||body.operation==="correct"){v.state="superseded";const next=version();next.version=v.version+1;model.record!.currentVersion=next.version;Object.assign(next.content,body.payload,{evidence:body.payload.evidence.map((text:string)=>({id:company,ownerId:worker,text,recordedAt:time}))});model.record!.versions.push(next);}
  const latest=model.record!.versions.at(-1)!;return route.fulfill({json:{data:{workId:model.record!.workId,version:latest.version,state:latest.state,contentHash:latest.contentHash,evidenceHash:latest.evidenceHash,operation:body.operation,actorId:actor,decisionId:latest.decision?.id??null,recordedAt:time}}});
 });
}
test("agreement deep link prefills the basis but still requires authorized loading",async({context,page})=>{
 const requests:Record<string,unknown>[]=[];
 await session(context,worker,{record:null},requests);
 await page.goto(`/app/work-record?agreementBasisId=${id}`);
 await expect(page.getByLabel("Effective agreement ID")).toHaveValue(id);
 await expect(page.getByRole("button",{name:"Save private draft"})).toBeDisabled();
 await page.route("**/api/v1/agreement-workflows**",route=>route.fulfill({status:403,json:{error:{code:"ACTION_FORBIDDEN"}}}));
 await page.getByRole("button",{name:"Load agreement basis"}).click();
 await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();
 await expect(page.getByRole("button",{name:"Save private draft"})).toBeDisabled();
 expect(requests).toEqual([]);
 await page.route("**/api/v1/agreement-workflows**",route=>route.fulfill({status:401,json:{error:{code:"AUTH_REQUIRED"}}}));
 await page.getByRole("button",{name:"Load agreement basis"}).click();
 await expect(page.getByRole("link",{name:"Sign in to reopen this record"})).toHaveAttribute("href",`/sign-in?agreementBasisId=${id}`);
});

test("worker saves private text evidence, submits explicitly and another session verifies exact revision",async({browser})=>{
 const a=await browser.newContext({viewport:{width:390,height:844}}),b=await browser.newContext({viewport:{width:378,height:744}}),model:{record:WorkRecord|null}={record:null},requests:Record<string,unknown>[]=[];
 try{await session(a,worker,model,requests);await session(b,representative,model,requests);const first=await a.newPage(),second=await b.newPage();await first.goto("/app/work-record");await expect(first.getByRole("heading",{name:"No work recorded yet"})).toBeVisible();await first.getByRole("button",{name:"Log work",exact:true}).click();await first.getByLabel("Effective agreement ID").fill(id);await first.getByRole("button",{name:"Load agreement basis"}).click();await expect(first.getByText(/Agreement revision 1 · Engineering/)).toBeVisible();await first.getByLabel("Role",{exact:true}).fill("Engineer");await first.getByLabel("Period start").fill("2026-10-12");await first.getByLabel("Period end").fill("2026-10-12");await first.getByLabel("Hours",{exact:true}).fill("8");await first.getByLabel("Work performed").fill("Maintenance completed");await first.getByLabel("Text evidence 1").fill("Checked maintenance log");await first.getByRole("button",{name:"Save private draft"}).click();await expect(first.getByRole("status").filter({hasText:"Record version"})).toContainText("Draft");await first.reload();await expect(first.getByText("Checked maintenance log").first()).toBeVisible();await expect(first.getByRole("button",{name:"Submit for verification"})).toBeDisabled();await first.getByRole("checkbox",{name:/Share this exact record/}).check();await first.getByRole("button",{name:"Submit for verification"}).click();await expect(first.getByRole("status").filter({hasText:"Record version"})).toContainText("Pending");await expect(first.getByRole("button",{name:"Verify exact record"})).toHaveCount(0);
 await second.goto(`/app/work-record?workId=${model.record!.workId}`);await expect(second.getByRole("button",{name:"Verify exact record"})).toBeDisabled();await second.getByLabel("Review reason").fill("Reviewed exact work and text evidence");await second.getByRole("button",{name:"Verify exact record"}).click();await expect(second.getByRole("status").filter({hasText:"Record version"})).toContainText("Verified");await first.reload();await expect(first.getByRole("status").filter({hasText:"Record version"})).toContainText("Verified");
 mkdirSync("test-results/day5-visual",{recursive:true});await first.screenshot({path:"test-results/day5-visual/390-verified.png",fullPage:true});await second.screenshot({path:"test-results/day5-visual/378-verified.png",fullPage:true});expect(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(requests.map(r=>r.operation)).toEqual(["create","submit","decide"]);expect(requests.every(r=>!("workerId" in r)&&!("companyId" in r)&&!("actorId" in r))).toBe(true);expect(requests[2]).toMatchObject({expectedVersion:1,expectedHash:hash,expectedEvidenceHash:evidenceHash});
 }finally{await a.close();await b.close();}
});
test("disputed record reopens into a new draft with immutable visible history",async({context,page})=>{
 const model={record:fixture("disputed")},requests:Record<string,unknown>[]=[];model.record.versions[0]!.decision={id:company,outcome:"disputed",reason:"Hours differ from log",actorId:representative,authorityDecisionId:company,contentHash:hash,evidenceHash,recordedAt:time};await session(context,worker,model,requests);await page.goto(`/app/work-record?workId=${id}`);await page.getByRole("button",{name:"Reopen as a new draft"}).click();await page.getByRole("button",{name:"Load agreement basis"}).click();await page.getByLabel("Text evidence 1").fill("Corrected statement with source details");await page.getByLabel("Correction reason").fill("Corrected statement from the source log");await page.getByRole("button",{name:"Save private draft"}).click();await expect(page.getByRole("status").filter({hasText:"Record version"})).toContainText("Record version 2 · Draft");await page.reload();await page.getByText("Revision history (2)").click();await expect(page.getByText("Hours differ from log",{exact:false})).toBeVisible();expect(requests[0]).toMatchObject({operation:"correct",expectedVersion:1});
});
test("stale and interrupted writes fail safely; offline reload clears content and expiry retains participant path",async({context,page})=>{
 const model={record:fixture("submitted")},requests:Record<string,unknown>[]=[];await session(context,representative,model,requests);let lost=true;const attempts:Record<string,unknown>[]=[];await page.route("**/api/v1/work-records",async route=>{if(route.request().method()!=="POST")return route.fallback();attempts.push(route.request().postDataJSON());if(lost){lost=false;return route.abort();}return route.fallback();});await page.goto(`/app/work-record?workId=${id}`);await page.getByLabel("Review reason").fill("Reviewed");await page.getByRole("button",{name:"Dispute record"}).click();await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();await page.getByRole("button",{name:"Dispute record"}).click();await expect(page.getByRole("status").filter({hasText:"Record version"})).toContainText("Disputed");expect(attempts[0]!.idempotencyKey).toBe(attempts[1]!.idempotencyKey);
 await page.route("**/api/v1/work-records**",route=>route.abort());await page.getByRole("button",{name:"Reload saved work",exact:true}).click();await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();await expect(page.getByText("Checked maintenance log")).toHaveCount(0);await page.route("**/api/v1/work-records**",route=>route.fulfill({status:401,json:{error:{code:"AUTH_REQUIRED"}}}));await page.getByRole("button",{name:"Reload saved work"}).click();await expect(page.getByRole("link",{name:"Sign in to reopen this record"})).toHaveAttribute("href",`/sign-in?workId=${id}`);
});
test("a stale decision reloads the current revision and rejects without showing verification",async({context,page})=>{
 const model={record:fixture("submitted")},requests:Record<string,unknown>[]=[];await session(context,representative,model,requests);await page.goto(`/app/work-record?workId=${id}`);await page.getByLabel("Review reason").fill("Insufficient evidence");model.record.currentVersion=2;model.record.versions[0]!.version=2;await page.getByRole("button",{name:"Verify exact record"}).click();await expect(page.locator('.fw-error[role="alert"]')).toContainText("changed");await page.getByRole("button",{name:"Reload saved work"}).first().click();await expect(page.getByRole("status").filter({hasText:"Record version"})).toContainText("Record version 2");await page.getByLabel("Review reason").fill("Reviewed the current revision; insufficient evidence");await page.getByRole("button",{name:"Reject record"}).click();await expect(page.getByRole("status").filter({hasText:"Record version"})).toContainText("Rejected");await page.reload();await expect(page.getByRole("status").filter({hasText:"Record version"})).toContainText("Rejected");
});

test("five saved rows preserve the original mobile Work Record layout",async({context,page})=>{
 await session(context,worker,{record:null},[]);
 const items=["8","8","8.5","8","8"].map((hours,index)=>({workId:`40000000-0000-4000-8000-00000000003${index}`,version:1,state:index===4?"submitted":"verified",hours,periodStart:`2026-10-${12+index}`,periodEnd:`2026-10-${12+index}`}));
 await context.route("**/api/v1/work-records",route=>route.fulfill({json:{data:{items,nextCursor:null}}}));
 mkdirSync("test-results/day5-visual",{recursive:true});
 for(const viewport of [{width:390,height:844},{width:378,height:744},{width:320,height:844}]){
  await page.setViewportSize(viewport);await page.goto("/app/work-record");await expect(page.getByRole("region",{name:"Saved work records"}).getByRole("button")).toHaveCount(5);
  await page.screenshot({path:`test-results/day5-visual/${viewport.width}-five-rows.png`,fullPage:true,animations:"disabled"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
