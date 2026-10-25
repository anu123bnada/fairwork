import { test,expect,type BrowserContext } from "@playwright/test";
import { mkdirSync } from "node:fs";
import type { AgreementWorkflow } from "../../src/features/offer/workflow-schema";
const worker="40000000-0000-4000-8000-000000000012", representative="40000000-0000-4000-8000-000000000013", id="40000000-0000-4000-8000-000000000021", item="40000000-0000-4000-8000-000000000051", company="40000000-0000-4000-8000-000000000001";
const time="2026-10-14T01:00:00+00:00",hash="a".repeat(64),itemHash="b".repeat(64);
function fixture():AgreementWorkflow {return {agreementId:id,workerId:worker,companyId:company,representativeId:representative,currentVersion:1,effectiveVersion:null,versions:[{version:1,state:"proposed",status:"awaiting_acknowledgements",contentHash:hash,itemSetHash:itemHash,unresolvedIds:[item],createdAt:time,proposedAt:time,acknowledgements:[],decisions:[],content:{schemaVersion:"agreement-terms.v1",workerId:worker,companyId:company,representativeId:representative,authorityDecisionId:company,source:{offerId:id,version:1,termHash:hash,snapshot:{salary:120000}},terms:{"salary.amount":120000,termination:null},unresolved:[{itemId:item,fieldId:"termination",issueCode:"not_stated",sourceQuestionId:null,explanation:"Termination notice remains unresolved."}],sharedQuestions:[],answers:[]}}]};}
// Transport fixtures exercise browser behavior; SQL authorization is tested
// separately against the real migration. Never a production mock backend.
async function session(context:BrowserContext,actor:string,model:AgreementWorkflow,requests:Record<string,unknown>[]) {
 await context.route("**/api/v1/me",route=>route.fulfill({json:{data:{id:actor,displayName:"Synthetic participant",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await context.route("**/api/v1/agreement-workflows**",async route=>{
   if(route.request().method()==="GET")return route.fulfill({json:{data:model}});
   const body=route.request().postDataJSON();requests.push(body);const v=model.versions.at(-1)!;
   if(body.operation!=="create"&&(body.expectedVersion!==v.version||body.expectedHash!==v.contentHash))return route.fulfill({status:409,json:{error:{code:"VERSION_CONFLICT"}}});
   if(body.operation==="create"){model.agreementId=body.agreementId;v.state="draft";v.status="ready_for_review";v.proposedAt=null;}
   if(body.operation==="propose"){v.state="proposed";v.status="awaiting_acknowledgements";v.proposedAt=time;}
   if(body.operation==="acknowledge")v.acknowledgements.push({actorId:actor,contentHash:v.contentHash,itemIds:v.unresolvedIds,itemSetHash:v.itemSetHash,recordedAt:time});
   if(body.operation==="decide")v.decisions.push({actorId:actor,decision:body.decision,contentHash:v.contentHash,recordedAt:time});
   if(body.decision==="decline"){v.state="declined";v.status="declined";}
   else if(v.decisions.length===2){v.state="confirmed";v.status="effective";model.effectiveVersion=v.version;}
   else if(v.acknowledgements.length===2)v.status="awaiting_confirmations";
   return route.fulfill({json:{data:{agreementId:id,version:v.version,contentHash:v.contentHash,state:v.state,operation:body.operation,actorId:actor,recordedAt:time}}});
 });
}
test("manual agreement lookup remains recoverable after refresh and rechecks access",async({context,page})=>{
 const model=fixture(),requests:Record<string,unknown>[]=[];await session(context,worker,model,requests);
 await page.goto("/app/agreement-workflow");
 await page.getByLabel("Versioned agreement ID",{exact:true}).fill(id);
 await page.getByRole("button",{name:"Open versioned agreement"}).click();
 await expect(page).toHaveURL(`/app/agreement-workflow?workflowId=${id}`);
 await expect(page.getByRole("region",{name:"Saved terms version 1"})).toContainText("120000");
 await page.reload();
 await expect(page.getByRole("region",{name:"Saved terms version 1"})).toContainText("120000");
 await expect(page.getByText(/not cryptographic signatures/)).toBeVisible();
 await page.route("**/api/v1/agreement-workflows?*",route=>route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}}));
 await page.reload();
 await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();
 await expect(page.getByRole("region",{name:"Saved terms version 1"})).toHaveCount(0);
 expect(requests).toHaveLength(0);
});

test("failed manual lookup does not install a participant URL",async({context,page})=>{
 await session(context,worker,fixture(),[]);
 await context.route("**/api/v1/agreement-workflows?*",route=>route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}}));
 await page.goto("/app/agreement-workflow");
 await page.getByLabel("Versioned agreement ID",{exact:true}).fill(id);
 await page.getByRole("button",{name:"Open versioned agreement"}).click();
 await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();
 await expect(page).toHaveURL("/app/agreement-workflow");
 await expect(page.getByRole("button",{name:"Confirm this exact version"})).toHaveCount(0);
});

