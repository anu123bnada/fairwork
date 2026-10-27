import { expect, test, type Page } from "@playwright/test";
import { translate } from "../../src/i18n";

const jwt = `${"a".repeat(24)}.${"b".repeat(24)}.${"c".repeat(24)}`;
const session = (type: string) => `#access_token=${jwt}&expires_in=3600&refresh_token=refreshTOKEN123&token_type=bearer&type=${type}`;

async function track(page: Page) {
  const urls: string[] = [], bodies: unknown[] = [];
  page.on("request", request => { urls.push(request.url()); });
  await page.route("**/api/v1/auth/recovery/confirm", route => { bodies.push(route.request().postDataJSON()); return route.fulfill({ json: { data: { confirmed: true } } }); });
  await page.route("**/api/v1/auth/mfa", route => route.fulfill({ json: { data: { factors: [] } } }));
  await page.route("**/api/v1/auth/password", route => route.fulfill({ json: { data: { updated: true, signInRequired: true } } }));
  return { urls, bodies };
}

test("a default dashboard recovery link (tokens in the fragment) completes a password reset without the tokens ever reaching a URL", async ({ page }) => {
  const seen = await track(page);
  await page.goto(`/auth/recover${session("recovery")}`);
  await expect(page.getByRole("button", { name: "Confirm recovery link" })).toBeVisible();
  // The credentials are captured in memory and removed from the address bar before anything is clicked.
  await expect.poll(() => page.url()).not.toContain("access_token");
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  expect(seen.bodies).toEqual([]);
  await page.getByRole("button", { name: "Confirm recovery link" }).click();
  await page.getByLabel("New password", { exact: true }).fill("synthetic-new-password");
  await page.getByLabel("Confirm new password", { exact: true }).fill("synthetic-new-password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("status")).toContainText("Your password was changed");
  expect(seen.bodies).toEqual([{ accessToken: jwt, refreshToken: "refreshTOKEN123", link: "recovery" }]);
  expect(seen.urls.some(url => url.includes(jwt) || url.includes("refreshTOKEN123"))).toBe(false);
});

test("an invitation link says it is an invitation and still waits for a click", async ({ page }) => {
  const seen = await track(page);
  await page.goto(`/auth/recover${session("invite")}`);
  await expect(page.getByText("You were invited to ORYQEN.")).toBeVisible();
  expect(seen.bodies).toEqual([]);
  await page.getByRole("button", { name: "Confirm recovery link" }).click();
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  expect(seen.bodies).toEqual([{ accessToken: jwt, refreshToken: "refreshTOKEN123", link: "invite" }]);
});

for (const [name, suffix, heading] of [
  ["no link", "", "Open the link in your email"],
  ["an expired link", "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", "This link has expired"],
  ["a provider error", "#error=access_denied&error_code=access_denied", "This link cannot be used"],
  ["a malformed token", "#token_hash=nope", "This link cannot be used"],
  ["a signup link", `${session("signup")}`, "This link cannot be used"],
  ["a PKCE code", "?code=abc123", "This link cannot be completed here"],
] as const) {
  test(`recovery page with ${name} explains the problem, offers a new email and consumes nothing`, async ({ page }) => {
    const seen = await track(page);
    await page.goto(`/auth/recover${suffix}`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm recovery link" })).toHaveCount(0);
    await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Request a new reset email" })).toHaveAttribute("href", "/forgot-password");
    await expect(page.getByText("Check the supplied fields.")).toHaveCount(0);
    expect(seen.bodies).toEqual([]);
  });
}

test("a replayed or revoked link is reported as unusable, not as a field error, and does not reveal the password step", async ({ page }) => {
  await page.route("**/api/v1/auth/recovery/confirm", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  await page.goto(`/auth/recover${session("recovery")}`);
  await page.getByRole("button", { name: "Confirm recovery link" }).click();
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Check the supplied fields.")).toHaveCount(0);
});

test("reloading after the link was captured does not bring the credentials back", async ({ page }) => {
  await track(page);
  await page.goto(`/auth/recover${session("recovery")}`);
  await expect(page.getByRole("button", { name: "Confirm recovery link" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Open the link in your email" })).toBeVisible();
});

for (const [name, hash, destination] of [["recovery", session("recovery"), /\/auth\/recover$/], ["invitation", session("invite"), /\/auth\/recover$/], ["expired link", "#error=access_denied&error_code=otp_expired", /\/auth\/recover$/]] as const) {
  test(`a ${name} link that lands on the site root is forwarded to the page that handles it`, async ({ page }) => {
    const seen = await track(page);
    await page.goto(`/${hash}`);
    await expect(page).toHaveURL(destination);
    expect(seen.bodies).toEqual([]);
    expect(page.url()).not.toContain("access_token");
  });
}

test("ordinary landing-page anchors are not forwarded", async ({ page }) => {
  await page.goto("/#features");
  await expect(page).toHaveURL(/\/#features$/);
});

test("the recovery link states are translated", async ({ page }) => {
  await page.goto("/auth/recover");
  await page.evaluate(() => window.localStorage.setItem("oryqen.locale", "si"));
  await page.goto("/auth/recover#error_code=otp_expired");
  await expect(page.getByRole("heading", { name: translate("si", "au.rec.linkExpired") })).toBeVisible();
  await expect(page.getByRole("link", { name: translate("si", "au.rec.requestNew") })).toBeVisible();
});
