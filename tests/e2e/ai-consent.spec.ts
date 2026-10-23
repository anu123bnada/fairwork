import { test,expect } from "@playwright/test";
import { extractOfferTermsRuleBased } from "../../src/features/offer/deterministic-extractor";
// Browser-only transport fixtures. No external model call or privacy approval.
test("AI preview minimizes identifiers, text edits reset consent and late results remain tied to their input",async({page})=>{
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id:"40000000-0000-4000-8000-000000000001",displayName:"Synthetic",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 let release:()=>void=()=>{};const pending=new Promise<void>(resolve=>{release=resolve;});
 await page.route("**/api/v1/offers/analyze",async route=>{
  if(route.request().method()==="GET")return route.fulfill({json:{data:{configured:true,provider:"gemini",model:"gemini-synthetic-test",noticeVersion:"offer-analysis.v1",processingRegion:"Fixture only",dataUse:"Fixture only; no transmission",policyHash:"a".repeat(64)}}});
  const body=route.request().postDataJSON();expect(body.consent.transmit).toBe(true);expect(body.consent.provider).toBe("gemini");
  await pending;return route.fulfill({json:{data:{configured:true,provider:"gemini",status:"SUCCESS",message:"Fixture advisory response",isAdvisory:true,extractedAt:"2026-10-18T00:00:00Z",data:null}}});
 });
 await page.goto("/app/add-offer");
 const source=page.getByLabel("Paste offer text"),preview=page.getByLabel("Text that will be sent");
 await source.fill("Name: Synthetic Private Person\nSalary: LKR 80000 monthly\nEmail: private@example.test");
 await expect(preview).not.toHaveValue(/Synthetic Private Person|private@example.test/);
 await expect(preview).toHaveValue(/80000/);
 const consent=page.getByRole("checkbox",{name:/I reviewed this text/});const send=page.getByRole("button",{name:"Send for AI analysis"});
 await expect(send).toBeDisabled();await consent.check();
 await source.fill("Role: Technician, LKR 90000 monthly, 40 hours per week");await expect(consent).not.toBeChecked();
 await consent.check();await send.click();await source.fill("Role: Updated technician, salary not yet specified");release();
 await expect(page.getByRole("button",{name:"Send for AI analysis"})).toBeVisible();
 await expect(page.getByText("Fixture advisory response")).toHaveCount(0);await expect(consent).not.toBeChecked();
});

test("unconfigured AI explains the blocker and cannot send offer data",async({page})=>{
 let sends=0;
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id:"40000000-0000-4000-8000-000000000001",displayName:"Synthetic",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/offers/analyze",route=>{
  if(route.request().method()!=="GET")sends++;
  return route.fulfill({json:{data:{configured:false,provider:null,model:null,noticeVersion:"offer-analysis.v1",processingRegion:null,dataUse:null,policyHash:null}}});
 });
 await page.goto("/app/add-offer");
 await expect(page.getByRole("status").filter({hasText:"Live AI is unavailable"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Send for AI analysis"})).toHaveCount(0);
 expect(sends).toBe(0);
});

test("structured AI response exposes terms and missing details without changing the saved draft",async({page})=>{
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id:"40000000-0000-4000-8000-000000000001",displayName:"Synthetic",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/offers/analyze",route=>route.fulfill({json:{data:route.request().method()==="GET"
  ?{configured:true,provider:"gemini",model:"gemini-synthetic-test",noticeVersion:"offer-analysis.v1",processingRegion:"Fixture only",dataUse:"Fixture only",policyHash:"a".repeat(64)}
  :{configured:true,provider:"gemini",status:"SUCCESS",message:"Fixture advisory response",isAdvisory:true,extractedAt:"2026-10-22T00:00:00Z",data:extractOfferTermsRuleBased("Role: Technician\nSalary: LKR 85000 monthly").data}}}));
 await page.goto("/app/add-offer");
 await page.getByLabel("Paste offer text").fill("Role: Technician\nSalary: LKR 85000 monthly");
 await page.getByRole("checkbox",{name:/I reviewed this text/}).check();
 await page.getByRole("button",{name:"Send for AI analysis"}).click();
 await expect(page.getByRole("region",{name:"AI extracted terms"})).toContainText("85000");
 await expect(page.getByRole("region",{name:"AI extracted terms"})).toContainText("Technician");
 await expect(page.getByRole("region",{name:"AI missing details"})).toContainText("hoursPerWeek");
 await expect(page.getByLabel("Pay amount")).toHaveValue("");
});
