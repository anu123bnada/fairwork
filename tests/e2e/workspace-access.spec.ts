import { test,expect } from "@playwright/test";
test("refresh denial clears saved offers and company claims already displayed",async({page})=>{
 const id="40000000-0000-4000-8000-000000000001";let denied=false;
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/offers?context=WORKER",route=>route.fulfill(denied?{status:401,json:{error:{code:"AUTH_REQUIRED"}}}:{json:{data:{items:[{offerId:id,companyId:id,version:1,role:"Private saved offer",createdAt:"2026-10-18T00:00:00Z",questions:0}],nextCursor:null}}}));
 await page.route("**/api/v1/companies**",route=>route.fulfill(denied?{status:403,json:{error:{code:"ACTION_FORBIDDEN"}}}:route.request().url().includes('companyId=')?{json:{data:{companyId:id,companyName:"Private company",canEdit:true,assurance:"demo_provisioned",sourceType:"representative_claim",verification:"unverified",history:[{version:1,submittedAt:"2026-10-18T00:00:00Z",claims:{description:"Private representative claim",website:"",location:"",industry:""}}]}}}:{json:{data:{items:[{companyId:id,name:"Private company"}],scope:"your_authorized_organizations",externalSourceConfigured:false}}}));
 await page.goto("/app/home");
 const offers=page.getByRole('region',{name:'Saved offers'}),companies=page.getByRole('region',{name:'Company information'});
 await expect(offers.getByText('Private saved offer')).toBeVisible();await companies.getByRole('button',{name:'Private company',exact:true}).click();await expect(companies.getByText('Private representative claim',{exact:true})).toBeVisible();
 denied=true;await offers.getByRole('button',{name:'Refresh offers'}).click();await expect(offers.getByRole('alert')).toBeVisible();await expect(offers.getByText('Private saved offer')).toHaveCount(0);
 await companies.getByRole('button',{name:'Search organizations',exact:true}).click();await expect(companies.getByRole('alert')).toBeVisible();await expect(companies.getByText('Private representative claim',{exact:true})).toHaveCount(0);
});
