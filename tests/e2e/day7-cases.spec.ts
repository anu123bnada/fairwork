import { test,expect,type BrowserContext } from "@playwright/test";
import { translate } from "../../src/i18n";
import { mkdirSync } from "node:fs";
import type { CaseView } from "../../src/features/cases/schema";
const worker="40000000-0000-4000-8000-000000000012",reviewer="40000000-0000-4000-8000-000000000016",operator="40000000-0000-4000-8000-000000000017",id="40000000-0000-4000-8000-000000000021",rep="40000000-0000-4000-8000-000000000013";
const time="2026-10-15T01:00:00Z",hash="a".repeat(64),proof="b".repeat(64);
function model():CaseView{return {caseId:id,workId:id,workVersion:1,revision:1,status:"open",reasonCode:"evidence_integrity",reason:"Please review the maintenance log",openedAt:time,closedAt:null,outcome:null,basis:{role:"Motorcycle Technician",tasks:"Completed motorcycle maintenance",hours:"8",periodStart:"2026-10-12",periodEnd:"2026-10-12",contentHash:hash,evidenceHash:proof,evidence:[{id,ownerId:worker,text:"Private maintenance evidence",recordedAt:time}]},assignment:null,resolution:null,events:[{id,revision:1,actorId:worker,operation:"open",note:"Please review the maintenance log",recordedAt:time}],permissions:{canAssign:false,canRevoke:false,canAccept:false,canDecide:false}};}
// HTTP fixtures exercise UI only. Separate real PostgreSQL tests prove permissions/persistence.
async function session(context:BrowserContext,state:CaseView,actor=worker,requests:Record<string,unknown>[]=[],exists=true){
 await context.route("**/api/v1/me",route=>route.fulfill({json:{data:{id:actor,displayName:"Nimal Perera",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await context.route("**/api/v1/work-records**",route=>route.fulfill({json:{data:{workId:id,agreementId:id,workerId:worker,companyId:id,representativeId:rep,currentVersion:1,versions:[{version:1,state:"verified",contentHash:hash,evidenceHash:proof,createdAt:time,submittedAt:time,decision:null,content:{...state.basis,schemaVersion:"work-record.v1",contentHash:undefined,evidenceHash:undefined,agreement:{id,version:1,contentHash:hash,authorityDecisionId:id,effectiveAt:time,scope:"Motorcycle maintenance"}}}]}}}));
 await context.route("**/api/v1/work-cases**",route=>{
  if(route.request().method()==="POST"){
   const body=route.request().postDataJSON();requests.push(body);exists=true;
   if(body.operation==="open"){state.caseId=body.caseId;state.reason=body.reason;state.reasonCode=body.reasonCode;}
   else{if(body.expectedRevision!==state.revision)return route.fulfill({status:409,json:{error:{code:"VERSION_CONFLICT"}}});state.revision++;}
   if(body.operation==="assign")state.assignment={id,reviewerId:body.reviewerId,expiresAt:body.expiresAt,acceptedAt:null,revokedAt:null};
   if(body.operation==="accept"&&state.assignment){if(body.noConflict)state.assignment.acceptedAt=time;else state.assignment.revokedAt=time;}
   if(body.operation==="revoke"&&state.assignment)state.assignment.revokedAt=time;
   if(body.operation==="decide"){state.status="resolved";state.closedAt=time;state.outcome=body.outcome;state.resolution={outcome:body.outcome,rationale:body.rationale,reviewerId:actor,assignmentId:id,recordedAt:time};}
   const operation=body.operation==="accept"&&!body.noConflict?"refuse":body.operation;
   if(operation!=="open")state.events.push({id:crypto.randomUUID(),revision:state.revision,actorId:actor,operation,note:body.reason??body.rationale??"Reviewer declaration",recordedAt:time});
   return route.fulfill({json:{data:{caseId:state.caseId,revision:state.revision,status:state.status,operation,actorId:actor,recordedAt:time}}});
  }
  const view=structuredClone(state),accepted=actor===reviewer&&!!view.assignment?.acceptedAt&&!view.assignment.revokedAt;
  if(actor!==worker&&!accepted){view.reason=null;view.reasonCode=null;view.basis=null;view.events=[];view.resolution=null;view.outcome=null;}
  view.permissions={canAssign:actor===operator&&view.status==="open"&&(!view.assignment||!!view.assignment.revokedAt),canRevoke:actor===operator&&view.status==="open"&&!!view.assignment&&!view.assignment.revokedAt,canAccept:actor===reviewer&&view.status==="open"&&!!view.assignment&&!view.assignment.acceptedAt&&!view.assignment.revokedAt,canDecide:accepted&&view.status==="open"};
  const {caseId,workId,workVersion,revision,status,openedAt}=view;
  return route.fulfill({json:{data:new URL(route.request().url()).searchParams.has("caseId")?view:{items:exists?[{caseId,workId,workVersion,revision,status,openedAt}]:[],nextCursor:null}}});
 });
}
test("worker opens a version-bound concern and recovers the saved case after refresh and a new session",async({browser})=>{const a=await browser.newContext(),b=await browser.newContext(),state=model(),requests:Record<string,unknown>[]=[];try{await session(a,state,worker,requests,false);const page=await a.newPage();await page.goto(`/app/cases?workId=${id}`);await expect(page.getByRole("button",{name:"Submit concern"})).toBeDisabled();await page.getByRole("button",{name:"Load record for review"}).click();await expect(page.getByText("Version 1 · Motorcycle Technician · 8 hours")).toBeVisible();await page.getByLabel("Concern details").fill("Please review the maintenance log");await page.getByRole("button",{name:"Submit concern"}).click();await expect(page.getByRole("region",{name:"Case details"})).toBeVisible();await page.reload();await expect(page.getByText("Private maintenance evidence",{exact:true})).toBeVisible();await session(b,state);const other=await b.newPage();await other.goto(`/app/cases?caseId=${state.caseId}`);await expect(other.getByText("Private maintenance evidence",{exact:true})).toBeVisible();expect(requests).toHaveLength(1);expect(requests[0]).toMatchObject({operation:"open",workId:id,expectedVersion:1,expectedHash:hash,expectedEvidenceHash:proof});expect(requests[0]).not.toHaveProperty("reporterId");}finally{await a.close();await b.close();}});
test("operator assigns without evidence access and reviewer explicitly accepts before deciding",async({browser})=>{const a=await browser.newContext(),b=await browser.newContext(),state=model(),requests:Record<string,unknown>[]=[];try{await session(a,state,operator,requests);await session(b,state,reviewer,requests);const page=await a.newPage();await page.goto(`/app/cases?caseId=${id}`);await expect(page.getByText("Private maintenance evidence",{exact:true})).toHaveCount(0);await page.getByLabel("Reviewer ID",{exact:true}).fill(reviewer);await page.getByLabel("Assignment expiry").fill("2026-10-20T12:00");await page.getByLabel("Assignment reason").fill("Independent reviewer selected");await page.getByRole("button",{name:"Assign reviewer"}).click();await expect(page.getByText(/Awaiting acceptance/)).toBeVisible();const review=await b.newPage();await review.goto(`/app/cases?caseId=${id}`);await expect(review.getByRole("button",{name:"Accept independent review"})).toBeDisabled();await expect(review.getByText("Private maintenance evidence",{exact:true})).toHaveCount(0);await review.getByRole("checkbox",{name:/no conflict of interest/}).check();await review.getByRole("button",{name:"Accept independent review"}).click();await expect(review.getByText("Private maintenance evidence",{exact:true})).toBeVisible();await expect(review.getByRole("button",{name:"Record final decision"})).toBeDisabled();await review.getByLabel("Decision",{exact:true}).selectOption("correction_required");await review.getByLabel("Decision rationale").fill("A corrected record and fresh verification are required");await review.getByRole("button",{name:"Record final decision"}).click();await expect(review.getByRole("region",{name:"Decision receipt"})).toContainText("correction required");await expect(review.getByRole("button",{name:"Record final decision"})).toHaveCount(0);expect(requests.map(x=>x.operation)).toEqual(["assign","accept","decide"]);}finally{await a.close();await b.close();}});
test("reviewer can decline without evidence disclosure",async({context,page})=>{const state=model();state.assignment={id,reviewerId:reviewer,expiresAt:"2026-10-20T01:00:00Z",acceptedAt:null,revokedAt:null};await session(context,state,reviewer);await page.goto(`/app/cases?caseId=${id}`);await page.getByRole("button",{name:"Decline assignment"}).click();await expect(page.getByText("Assignment declined. Evidence access has ended.")).toBeVisible();await expect(page.getByText("Private maintenance evidence",{exact:true})).toHaveCount(0);});
test("offline and expired reads clear private evidence and offer recovery",async({context,page})=>{await session(context,model());await page.goto(`/app/cases?caseId=${id}`);await expect(page.getByText("Private maintenance evidence",{exact:true})).toBeVisible();await page.route("**/api/v1/work-cases**",route=>route.abort());await page.getByRole("button",{name:"Reload cases"}).click();await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();await expect(page.getByText("Private maintenance evidence",{exact:true})).toHaveCount(0);await page.route("**/api/v1/work-cases**",route=>route.fulfill({status:401,json:{error:{code:"AUTH_REQUIRED"}}}));await page.getByRole("button",{name:"Reload cases"}).click();await expect(page.getByRole("link",{name:"Sign in to reopen your case link"})).toBeVisible();});
test("case screens retain mobile layout and native browser back navigation",async({context,page})=>{await session(context,model());mkdirSync("test-results/day7-visual",{recursive:true});for(const width of [390,378,320]){await page.setViewportSize({width,height:width===378?744:844});await page.goto(`/app/cases?caseId=${id}`);await expect(page.getByRole("region",{name:"Case details"})).toBeVisible();await page.screenshot({path:`test-results/day7-visual/${width}-case.png`,fullPage:true,animations:"disabled"});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}await page.goto("/app/settings");await page.getByRole("link",{name:"Case review",exact:true}).click();await expect(page.getByRole("heading",{name:"Review a concern"})).toBeVisible();await page.goBack();await expect(page).toHaveURL(/\/app\/settings$/);});
test("stale decisions fail without claiming success or keeping private data",async({context,page})=>{const state=model();state.assignment={id,reviewerId:reviewer,expiresAt:"2026-10-20T01:00:00Z",acceptedAt:time,revokedAt:null};await session(context,state,reviewer);await page.goto(`/app/cases?caseId=${id}`);await page.getByLabel("Decision rationale").fill("Review completed");await page.route("**/api/v1/work-cases",route=>route.fulfill({status:409,json:{error:{code:"VERSION_CONFLICT"}}}));await page.getByRole("button",{name:"Record final decision"}).click();await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();await expect(page.getByRole("region",{name:"Decision receipt"})).toHaveCount(0);await expect(page.getByText("Private maintenance evidence",{exact:true})).toHaveCount(0);});

for (const locale of ["si","ta","de"] as const) {
 test(`the case review screen is translated in ${locale}`,async({context,page})=>{
  await session(context,model());
  await page.goto("/app/settings");await page.getByLabel("Language").selectOption(locale);
  await page.goto(`/app/cases?caseId=${id}`);
  await expect(page.getByRole("heading",{name:translate(locale,"cs.title")})).toBeVisible();
  await expect(page.getByText(translate(locale,"cs.intro"))).toBeVisible();
  await expect(page.getByRole("region",{name:translate(locale,"cs.detailsAria")})).toContainText(translate(locale,"cs.statusOpen"));
  await expect(page.locator("body")).not.toContainText(/\bcs\.[a-zA-Z.]+\b/);
 });
}

test("the open-case form offers every approved dispute category and sends the chosen one",async({context,page})=>{
 const state=model(),requests:Record<string,unknown>[]=[];
 await session(context,state,worker,requests,false);
 await page.goto(`/app/cases?workId=${id}`);
 await page.getByRole("button",{name:"Load record for review"}).click();
 const select=page.getByLabel("Concern type");
 const labels=await select.locator("option").allInnerTexts();
 for(const label of ["Incorrect pay","Incorrect working hours","Incorrect duties","Incorrect dates","Contract terms","Missing payment","Unfair termination (unproven concern)","Other"])expect(labels,label).toContain(label);
 await select.selectOption({label:"Missing payment"});
 await page.getByLabel("Concern details").fill("Two months of pay are missing");
 await page.getByRole("button",{name:"Submit concern"}).click();
 await expect(page.getByRole("region",{name:"Case details"})).toBeVisible();
 expect(requests.find(request=>request.operation==="open")).toMatchObject({reasonCode:"missing_payment"});
});

test("the opener attaches a vault document as an evidence reference, and the reference lists its checksum",async({context,page})=>{
 const state=model(),requests:Record<string,unknown>[]=[];
 await session(context,state,worker,requests,false);
 const doc="50000000-0000-4000-8000-0000000000aa",sha="ab".repeat(32);let items:Record<string,unknown>[]=[];const attaches:Record<string,unknown>[]=[];
 await context.route("**/api/v1/vault",route=>route.fulfill({json:{data:{items:[{documentId:doc,title:"Payslip March",category:"payslip",fileName:"march.pdf",mediaType:"application/pdf",byteSize:2048,sha256:sha,createdAt:"2026-10-27T08:00:00Z"}],limit:50,used:1,storageConfigured:true}}}));
 await context.route("**/api/v1/work-cases/evidence**",route=>{
  if(route.request().method()==="GET")return route.fulfill({json:{data:{caseId:id,items}}});
  const body=route.request().postDataJSON();attaches.push(body);
  items=[{documentId:doc,title:"Payslip March",category:"payslip",fileName:"march.pdf",mediaType:"application/pdf",byteSize:2048,sha256:sha,attachedAt:time,attachedBy:worker}];
  return route.fulfill({json:{data:{caseId:id,documentId:doc,replayed:false}}});
 });
 await page.goto(`/app/cases?caseId=${id}`);
 const region=page.getByRole("region",{name:"Evidence references"});
 await expect(region).toContainText("No evidence references yet.");
 await region.getByText("Attach one of my vault documents as a reference").click();
 await region.getByLabel("Document").selectOption({label:"Payslip March"});
 await region.getByRole("button",{name:"Attach reference"}).click();
 await expect(region).toContainText("Payslip March");await expect(region).toContainText(`checksum ${sha.slice(0,12)}`);
 expect(attaches).toEqual([{caseId:id,documentId:doc}]);
});
