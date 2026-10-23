import { expect, test } from "@playwright/test";
const id="40000000-0000-4000-8000-000000000012";

test("organization approval validates date and evidence, then preserves idempotency after a lost response",async({page})=>{
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic operator",locale:"en",timeZone:"UTC",revision:1,capabilities:["authority_operator"]}}}));
 await page.route("**/api/v1/auth/mfa",route=>route.fulfill({json:{data:{factors:[{id,status:"verified"}]}}}));
 const keys:string[]=[];
 await page.route("**/api/v1/operator/organization-requests",route=>{
  if(route.request().method()==="GET")return route.fulfill({json:{data:{items:[{requestId:id,companyId:null,companyName:"Synthetic organization",statement:"Independent membership review",createdAt:"2026-10-22T12:00:00Z",subjectId:"40000000-0000-4000-8000-000000000013"}],nextCursor:null}}});
  const key=route.request().headers()["idempotency-key"];
  if(!key)throw new Error("Organization decision omitted its idempotency key");
  keys.push(key);
  expect(route.request().postDataJSON()).toMatchObject({requestId:id,decision:"approve",expectedRevision:0,reviewedEvidenceRefs:["demo:local/review"]});
  if(keys.length===1)return route.abort("failed");
  return route.fulfill({json:{data:{requestId:id,decision:"approve",companyId:id}}});
 });
 await page.goto("/operator/authority");
 const panel=page.getByRole("region",{name:"Organization requests"});
 await panel.getByRole("combobox",{name:"Decision",exact:true}).selectOption("approve");
 await panel.getByLabel("Decision rationale").fill("Independent synthetic evidence reviewed");
 await panel.getByRole("checkbox").check();
 await panel.getByRole("button",{name:"Record independent decision"}).click();
 await expect(panel.getByRole("alert")).toContainText("Choose an approval expiry");
 await expect(panel.getByLabel("Approval expires (within 30 days)")).toBeFocused();
 expect(keys).toHaveLength(0);
 // Date is interpreted in the browser's local zone; tomorrow is within the window.
 const tomorrow=await page.evaluate(()=>{const d=new Date(Date.now()+86400000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);});
 await panel.getByLabel("Approval expires (within 30 days)").fill(tomorrow);
 await panel.getByRole("button",{name:"Record independent decision"}).click();
 await expect(panel.getByRole("alert")).toContainText("reviewed synthetic evidence");
 expect(keys).toHaveLength(0);
 await panel.getByLabel("Reviewed synthetic evidence references").fill("demo:local/review");
 await panel.getByRole("button",{name:"Record independent decision"}).click();
 await expect(panel.getByRole("alert")).toBeVisible();
 await panel.getByRole("button",{name:"Record independent decision"}).click();
 await expect(panel.getByRole("status")).toContainText("Independent decision recorded");
 expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
});

test("new member sees actionable invalid organization feedback without submitting",async({page})=>{
 let writes=0;
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic applicant",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/offers?**",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
 await page.route("**/api/v1/companies**",route=>route.fulfill({json:{data:{items:[],scope:"your_authorized_organizations",externalSourceConfigured:false}}}));
 await page.route("**/api/v1/organizations",route=>{if(route.request().method()==="POST")writes++;return route.fulfill({json:{data:{items:[],nextCursor:null}}});});
 await page.goto("/app/employer");
 const panel=page.getByRole("region",{name:"Organization requests"});
 await panel.getByLabel("Request type").selectOption("existing");
 await panel.getByLabel("Organization ID",{exact:true}).fill("unknown");
 await panel.getByLabel("Membership request statement").fill("Requesting independent approval");
 await panel.getByRole("button",{name:"Request independent approval"}).click();
 await expect(panel.getByRole("alert")).toContainText("valid organization ID");
 await expect(panel.getByLabel("Organization ID",{exact:true})).toBeFocused();
 expect(writes).toBe(0);
});
