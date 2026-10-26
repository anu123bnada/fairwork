import { expect, test, type Page } from "@playwright/test";
import { assessOfferTerms } from "../../src/features/offer/assessment";
import { translate } from "../../src/i18n";

// Browser-only transport fixtures: the evidence below is canned and says nothing about any real recruiter or employer.
const id = "40000000-0000-4000-8000-000000000001", verificationId = "40000000-0000-4000-8000-0000000000a1";
const terms = { role: "Workshop Assistant", employer: "Acme Tools", salary: 80000, currency: "LKR", hoursPerWeek: 40 };
const hash = "a".repeat(64);
const offer = { offerId: id, companyId: id, workerId: id, representativeId: null, requesterId: id, requesterRole: "WORKER", version: 1, termHash: hash, snapshot: terms, changes: [], unresolved: [] };
const claim = { verificationId, recruiterName: "Asha Perera", claimedEmployer: "Acme Tools", roleTitle: null, companyId: null, email: "asha@acmetools.com", profileUrl: null, employerSite: null, postingUrl: null, registryLei: null, createdAt: "2026-10-27T00:00:00Z", expiresAt: "2027-01-25T00:00:00Z", employer: { confirmations: 0, disputes: 0 }, decisions: [] };
const row = { verificationId, recruiterName: claim.recruiterName, claimedEmployer: claim.claimedEmployer, roleTitle: null, companyId: null, createdAt: claim.createdAt, expiresAt: claim.expiresAt, employer: { confirmations: 0, disputes: 0 } };
const evidence = [
  { id: "employer-not-on-oryqen", area: "employer", source: "not_checked", effect: "not_checked", material: false, title: "The employer has not been matched to an ORYQEN organization", detail: "Only registry and domain evidence can be considered.", sourceLabel: null, sourceUrl: null, observedAt: "2026-10-27T00:00:00Z" },
  { id: "profile-not-read", area: "profile", source: "not_checked", effect: "not_checked", material: false, title: "Professional-network pages are never read", detail: "ORYQEN does not read these pages.", sourceLabel: null, sourceUrl: null, observedAt: "2026-10-27T00:00:00Z" },
];

async function open(page: Page, bodies: unknown[]) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: { offer, agreementId: id, confirmation: null, answers: [], canConfirm: false } } }));
  await page.route("**/api/v1/offers/assessment?*", route => route.fulfill({ json: { data: { offerId: id, offerVersion: 1, termHash: hash, assessment: assessOfferTerms(terms) } } }));
  await page.route("**/api/v1/offers/analyses**", route => route.fulfill({ json: { data: { offerId: id, items: [] } } }));
  let created = false;
  await page.route("**/api/v1/recruiter", route => {
    if (route.request().method() === "POST") { bodies.push(route.request().postDataJSON()); created = true; return route.fulfill({ json: { data: { verificationId } } }); }
    return route.fulfill({ json: { data: { items: created ? [row] : [] } } });
  });
  await page.route("**/api/v1/recruiter/result?*", route => route.fulfill({ json: { data: {
    generatedAt: "2026-10-27T00:00:00Z", status: "UNVERIFIED", summary: "Nothing here confirms that this person represents the employer.", reasons: ["No employer has confirmed this person."], unresolved: ["Ask the employer directly through a number you found yourself."],
    evidence, claim, limits: ["This result is not a judgement on anyone's honesty."],
  } } }));
  await page.route("**/api/v1/recruiter/delete", route => { bodies.push(route.request().postDataJSON()); return route.fulfill({ json: { data: { deleted: true } } }); });
  await page.goto(`/app/check?offerId=${id}`);
}

test("a recruiter check needs the notice acknowledged, shows evidence without calling anyone a name, and can be deleted", async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await open(page, bodies);
  const panel = page.getByRole("region", { name: "Recruiter verification" });
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Employer they say they represent")).toHaveValue("Acme Tools"); // carried over from the offer
  const submit = panel.getByRole("button", { name: "Check this recruiter" });
  await panel.getByLabel("Recruiter's name as given to you").fill("Asha Perera");
  await panel.getByLabel("Their business email address (optional)").fill("asha@acmetools.com");
  await expect(submit).toBeDisabled(); // the notice is not acknowledged yet
  await panel.getByRole("checkbox", { name: /I understand/ }).check();
  await submit.click();

  const result = page.getByRole("article", { name: "Recruiter verification result" });
  await expect(result.getByRole("status")).toContainText("Unverified");
  await expect(result.getByRole("list", { name: "Evidence" })).toContainText("Not checked");
  await expect(result).toContainText("Professional-network pages are never read");
  await expect(result).not.toContainText(/scammer|fraud(ster)?|fake recruiter|liar/i);
  expect(bodies[0]).toMatchObject({ recruiterName: "Asha Perera", claimedEmployer: "Acme Tools", noticeAcknowledged: true });
  expect(bodies[0]!.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);

  // Pasted wording is judged on the device: nothing is posted for it.
  await result.getByText("Check a message's wording on this device").click();
  await result.getByLabel("Message text").fill("You must pay a fee to secure your place before you start.");
  const before = bodies.length;
  await result.getByRole("button", { name: "Check the wording" }).click();
  await expect(result.getByRole("list", { name: "Check a message's wording on this device" })).toBeVisible();
  expect(bodies.length).toBe(before);

  await result.getByRole("button", { name: "Delete this check" }).click();
  await result.getByRole("button", { name: "Delete now" }).click();
  await expect.poll(() => bodies.some(body => body.verificationId === verificationId && !("recruiterName" in body))).toBe(true);
  await expect(panel.getByRole("button", { name: "Check this recruiter" })).toBeVisible();
});

test("the recruiter panel is translated and does not overflow a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, []);
  await page.goto("/app/settings");
  await page.getByLabel("Language").selectOption("si");
  await page.goto(`/app/check?offerId=${id}`);
  await expect(page.getByRole("region", { name: translate("si", "rv.title") })).toBeVisible();
  await expect(page.getByText(translate("si", "rv.intro"))).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\brv\.[a-zA-Z.]+\b/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
