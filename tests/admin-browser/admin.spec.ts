import {test,expect} from "@playwright/test";
test("workflow overview exposes source counts, queues and accessible daily values",async({page})=>{
 await page.goto("/");await expect(page.getByRole("region",{name:"Operational alerts"})).toContainText("3");
 await page.getByText("Daily workflow counts",{exact:true}).click();await expect(page.getByRole("table",{name:"Database records by UTC day"})).toContainText("2026-10-20");
 await expect(page.getByRole("region",{name:"Recent operational activity"})).toContainText("Fixture agreement");
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:"test-results/admin-operations-desktop.png"});
});
test("organization suspension requires confirmation and does not accept a forged actor",async({page})=>{
 let sent:Record<string,unknown>|undefined;
 await page.route("**/api/v1/admin*",route=>{if(route.request().method()==="POST"){sent=route.request().postDataJSON();return route.fulfill({json:{data:{operation:"organization_status",auditId:"50000000-0000-4000-8000-000000000002"}}});}return route.fulfill({json:{data:{role:"owner",items:[],nextCursor:null,metrics:null,trend:null,dataMode:"synthetic",runtime:{}}}});});
 await page.setViewportSize({width:390,height:844});await page.goto("/?resource=organizations");
 await page.getByRole("button",{name:/Synthetic organization/}).click();await page.getByRole("button",{name:"Manage organization access"}).click();
 await page.getByLabel("Justification",{exact:true}).fill("Synthetic independent suspension review");
 await page.getByRole("button",{name:"Confirm and record change"}).click();expect(sent).toBeUndefined();
 await page.getByRole("checkbox").check();await page.screenshot({path:"test-results/admin-organization-mobile.png"});await page.getByRole("button",{name:"Confirm and record change"}).click();await expect(page.getByText(/Immutable audit receipt/)).toBeVisible();
 expect(sent).toMatchObject({operation:"organization_status",suspended:true,expectedRevision:0});expect(sent).not.toHaveProperty("actorId");
 await page.goto("/?resource=organizations&role=auditor");await page.getByRole("button",{name:/Synthetic organization/}).click();await expect(page.getByRole("button",{name:"Manage organization access"})).toHaveCount(0);
});
test("organization appeal preserves original rejection and confirms submission",async({page})=>{
 const parent="50000000-0000-4000-8000-000000000001",child="50000000-0000-4000-8000-000000000002";let submitted=false;
 await page.route("**/api/v1/organizations",route=>route.fulfill({json:{data:{items:[{requestId:parent,companyId:null,companyName:"Synthetic applicant organization",statement:"Fixture authority statement",createdAt:"2026-10-20T00:00:00Z",decision:"reject",reason:"Evidence insufficient",active:false,appealRequestId:submitted?child:null}],nextCursor:null}}}));
 await page.route("**/api/v1/organizations/appeals",route=>{expect(route.request().postDataJSON()).toEqual({requestId:parent,grounds:"Corrected synthetic evidence references"});expect(route.request().headers()["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);submitted=true;return route.fulfill({json:{data:{requestId:child,parentRequestId:parent}}});});
 await page.goto("/?orgrequests=1");await page.getByText("Appeal this rejection",{exact:true}).click();await page.getByLabel("Organization appeal grounds").fill("Corrected synthetic evidence references");await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Submit organization appeal"}).click();
 await expect(page.getByText(/Linked appeal request:/)).toContainText(child);await expect(page.getByText("Evidence insufficient",{exact:true})).toBeVisible();await expect(page.getByText(/different independent reviewer must decide/)).toBeVisible();
});
test("telemetry distinguishes observed failures from unavailable costs or provider guarantees",async({page})=>{
 await page.goto("/?resource=telemetry&role=auditor");await expect(page.getByRole("region",{name:"Observed runtime telemetry"})).toContainText("Missing events and failed writes cannot be inferred");await expect(page.getByText(/Provider cost: unavailable/)).toBeVisible();
});
test("incident entry consumes enabled categories and defaults to an enabled value",async({page})=>{
 await page.goto("/?resource=incidents");await page.getByRole("button",{name:"Record incident"}).click();
 await expect(page.getByRole("combobox",{name:"Category",exact:true})).toHaveValue("support");
 await expect(page.getByRole("combobox",{name:"Category",exact:true}).locator("option")).toHaveText(["support","moderation"]);
});
test("independent organization decision requires explicit evidence/conflict confirmation",async({page})=>{
 const id="50000000-0000-4000-8000-000000000001";let posted=false;
 await page.route("**/api/v1/operator/organization-requests",route=>{if(route.request().method()==="POST"){posted=true;expect(route.request().postDataJSON()).toMatchObject({requestId:id,decision:"reject",reason:"Insufficient synthetic evidence",reviewedEvidenceRefs:[]});return route.fulfill({json:{data:{requestId:id,decision:"reject",companyId:null}}});}return route.fulfill({json:{data:{items:posted?[]:[{requestId:id,subjectId:id,companyName:"Fixture organization",companyId:null,statement:"Synthetic evidence statement",createdAt:"2026-10-20",parentRequestId:null}],nextCursor:null}}});});
 await page.goto("/?orgrequests=1&operator=1");await page.getByLabel("Decision rationale").fill("Insufficient synthetic evidence");await page.getByRole("button",{name:"Record independent decision"}).click();expect(posted).toBe(false);
 await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Record independent decision"}).click();await expect(page.getByText("Independent decision recorded.",{exact:true})).toBeVisible();
});
test("targeted audit filters survive refresh and pagination",async({page})=>{
 const target="50000000-0000-4000-8000-000000000001",cursor="50000000-0000-4000-8000-000000000002";
 const requests:URL[]=[];
 await page.route("**/api/v1/admin*",route=>{requests.push(new URL(route.request().url()));return route.fulfill({json:{data:{role:"auditor",items:[],nextCursor:cursor,metrics:null,trend:null,dataMode:"synthetic",runtime:{}}}});});
 await page.goto(`/?resource=audit&role=auditor&target=${target}`);
 await expect(page.getByLabel("Search this workspace")).toHaveValue(target);
 await page.getByRole("button",{name:"Search / refresh"}).click();
 await expect(page.getByRole("button",{name:"Next page"})).toBeEnabled();
 await page.getByRole("button",{name:"Next page"}).click();
 await expect.poll(()=>requests.length).toBe(2);
 for(const request of requests){expect(request.searchParams.get("search")).toBe(target);expect(request.searchParams.get("resource")).toBe("audit");}
 expect(requests[1]!.searchParams.get("cursor")).toBe(cursor);
});
test("desktop overview labels unavailable metrics and supports keyboard navigation and theme",async({page})=>{
 await page.goto("/");await expect(page.getByRole("heading",{name:"Overview",exact:true})).toBeVisible();await expect(page.getByText("Unavailable",{exact:true})).toBeVisible();await page.keyboard.press("Tab");await expect(page.getByRole("link",{name:"Skip to content"})).toBeFocused();
 await page.getByRole("button",{name:"Use light theme",exact:true}).click();await expect(page.locator('[data-theme="light"]')).toBeVisible();await page.getByRole("button",{name:"Collapse navigation"}).click();await expect(page.locator("#admin-navigation")).toBeHidden();await page.screenshot({path:"test-results/admin-desktop-light.png",fullPage:true});
});
test("mobile user details and restriction dialog keep focus, confirmation and audit evidence",async({page})=>{
 await page.setViewportSize({width:390,height:844});let sent:Record<string,unknown>|undefined;
 await page.route("**/api/v1/admin*",async route=>{if(route.request().method()==="POST"){sent=route.request().postDataJSON();await route.fulfill({json:{data:{operation:"restrict",auditId:"50000000-0000-4000-8000-000000000002"}}});}else await route.fulfill({json:{data:{role:"owner",items:[],nextCursor:null,metrics:null,trend:null,dataMode:"synthetic",runtime:{}}}});});
 await page.goto("/?resource=users");await page.getByRole("button",{name:/Synthetic fixture profile/}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).not.toBeVisible();
 await page.getByRole("button",{name:/Synthetic fixture profile/}).click();await page.getByRole("button",{name:"Manage account restriction"}).click();await page.getByLabel("Justification",{exact:true}).fill("Synthetic account restriction fixture");await page.getByRole("checkbox").check();await page.screenshot({path:"test-results/admin-mobile-confirmation.png",fullPage:true});await page.getByRole("button",{name:"Confirm and record change"}).click();await expect(page.getByText(/Immutable audit receipt/)).toBeVisible();expect(sent).toMatchObject({operation:"restrict",restricted:true,expectedRevision:1});expect(sent).not.toHaveProperty("actorId");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test("revocation clears displayed records and closes sensitive panels",async({page})=>{
 await page.route("**/api/v1/admin*",route=>route.fulfill({status:403,json:{error:{code:"ACTION_FORBIDDEN"}}}));await page.goto("/?resource=users");await expect(page.getByText("Synthetic fixture profile")).toBeVisible();await page.getByRole("button",{name:"Search / refresh"}).click();await expect(page.getByRole("heading",{name:"Records unavailable"})).toBeVisible();await expect(page.getByText("Synthetic fixture profile")).not.toBeVisible();
});
test("auditor cannot see settings mutation controls and provider status is truthful",async({page})=>{
 await page.goto("/?resource=settings&role=auditor");await expect(page.getByRole("button",{name:"Add setting"})).toHaveCount(0);await expect(page.getByText("not_probed",{exact:true})).toBeVisible();await expect(page.getByText("NO-GO",{exact:true})).toBeVisible();
});
test("admin access form uses real authentication endpoints and never stores credentials",async({page})=>{
 let sent=false;await page.route("**/api/v1/auth/sign-in",route=>{sent=true;return route.fulfill({status:401,json:{error:{code:"AUTH_REQUIRED"}}});});await page.goto("/?denied=1");await page.getByLabel("Email",{exact:true}).fill("fixture@example.test");await page.getByLabel("Password",{exact:true}).fill("synthetic-test-only");await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page.getByRole("alert")).toBeVisible();expect(sent).toBe(true);expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
});
test("participant can submit a linked appeal with an idempotency header and see its review link",async({page})=>{
 const child="50000000-0000-4000-8000-000000000002",parent="50000000-0000-4000-8000-000000000001";let posted=false;
 await page.route("**/api/v1/case-followups*",async route=>{if(route.request().method()==="POST"){expect(route.request().postDataJSON()).toMatchObject({caseId:parent,operation:"appeal",expectedRevision:4,message:"New synthetic appeal grounds"});expect(route.request().headers()["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);posted=true;await route.fulfill({json:{data:{caseId:parent,eventId:child,linkedCaseId:child}}});}else await route.fulfill({json:{data:{canRespond:false,canAppeal:!posted,nextCursor:null,items:posted?[{id:child,actorId:parent,kind:"appeal",message:"New synthetic appeal grounds",linkedCaseId:child,createdAt:"2026-10-20T00:00:00Z"}]:[]}}});});
 await page.goto("/?followups=1");await page.getByLabel("Appeal grounds").fill("New synthetic appeal grounds");await page.getByRole("button",{name:"Submit appeal and reopen review"}).click();await expect(page.getByRole("link",{name:"Open linked appeal case"})).toHaveAttribute("href",`/app/cases?caseId=${child}`);await expect(page.getByText(/different independent reviewer must be assigned/)).toBeVisible();
});
