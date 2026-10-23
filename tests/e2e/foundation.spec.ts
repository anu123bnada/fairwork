import { expect, test } from "@playwright/test";

test("ORYQEN restores splash-to-onboarding and supports keyboard navigation", async ({ page }) => {
  // Keep the 1800ms transition from racing keyboard assertions on busy hosts.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/");
  await expect(page.getByRole("heading", {name:"ORYQEN",exact:true})).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link",{name:"Skip to content"})).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.clock.fastForward(1800);
  await expect(page).toHaveURL(/\/intro\/onboarding$/);
  await page.clock.resume();
  await expect(page.getByRole("heading",{name:"See what’s clear"})).toBeVisible();
  await expect(page.getByText(/We show what is stated and what is missing/)).toBeVisible();
  await page.getByRole("button",{name:"Next"}).click();
  await expect(page.getByRole("heading",{name:"Ask with confidence"})).toBeVisible();
  await page.getByRole("button",{name:"Next"}).click();
  await expect(page.getByRole("heading",{name:"Build your Work Passport"})).toBeVisible();
  await page.getByRole("button",{name:"Get started"}).click();
  await expect(page).toHaveURL(/\/intro\/language$/);
  await expect(page.getByRole("heading",{name:"Choose your language"})).toBeVisible();
  await page.setViewportSize({width:320,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole("link",{name:"Continue"}).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading",{name:"Welcome to ORYQEN"})).toBeVisible();
  await expect(page.getByText("Email/password sign-in. SMS unavailable.")).toBeVisible();
  await page.getByRole("link", { name: "Sign-in information", exact: true }).click();
  await expect(page.getByText(/does not send or simulate SMS codes/)).toBeVisible();
  await page.getByRole("link", { name: "Back to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await page.route("**/api/v1/auth/sign-in", (route) => route.fulfill({ json: { data: { signedIn: true } } }));
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { data: { id: "40000000-0000-4000-8000-000000000001", displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } },
  }));
  await page.getByLabel("Email address").fill("approved.synthetic@example.test");
  await page.getByLabel("Password").fill("synthetic-test-password");
  await page.getByRole("button",{name:"Continue securely"}).click();
  await expect(page).toHaveURL(/\/app\/intro-welcome$/);
  await expect(page.getByRole("heading",{name:/Know what/})).toBeVisible();
  await page.getByRole("link",{name:/Check a job offer/}).click();
  await expect(page).toHaveURL(/\/app\/home$/);
  await expect(page.getByRole("heading",{name:/Good morning, Synthetic/})).toBeVisible();
});

test("unconfigured and hostile API calls fail closed with safe no-store errors", async ({request}) => {
  const profile=await request.get("/api/v1/me");
  expect(profile.status()).toBe(503);
  expect(profile.headers()["cache-control"]).toBe("private, no-store");
  expect((await profile.json()).error.code).toBe("SERVICE_UNAVAILABLE");
  const csrf=await request.post("/api/v1/auth/sign-in",{headers:{origin:"https://evil.example"},data:{email:"synthetic@example.test",password:"synthetic-only"}});
  expect(csrf.status()).toBe(403);
  const malformed=await request.post("/api/v1/auth/sign-in",{headers:{origin:"http://localhost:3000"},data:{email:"synthetic@example.test",password:"synthetic-only",role:"ADMIN"}});
  expect(malformed.status()).toBe(422);
});
