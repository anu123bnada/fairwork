import {test,expect,type Page} from "@playwright/test";
import {readFileSync} from "node:fs";
const id="40000000-0000-4000-8000-000000000001",second="40000000-0000-4000-8000-000000000002",time="2026-10-18T00:00:00Z",hash="a".repeat(64);
if(process.env.ORYQEN_TEST_LOCAL_RUNNING==="1")test.use({baseURL:"http://127.0.0.1:3100"});
test.use({viewport:{width:390,height:844}});
async function identity(page:Page){await page.route("**/api/v1/me/employment-history**",r=>r.fulfill({json:{data:{items:[],nextCursor:null}}}));await page.route("**/api/v1/offers/drafts",r=>r.fulfill({json:{data:{items:[],nextCursor:null}}}));await page.route("**/api/v1/me",r=>r.fulfill({json:{data:{id,displayName:"Synthetic test owner",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));}
function passport(later:boolean){return {policyVersion:"private-work-passport.v1",passportId:id,ownerId:id,createdAt:time,nextCursor:later?null:id,entries:[{workId:later?second:id,version:1,role:later?"Later-page technician":"First-page technician",periodStart:"2026-10-01",periodEnd:"2026-10-10",hours:"40",summary:"Synthetic tasks",companyId:id,companyName:"Synthetic company",agreementId:id,agreementVersion:1,agreementHash:hash,agreementEffectiveAt:time,verificationId:id,verifiedAt:time,verifierId:second,authorityDecisionId:id,evidenceCount:1,evidenceHash:hash}]};}
test("sharing reaches later records and clears selections on denied refresh",async({page})=>{
 await identity(page);let deny=false;
 await page.route("**/api/v1/passport**",r=>r.request().url().includes("sharing")?r.fulfill({json:{data:{items:[],nextCursor:null}}}):deny?r.fulfill({status:403,json:{error:{code:"ACTION_FORBIDDEN"}}}):r.fulfill({json:{data:passport(r.request().url().includes("cursor="))}}));
 await page.goto("/app/share");await expect(page.getByLabel("Record to share")).toContainText("First-page technician");
 await page.getByRole("button",{name:"Next eligible records"}).click();await expect(page.getByLabel("Record to share")).toContainText("Later-page technician");
 await expect(page.getByLabel("Record to share")).not.toContainText("First-page technician");
 deny=true;await page.getByRole("button",{name:"Reload eligible records"}).click();await expect(page.locator("p[role=alert]")).toBeVisible();await expect(page.getByLabel("Record to share")).toHaveCount(0);
});
test("private download includes later pages and never creates a partial denied export",async({page})=>{
 await identity(page);let deny=false,downloads=0;
 await page.route("**/api/v1/passport**",r=>deny&&r.request().url().includes("cursor=")?r.fulfill({status:403,json:{error:{code:"ACTION_FORBIDDEN"}}}):r.fulfill({json:{data:passport(r.request().url().includes("cursor="))}}));
 page.on("download",()=>downloads++);await page.goto("/app/passport");await page.getByText("Download a private copy",{exact:true}).click();
 const waiting=page.waitForEvent("download");await page.getByRole("button",{name:"Download private JSON"}).click();const download=await waiting;
 const file=JSON.parse(readFileSync((await download.path())!,"utf8"));expect(file.records.map((r:{role:string})=>r.role)).toEqual(["First-page technician","Later-page technician"]);expect(JSON.stringify(file)).not.toContain(id);
 deny=true;await page.getByRole("button",{name:"Download private JSON"}).click();await expect(page.locator("p[role=alert]")).toBeVisible();expect(downloads).toBe(1);
});
test("real local WASM OCR extracts synthetic text without external requests or automatic submission",async({page})=>{
 test.setTimeout(90000);await identity(page);const external:string[]=[],writes:string[]=[];
 page.on("request",request=>{if(!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/))external.push(request.url());if(request.method()==="POST")writes.push(new URL(request.url()).pathname);});
 await page.goto("/app/add-offer");await page.getByRole("tab",{name:"Screenshot",exact:true}).click();
 const image=await page.evaluate(()=>{const canvas=document.createElement("canvas");canvas.width=1000;canvas.height=300;const c=canvas.getContext("2d")!;c.fillStyle="white";c.fillRect(0,0,1000,300);c.fillStyle="black";c.font="36px Arial";c.fillText("Warehouse Technician",30,70);c.fillText("Salary LKR 120000 per month",30,140);c.fillText("40 hours per week",30,210);return canvas.toDataURL().split(",")[1]!;});
 await page.getByLabel("Offer screenshot").setInputFiles({name:"synthetic.png",mimeType:"image/png",buffer:Buffer.from(image,"base64")});
 await expect(page.getByLabel("Review extracted text")).toBeVisible({timeout:50000});await expect(page.getByLabel("Review extracted text")).toContainText("120000");
 const useText=page.getByRole("button",{name:"Use reviewed text"});
 await useText.evaluate(element=>element.scrollIntoView({block:"center",behavior:"instant"}));
 expect(await useText.evaluate(element=>{const r=element.getBoundingClientRect();return element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 await page.screenshot({path:"test-results/stage9-ocr-mobile.png"});expect(external).toEqual([]);expect(writes).toEqual([]);
 await page.setViewportSize({width:1280,height:900});await useText.evaluate(element=>element.scrollIntoView({block:"center",behavior:"instant"}));await page.screenshot({path:"test-results/stage9-ocr-desktop.png"});
 await page.getByRole("button",{name:"Use reviewed text"}).click();await expect(page.getByLabel("Paste offer text")).toHaveValue(/40 hours per week/);expect(writes).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("screenshot reader rejects disguised files and cancels pending work",async({page})=>{
 await identity(page);await page.goto("/app/add-offer");await page.getByRole("tab",{name:"Screenshot",exact:true}).click();
 await page.getByLabel("Offer screenshot").setInputFiles({name:"fake.png",mimeType:"image/png",buffer:Buffer.from("<svg>not a raster image</svg>")});await expect(page.locator("p[role=alert]")).toContainText("do not match");
 await page.route("**/ocr/extract-worker.js",r=>r.fulfill({contentType:"application/javascript",body:"self.onmessage=()=>{};"}));
 const bytes=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=100;c.height=100;return c.toDataURL().split(",")[1]!;});
 await page.getByLabel("Offer screenshot").setInputFiles({name:"synthetic.png",mimeType:"image/png",buffer:Buffer.from(bytes,"base64")});
 await page.getByRole("button",{name:"Cancel reading"}).click();await expect(page.getByLabel("Review extracted text")).toHaveCount(0);await expect(page.getByLabel("Offer screenshot")).toBeEnabled();
});
