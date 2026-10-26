import { test,expect } from "@playwright/test";
import { translate } from "../../src/i18n";
test.use({viewport:{width:390,height:844}});
test("sharing previews an explicit summary and requires review before activating a named-recipient grant",async({page})=>{
 const id="40000000-0000-4000-8000-000000000001",recipient="40000000-0000-4000-8000-000000000002";
 const hash="a".repeat(64);let active=false,grantId="",itemId="";
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic owner",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/passport",route=>route.fulfill({json:{data:{policyVersion:"private-work-passport.v1",passportId:id,ownerId:id,createdAt:"2026-10-18T00:00:00Z",entries:[{workId:id,version:1,role:"Technician",periodStart:"2026-10-01",periodEnd:"2026-10-10",hours:"40",summary:"Private source summary",companyId:id,companyName:"Synthetic company",agreementId:id,agreementVersion:1,agreementHash:hash,agreementEffectiveAt:"2026-10-01T00:00:00Z",verificationId:id,verifiedAt:"2026-10-11T00:00:00Z",verifierId:recipient,authorityDecisionId:id,evidenceCount:1,evidenceHash:hash}],nextCursor:null}}}));
 await page.route("**/api/v1/passport/sharing**",async route=>{
  const req=route.request();
  if(req.method()==="POST"){
   const body=req.postDataJSON();
   if(body.operation==="select"){expect(body.summary).toBe("My public task summary");itemId=body.itemId;}
   else if(body.operation==="prepare"){expect(body.recipientId).toBe(recipient);grantId=body.grantId;}
   else if(body.operation==="activate")active=true;
   return route.fulfill({json:{data:{itemId,grantId:body.operation==="select"?null:grantId,operation:body.operation}}});
  }
  if(req.url().includes("mode=preview"))return route.fulfill({json:{data:{projectionVersion:"passport.v1",grantId,expiresAt:"2026-10-19T00:00:00Z",active,entries:[{task_summary:"My public task summary",verification_status:"currently_eligible"}]}}});
  return route.fulfill({json:{data:{items:grantId?[{grantId,itemId,recipientId:recipient,owner:true,active,revoked:false,expiresAt:"2026-10-19T00:00:00Z"}]:[],nextCursor:null}}});
 });
 await page.goto("/app/share");await page.getByRole("textbox",{name:"Disclosure summary",exact:true}).fill("My public task summary");
 await page.getByLabel("Recipient account ID").fill(recipient);await page.getByLabel("Expires at").fill("2026-10-19T00:00");
 await page.getByRole("button",{name:"Prepare private preview"}).click();
 const preview=page.getByRole("region",{name:"Owner preview"});await expect(preview).toContainText("My public task summary");
 await expect(page.getByText("Private source summary",{exact:true})).toHaveCount(0);
 await expect(preview.getByRole("button",{name:"Activate this grant"})).toBeDisabled();
 await preview.getByRole("checkbox").check();await preview.getByRole("button",{name:"Activate this grant"}).click();
 await expect(page.getByRole("status")).toContainText("Named-recipient access activated");
 await expect(preview.getByRole("button",{name:"Copy recipient link"})).toBeVisible();
 expect(active).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("a named-recipient link survives sign-in without granting anonymous access",async({page})=>{
 const id="40000000-0000-4000-8000-000000000003";let signedIn=false;
 await page.route("**/api/v1/me",r=>signedIn?r.fulfill({json:{data:{id,displayName:"Synthetic recipient",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}):r.fulfill({status:401,json:{error:{code:"AUTH_REQUIRED"}}}));
 await page.route("**/api/v1/auth/sign-in",r=>{signedIn=true;return r.fulfill({json:{data:{signedIn:true}}});});
 await page.route("**/api/v1/passport",r=>r.fulfill({json:{data:{policyVersion:"private-work-passport.v1",passportId:null,ownerId:id,createdAt:null,entries:[],nextCursor:null}}}));
 await page.route("**/api/v1/passport/sharing**",r=>r.fulfill({json:{data:r.request().url().includes("grantId=")?{projectionVersion:"passport.v1",grantId:id,expiresAt:"2026-10-19T00:00:00Z",active:true,entries:[{task_summary:"Authorized synthetic disclosure"}]}:{items:[],nextCursor:null}}}));
 await page.goto(`/app/share?grantId=${id}`);await page.getByRole("link",{name:"Sign in",exact:true}).click();
 await expect(page).toHaveURL(new RegExp(`/sign-in\\?grantId=${id}$`));
 await page.getByRole("link",{name:"Sign-in information",exact:true}).click();
 await page.getByRole("link",{name:"Back to sign in",exact:true}).click();
 await expect(page).toHaveURL(new RegExp(`/sign-in\\?grantId=${id}$`));
 await page.getByLabel("Email address").fill("recipient@example.test");await page.getByLabel("Password",{exact:true}).fill("synthetic-only-password");await page.getByRole("button",{name:"Continue securely",exact:true}).click();
 await expect(page).toHaveURL(new RegExp(`/app/share\\?grantId=${id}$`));
 await expect(page.getByRole("region",{name:"Recipient projection"})).toContainText("Authorized synthetic disclosure");
});

for (const locale of ["si","ta","de"] as const) {
 test(`passport sharing is translated in ${locale}`,async({page})=>{
  const id="40000000-0000-4000-8000-000000000001";
  await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic owner",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
  await page.route("**/api/v1/passport",route=>route.fulfill({json:{data:{policyVersion:"private-work-passport.v1",passportId:id,ownerId:id,createdAt:"2026-10-18T00:00:00Z",entries:[],nextCursor:null}}}));
  await page.route("**/api/v1/passport/sharing**",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await page.goto("/app/settings");await page.getByLabel("Language").selectOption(locale);
  await page.goto("/app/share");
  await expect(page.getByText(translate(locale,"sh.disclaimer"))).toBeVisible();
  await expect(page.getByText(translate(locale,"sh.noGrants"))).toBeVisible();
  await expect(page.getByText(translate(locale,"sh.noEligible"))).toBeVisible();
  await expect(page.getByRole("button",{name:translate(locale,"sh.refresh")})).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\bsh\.[a-zA-Z._]+\b/);
 });
}
