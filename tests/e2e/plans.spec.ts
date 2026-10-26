import { expect, test, type Page } from "@playwright/test";

const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function signedIn(page: Page, capabilities: string[] = []) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities } } }));
}
const summary = (degraded = false) => ({ plan: { id: "worker_free", name: "Free worker protection", summary: "Every protection a worker needs, at no cost." }, assignedAt: null, degraded,
  essentialFeatures: ["passport", "privacy_requests", "credential_verification"], limits: [{ key: "activeCredentials", limit: 10, used: 3, remaining: 7, allowed: true }],
  billing: { available: false, note: "No payment provider is connected. Plans are assigned by an operator." } });

test("Settings shows the plan, its metered limit, the protections that are never limited, and no payment", async ({ page }) => {
  await signedIn(page);
  await page.route("**/api/v1/entitlements", route => route.fulfill({ json: { data: summary() } }));
  await page.goto("/app/settings");
  const panel = page.getByRole("region", { name: "Your plan" });
  await expect(panel).toContainText("Free worker protection"); await expect(panel).toContainText("Active shareable credentials: 3 of 10 used");
  await expect(panel).toContainText("always available on every plan"); await expect(panel).toContainText("Privacy requests");
  await expect(panel).toContainText("No payment provider is connected"); await expect(panel).not.toContainText(/\$|€|£|upgrade|subscribe|buy/i);
  await expect(page.getByRole("button", { name: "Assign plan" })).toHaveCount(0); // not an operator
});

test("an unconfirmed plan is shown honestly as the free plan", async ({ page }) => {
  await signedIn(page);
  await page.route("**/api/v1/entitlements", route => route.fulfill({ json: { data: summary(true) } }));
  await page.goto("/app/settings");
  await expect(page.getByRole("region", { name: "Your plan" }).getByRole("note").first()).toContainText("could not be confirmed just now");
});

test("an operator assigns a plan with a reason, with a reused retry key and a plain error on refusal", async ({ page }) => {
  await signedIn(page, ["authority_operator"]);
  await page.route("**/api/v1/entitlements", route => route.fulfill({ json: { data: summary() } }));
  const bodies: Record<string, unknown>[] = []; let refuse = true;
  await page.route("**/api/v1/operator/entitlements", route => {
    bodies.push(route.request().postDataJSON());
    if (refuse) { refuse = false; return route.fulfill({ status: 403, json: { error: { code: "ACTION_FORBIDDEN" } } }); }
    return route.fulfill({ json: { data: { assignmentId: id(5), plan: "worker_plus", replayed: false } } });
  });
  await page.goto("/app/settings");
  await page.getByText("Assign plans (operator)").click();
  const form = page.getByRole("form", { name: "Assign a plan" });
  await expect(form.getByRole("button", { name: "Assign plan" })).toBeDisabled();
  await form.getByLabel("Participant account ID").fill("not-a-uuid"); await form.getByLabel(/Reason/).fill("Pilot participant");
  await expect(form.getByRole("button", { name: "Assign plan" })).toBeDisabled();
  await form.getByLabel("Participant account ID").fill(id(9));
  await form.getByRole("button", { name: "Assign plan" }).click();
  await expect(form.getByRole("alert")).toBeVisible();
  await form.getByRole("button", { name: "Assign plan" }).click();
  await expect(form.getByRole("status")).toContainText("Plan set to Worker plus");
  expect(bodies).toHaveLength(2); expect(bodies[0]).toMatchObject({ subjectId: id(9), plan: "worker_plus", reason: "Pilot participant" });
  expect(bodies[0]!.idempotencyKey).toBe(bodies[1]!.idempotencyKey);
});

test("the plan panel is translated and holds on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page);
  await page.route("**/api/v1/entitlements", route => route.fulfill({ json: { data: summary() } }));
  await page.goto("/app/settings");
  await page.getByLabel("Language").selectOption("de");
  await expect(page.getByRole("region", { name: "Your plan" }).getByRole("heading", { name: "Ihr Tarif" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
