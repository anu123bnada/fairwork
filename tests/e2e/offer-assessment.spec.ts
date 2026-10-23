import {expect,test,type Page} from "@playwright/test";
import {assessOfferTerms} from "../../src/features/offer/assessment";
const id="40000000-0000-4000-8000-000000000001";
const terms={role:"Workshop Assistant",salary:80000,currency:"LKR",payPeriod:"monthly",hoursPerWeek:40,probation:"Unpaid trial is required"};
const offer={offerId:id,companyId:id,workerId:id,representativeId:null,requesterId:id,requesterRole:"WORKER",version:2,termHash:"a".repeat(64),snapshot:terms,changes:[],unresolved:[]};
async function setup(page:Page){
 await page.route("**/api/v1/**",route=>route.fulfill({status:503,json:{error:{code:"SERVICE_UNAVAILABLE"}}}));
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic Worker",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/agreements?*",route=>route.fulfill({json:{data:{offer,agreementId:id,confirmation:null,answers:[],canConfirm:false}}}));
}
test("saved indicators show evidence and survive a direct reload on mobile",async({page},testInfo)=>{
 await setup(page);
 await page.route("**/api/v1/offers/assessment?*",route=>route.fulfill({json:{data:{offerId:id,offerVersion:2,termHash:offer.termHash,assessment:assessOfferTerms(terms)}}}));
 await page.goto(`/app/check?offerId=${id}`);
 const panel=page.getByRole("region",{name:"Offer fairness indicators"});
 await expect(panel).toContainText("25/100");await expect(panel).toContainText("1 explicit concerns");
 await panel.getByText("Evidence, deductions and next steps",{exact:true}).click();
 await expect(panel.getByRole("heading",{name:"Trial and probation: 0/5 · concern"})).toBeVisible();
 await expect(panel.getByText("Unpaid trial is required",{exact:true})).toBeVisible();
 await expect(panel).toContainText("Employer verification: not assessed");
 await expect(panel).toContainText("offer-indicators.v1");
 await page.screenshot({path:testInfo.outputPath("assessment-desktop.png"),fullPage:true});
 await page.setViewportSize({width:360,height:800});await page.reload();
 await expect(panel).toContainText("25/100");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath("assessment-mobile.png"),fullPage:true});
});
test("assessment errors can recover without inventing a score",async({page})=>{
 await setup(page);let calls=0;
 await page.route("**/api/v1/offers/assessment?*",route=>++calls===1?route.fulfill({status:503,json:{error:{code:"SERVICE_UNAVAILABLE"}}}):route.fulfill({json:{data:{offerId:id,offerVersion:2,termHash:offer.termHash,assessment:assessOfferTerms(terms)}}}));
 await page.goto(`/app/check?offerId=${id}`);
 const panel=page.getByRole("region",{name:"Offer fairness indicators"});
 await expect(panel.getByRole("alert")).toBeVisible();await expect(panel).not.toContainText("25/100");
 await panel.getByRole("button",{name:"Retry assessment"}).click();await expect(panel).toContainText("25/100");
});
test("a newer revision cannot be displayed as the current revision score",async({page})=>{
 await setup(page);
 await page.route("**/api/v1/offers/assessment?*",route=>route.fulfill({json:{data:{offerId:id,offerVersion:3,termHash:"b".repeat(64),assessment:assessOfferTerms(terms)}}}));
 await page.goto(`/app/check?offerId=${id}`);
 const panel=page.getByRole("region",{name:"Offer fairness indicators"});
 await expect(panel.getByRole("alert")).toContainText("This offer changed");await expect(panel).not.toContainText("25/100");
});
