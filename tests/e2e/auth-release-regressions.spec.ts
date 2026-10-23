import { expect, test } from "@playwright/test";

test("sign-in completes a missing profile before returning to the employer workspace",async({page})=>{
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true", "Isolated enabled registration only.");
  let created=false;
  await page.route("**/api/v1/auth/sign-in",route=>route.fulfill({json:{data:{signedIn:true,profileRequired:true}}}));
  await page.route("**/api/v1/me",route=>{
    if(route.request().method()==="POST"){
      expect(route.request().postDataJSON()).toEqual({displayName:"New employer",locale:"en",timeZone:"Asia/Colombo"});
      expect(route.request().headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/);
      created=true;
    }
    return route.fulfill(created?{json:{data:{id:"40000000-0000-4000-8000-000000000001",displayName:"New employer",locale:"en",timeZone:"Asia/Colombo",revision:1,capabilities:[]}}}:{status:401,json:{error:{code:"AUTH_REQUIRED"}}});
  });
  await page.goto("/sign-in?workspace=employer&role=ADMIN&next=https://evil.invalid");
  await page.getByLabel("Email address").fill("employer@example.test");
  await page.getByLabel("Password",{exact:true}).fill("synthetic-password");
  await page.getByRole("button",{name:"Continue securely"}).click();
  await expect(page).toHaveURL(/\/register\/profile\?workspace=employer$/);
  await page.reload();
  await page.getByLabel("Display name").fill("New employer");
  await page.getByRole("button",{name:"Create my profile"}).click();
  await expect(page).toHaveURL(/\/app\/employer$/);
  await expect(page.getByRole("heading",{name:"Your employer workspace"})).toBeVisible();
  expect(created).toBe(true);
});

test("anonymous employer returns to employer workspace after sign-in and reload",async({page})=>{
  let signedIn=false;
  const operatorRequests:string[]=[];
  page.on("request",request=>{if(new URL(request.url()).pathname.startsWith("/operator"))operatorRequests.push(request.url());});
  await page.route("**/api/v1/me",route=>route.fulfill(signedIn?{json:{data:{id:"40000000-0000-4000-8000-000000000001",displayName:"Synthetic employer",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}:{status:401,json:{error:{code:"AUTH_REQUIRED"}}}));
  await page.route("**/api/v1/auth/sign-in",route=>{
    expect(Object.keys(route.request().postDataJSON()).sort()).toEqual(["email","password"]);
    signedIn=true;return route.fulfill({json:{data:{signedIn:true}}});
  });
  await page.goto("/sign-in");
  await page.getByRole("link",{name:"I’m an employer →"}).click();
  await page.getByRole("link",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\/sign-in\?workspace=employer$/);
  await page.getByRole("link",{name:"Sign-in information",exact:true}).click();
  await page.getByRole("link",{name:"Back to sign in",exact:true}).click();
  await page.getByLabel("Email address").fill("employer@example.test");
  await page.getByLabel("Password",{exact:true}).fill("synthetic-password");
  await page.getByRole("button",{name:"Continue securely"}).click();
  await expect(page).toHaveURL(/\/app\/employer$/);
  await expect(page.getByRole("heading",{name:"Your employer workspace"})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading",{name:"Your employer workspace"})).toBeVisible();
  expect(operatorRequests).toEqual([]);
});

test("recovery retries failed MFA discovery without reusing the consumed link",async({page})=>{
  let confirmations=0,lookups=0,passwordChanges=0;
  await page.route("**/api/v1/auth/recovery/confirm",route=>{confirmations++;return route.fulfill({json:{data:{confirmed:true}}});});
  await page.route("**/api/v1/auth/mfa",route=>{
    if(route.request().method()==="POST")return route.fulfill({json:{data:{verified:true}}});
    lookups++;
    return route.fulfill(lookups===1?{status:503,json:{error:{code:"SERVICE_UNAVAILABLE"}}}:{json:{data:{factors:[{id:"40000000-0000-4000-8000-000000000002",status:"verified"}]}}});
  });
  await page.route("**/api/v1/auth/password",route=>{passwordChanges++;return route.fulfill({json:{data:{updated:true,signInRequired:true}}});});
  await page.goto(`/auth/recover#token_hash=${"a".repeat(64)}`);
  await page.getByRole("button",{name:"Confirm recovery link"}).click();
  await expect(page).toHaveURL(/\/auth\/recover$/);
  await expect(page.getByLabel("New password",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Retry authenticator check"}).click();
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button",{name:"Verify authenticator"}).click();
  await page.getByLabel("New password",{exact:true}).fill("synthetic-new-password");
  await page.getByLabel("Confirm new password",{exact:true}).fill("synthetic-new-password");
  await page.getByRole("button",{name:"Save new password"}).click();
  await expect(page.getByRole("status")).toContainText("Your password was changed");
  expect(confirmations).toBe(1);expect(lookups).toBe(2);expect(passwordChanges).toBe(1);
});