test("two independent browser contexts acknowledge, confirm and reopen the same frozen revision",async({browser})=>{
 const a=await browser.newContext({viewport:{width:390,height:844}}),b=await browser.newContext({viewport:{width:378,height:744}});
 try {
  const model=fixture(),requests:Record<string,unknown>[]=[];await session(a,worker,model,requests);await session(b,representative,model,requests);
  const first=await a.newPage(),second=await b.newPage();
  await first.goto(`/app/agreement-workflow?workflowId=${id}`);
  await expect(first.getByRole("link",{name:"Check",exact:true})).toHaveAttribute("aria-current","page");
  await expect(first.getByRole("button",{name:"Record my acknowledgement"})).toBeDisabled();
  await expect(first.getByRole("button",{name:"Confirm this exact version"})).toBeDisabled();
  await first.getByRole("checkbox",{name:"Acknowledge termination"}).check();
  await first.getByRole("button",{name:"Record my acknowledgement"}).click();
  await first.getByRole("button",{name:"Confirm this exact version"}).click();
  await first.reload();await expect(first.locator(".fw-signature").filter({hasText:"Employer"})).toContainText("Awaiting acknowledgement");
  await second.goto(`/app/agreement-workflow?workflowId=${id}`);
  await expect(second.getByRole("checkbox",{name:"Acknowledge termination"})).not.toBeChecked();
  await second.getByRole("checkbox",{name:"Acknowledge termination"}).check();await second.getByRole("button",{name:"Record my acknowledgement"}).click();
  await second.getByRole("button",{name:"Confirm this exact version"}).click();
  await expect(second.getByRole("status").filter({hasText:/Version [0-9]/})).toContainText("Both participants confirmed");
  await first.getByRole("button",{name:"Reload saved version"}).click();
  await expect(first.getByRole("status").filter({hasText:/Version [0-9]/})).toContainText("Both participants confirmed");
  await expect(first.getByRole("link",{name:"Open Work Record"})).toHaveAttribute("href",`/app/work-record?agreementBasisId=${id}`);
  expect(requests.every(r=>!("actorId" in r)&&!("workerId" in r)&&!("companyId" in r))).toBe(true);
  expect(requests).toHaveLength(4);
  mkdirSync("test-results/day4-visual",{recursive:true});
  await first.screenshot({path:"test-results/day4-visual/390-confirmed.png",fullPage:true});await second.screenshot({path:"test-results/day4-visual/378-confirmed.png",fullPage:true});
  expect(await first.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await a.close();await b.close();}
});
test("saved offer creates a private draft and requires explicit sharing before proposal",async({context,page})=>{
 const model=fixture(),requests:Record<string,unknown>[]=[];await session(context,worker,model,requests);
 await context.route("**/api/v1/agreements?*",route=>route.fulfill({json:{data:{offer:{offerId:id,companyId:company,workerId:worker,representativeId:representative,requesterId:worker,requesterRole:"WORKER",version:1,termHash:hash,snapshot:{salary:120000},changes:[],unresolved:[]},agreementId:id,confirmation:null,answers:[],canConfirm:false}}}));
 await page.goto(`/app/agreement?offerId=${id}`);await page.getByText("Create a versioned agreement",{exact:true}).click();
 await page.getByRole("button",{name:"Create secure draft"}).click();
 await expect(page).toHaveURL(/\/app\/agreement-workflow\?workflowId=/);
 await expect(page.getByRole("button",{name:"Propose this version"})).toBeDisabled();
 expect(requests[0]).toMatchObject({operation:"create",offerId:id,offerVersion:1,expectedSourceHash:hash,representativeId:representative});
 expect(requests[0]).not.toHaveProperty("terms");expect(requests[0]).not.toHaveProperty("workerId");
 await page.getByRole("checkbox",{name:/Share these terms/}).check();await page.getByRole("button",{name:"Propose this version"}).click();
 await expect(page.getByRole("status").filter({hasText:/Version [0-9]/})).toContainText("Awaiting independent acknowledgements");
 await expect(page.getByRole("checkbox",{name:"Acknowledge termination"})).not.toBeChecked();
 expect(requests[1]).toMatchObject({operation:"propose",sharedQuestionIds:[]});
});
test("stale UI refuses confirmation, reload clears unsaved checks, decline survives refresh",async({context,page})=>{
 const model=fixture(),requests:Record<string,unknown>[]=[];await session(context,worker,model,requests);
 await page.goto(`/app/agreement-workflow?workflowId=${id}`);await page.getByRole("checkbox",{name:"Acknowledge termination"}).check();
 const amended=structuredClone(model.versions[0]!);amended.version=2;amended.contentHash="c".repeat(64);model.versions.push(amended);model.currentVersion=2;
 await page.getByRole("button",{name:"Record my acknowledgement"}).click();await expect(page.locator('.fw-error[role="alert"]')).toContainText("changed");
 await page.getByRole("button",{name:"Reload authoritative agreement"}).click();await expect(page.getByRole("checkbox",{name:"Acknowledge termination"})).not.toBeChecked();
 await page.getByRole("button",{name:"Decline this version"}).click();await page.reload();await expect(page.getByRole("status").filter({hasText:/Version [0-9]/})).toContainText("declined");
 await expect(page.getByRole("button",{name:"Confirm this exact version"})).toHaveCount(0);
});
test("interrupted acknowledgement retries reuse the key; offline reload and expired sessions fail closed",async({context,page})=>{
 const model=fixture(),requests:Record<string,unknown>[]=[];await session(context,worker,model,requests);
 let lost=true;const attempts:Record<string,unknown>[]=[];
 await page.route("**/api/v1/agreement-workflows",async route=>{const body=route.request().postDataJSON();attempts.push(body);if(lost){lost=false;return route.abort();}return route.fallback();});
 await page.goto(`/app/agreement-workflow?workflowId=${id}`);await page.getByRole("checkbox",{name:"Acknowledge termination"}).check();
 await page.getByRole("button",{name:"Record my acknowledgement"}).click();await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();
 await page.getByRole("button",{name:"Record my acknowledgement"}).click();await expect(page.getByRole("button",{name:"Confirm this exact version"})).toBeEnabled();
 expect(attempts[0]!.idempotencyKey).toBe(attempts[1]!.idempotencyKey);
 await page.route("**/api/v1/agreement-workflows?*",route=>route.abort());await page.getByRole("button",{name:"Reload saved version"}).click();await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();await expect(page.getByRole("button",{name:"Confirm this exact version"})).toHaveCount(0);
 await page.route("**/api/v1/agreement-workflows?*",route=>route.fulfill({status:401,json:{error:{code:"AUTH_REQUIRED"}}}));
 await page.getByRole("button",{name:"Reload authoritative agreement"}).click();await expect(page.getByRole("link",{name:"Sign in to reopen this agreement"})).toHaveAttribute("href",`/sign-in?workflowId=${id}`);
});
