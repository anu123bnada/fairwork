import { expect, test } from "@playwright/test";

test("Figma sign-in form renders locally with accessible controls and no mobile overflow",async({page})=>{
  await page.goto("/sign-in");
  await expect(page.getByRole("heading",{name:"Welcome to ORYQEN"})).toBeVisible();
  await page.getByLabel("Email address").fill("synthetic@example.test");
  await page.getByLabel("Password",{exact:true}).fill("synthetic-only");
  await page.getByRole("button",{name:"Continue securely",exact:true}).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"test-results/day2-sign-in.png",fullPage:true});
});
test("operator page denies an unconfigured session and never shows mutation forms",async({page})=>{
  await page.goto("/operator/authority");
  await expect(page.getByRole("heading",{name:"Demo authority",exact:true})).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button",{name:"Provision company",exact:true})).toHaveCount(0);
  await expect(page.getByText(/does not verify a real employer/)).toBeVisible();
});
test("new endpoints fail closed on cross-origin mutations",async({request})=>{
  for(const route of ["operator/companies","operator/membership-decisions","auth/mfa"]){
    const response=await request.post(`/api/v1/${route}`,{headers:{origin:"https://evil.example"},data:{}});
    expect(response.status()).toBe(403);expect(response.headers()["cache-control"]).toBe("private, no-store");
  }
});

test("operator form uses the real command contract and preserves the key after a lost response",async({page})=>{
  const id="40000000-0000-4000-8000-000000000001";
  await page.route("**/api/v1/operator/organization-requests",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic",locale:"en",timeZone:"UTC",revision:1,capabilities:["authority_operator"]}}}));
  await page.route("**/api/v1/auth/mfa",route=>route.fulfill({json:{data:{factors:[{id,status:"verified"}]}}}));
  const keys:string[]=[];
  await page.route("**/api/v1/operator/companies",async route=>{
    expect(route.request().postDataJSON()).toEqual({name:"Synthetic rehearsal"});
    const key=route.request().headers()["idempotency-key"];
    if(!key)throw new Error("Operator command omitted its idempotency key");
    keys.push(key);
    if(keys.length===1)return route.abort("failed");
    return route.fulfill({json:{data:{id,name:"Synthetic rehearsal",identityLabel:"demo_provisioned",revision:1}}});
  });
  await page.goto("/operator/authority");
  await page.getByLabel("Synthetic company name").fill("Synthetic rehearsal");
  await page.getByRole("button",{name:"Provision company",exact:true}).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.getByRole("button",{name:"Provision company",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("No representative access was granted");
  expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Company ID",{exact:true})).toHaveValue(id);
});

test("TOTP verification clears the enrollment secret before showing authorized controls",async({page})=>{
  const id="40000000-0000-4000-8000-000000000001";let verified=false;
  await page.route("**/api/v1/operator/organization-requests",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic",locale:"en",timeZone:"UTC",revision:1,capabilities:verified?["authority_operator"]:[]}}}));
  await page.route("**/api/v1/auth/mfa",route=>{
    if(route.request().method()==="GET")return route.fulfill({json:{data:{factors:verified?[{id,status:"verified"}]:[]}}});
    const body=route.request().postDataJSON();
    if(body.action==="enroll")return route.fulfill({json:{data:{factorId:id,secret:"LOCAL_SYNTHETIC_SEED"}}});
    expect(body).toEqual({action:"verify",factorId:id,code:"123456"});verified=true;
    return route.fulfill({json:{data:{verified:true}}});
  });
  await page.goto("/operator/authority");
  await page.getByRole("button",{name:"Set up authenticator"}).click();
  await expect(page.getByText("LOCAL_SYNTHETIC_SEED")).toBeVisible();
  await page.getByLabel("6-digit authenticator code").fill("123456");
  await page.getByRole("button",{name:"Verify code"}).click();
  await expect(page.getByRole("button",{name:"Provision company",exact:true})).toBeVisible();
  await expect(page.getByText("LOCAL_SYNTHETIC_SEED")).toHaveCount(0);
});
