import { expect, test, type Page } from "@playwright/test";
const id = "40000000-0000-4000-8000-000000000001";
const h = (c: string) => c.repeat(64);
const base = { statement: "x", challenge: { possible: true, how: "You can open a case.", href: "/app/cases" }, visibility: { summary: "Visible to you and the named employer representative.", shareable: true, manageHref: "/app/share" }, evidence: [], audit: [] };
const claims = [
  { ...base, claimId: h("1"), type: "work_performed", statement: "Welder: 40 hours, 2026-10-01 to 2026-10-05.", source: { kind: "work_record", id, version: 1, contentHash: h("a"), recordedAt: "2026-10-01T10:00:00Z" },
    providedBy: { role: "you", label: "You submitted this record" },
    verification: { assurance: "independently_reviewed", method: "An approved employer representative reviewed the exact record and its evidence.", verifiedAt: "2026-10-02T09:00:00Z", verifier: { role: "employer_representative", authorityDecisionId: id }, caveat: "The reviewer's organization authority was approved under the demo-authority.v1 policy. ORYQEN has not verified a real employer or legal identity." },
    evidence: [{ id, kind: "text_note", recordedAt: "2026-10-01T10:00:00Z" }],
    validity: { state: "active", expiresAt: null, endedAt: null, endedBy: null, reason: null, supersededByVersion: null },
    audit: [{ at: "2026-10-01T10:00:00Z", event: "Version 1 created", by: "you" }, { at: "2026-10-02T09:00:00Z", event: "Version 1 verified by a representative", by: "employer_representative" }] },
  { ...base, claimId: h("2"), type: "employment_period", statement: "Technician at Synthetic Works, 2021-03 to present.", source: { kind: "employment_entry", id, version: 1, contentHash: null, recordedAt: "2026-10-20T00:00:00Z" },
    providedBy: { role: "you", label: "You (self-reported)" },
    verification: { assurance: "self_reported", method: "None. This is your own statement; no other party has confirmed it.", verifiedAt: null, verifier: null, caveat: null },
    validity: { state: "active", expiresAt: null, endedAt: null, endedBy: null, reason: null, supersededByVersion: null },
    challenge: { possible: false, how: "Only you can change it, by saving a new revision.", href: "/app/work-record" }, visibility: { summary: "Private to you. Self-reported history is not part of the shared Passport.", shareable: false, manageHref: null } },
  { ...base, claimId: h("3"), type: "work_performed", statement: "Welder: 8 hours, 2026-09-01.", source: { kind: "work_record", id, version: 1, contentHash: h("b"), recordedAt: "2026-09-01T10:00:00Z" },
    providedBy: { role: "you", label: "You submitted this record" },
    verification: { assurance: "self_reported", method: "A representative recorded: disputed.", verifiedAt: null, verifier: { role: "employer_representative", authorityDecisionId: id }, caveat: "The reviewer's organization authority was approved under the demo-authority.v1 policy." },
    validity: { state: "disputed", expiresAt: null, endedAt: null, endedBy: null, reason: "Hours differ from log", supersededByVersion: null }, visibility: { summary: "Visible to you and the named employer representative.", shareable: false, manageHref: "/app/share" } },
  { ...base, claimId: h("4"), type: "work_performed", statement: "Welder: 16 hours, 2026-08-01.", source: { kind: "work_record", id, version: 1, contentHash: h("c"), recordedAt: "2026-08-01T10:00:00Z" },
    providedBy: { role: "you", label: "You submitted this record" },
    verification: { assurance: "self_reported", method: "A representative recorded: verified.", verifiedAt: null, verifier: null, caveat: null },
    validity: { state: "retracted", expiresAt: null, endedAt: "2026-08-09T08:00:00Z", endedBy: "employer_representative", reason: "Reviewed the wrong week", supersededByVersion: null }, visibility: { summary: "Visible to you and the named employer representative.", shareable: false, manageHref: "/app/share" } },
];
const chain = (list: unknown[]) => ({ data: { generatedAt: "2026-10-26T12:00:00Z", claims: list, counts: { total: list.length, independentlyReviewed: 1, counterpartyAcknowledged: 0, selfReported: 3, needsAttention: 2 }, sources: { employmentEntries: 1, workRecords: 3, offers: 0 }, truncated: false, limitations: ["A claim marked independently reviewed was confirmed by an employer representative whose organization authority was approved under ORYQEN's demo-authority.v1 policy."] } });
async function setup(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/passport**", route => route.fulfill({ json: { data: { policyVersion: "private-work-passport.v1", passportId: id, ownerId: id, createdAt: "2026-10-01T00:00:00Z", nextCursor: null, entries: [] } } }));
  await page.route("**/api/v1/me/employment-history**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
}

test("the Trust Chain answers who claimed, who verified, what supports it and whether it still stands, without overstating assurance", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/trust-chain", route => route.fulfill({ json: chain(claims) }));
  await page.goto("/app/passport");
  const panel = page.getByRole("region", { name: "Trust Chain" });
  await expect(panel.getByRole("status").first()).toContainText("4 claims: 1 reviewed by an employer representative, 0 acknowledged by both parties, 3 self-reported, 2 needing attention.");
  const reviewed = panel.getByRole("article", { name: /Work performed: Welder: 40 hours/ });
  await expect(reviewed).toContainText("Reviewed by an employer representative"); await expect(reviewed).toContainText("Valid as recorded");
  await expect(reviewed).toContainText("demo-authority.v1"); await expect(reviewed).toContainText("1 private note attached"); await expect(reviewed).toContainText("content fingerprint aaaaaaaaaaaa");
  await expect(reviewed).toContainText("No expiry is recorded."); await expect(reviewed.getByRole("link", { name: "Manage sharing" })).toHaveAttribute("href", "/app/share");
  await reviewed.getByText("History (2)").click(); await expect(reviewed).toContainText("Version 1 verified by a representative");
  const self = panel.getByRole("article", { name: /Employment period/ });
  await expect(self).toContainText("Self-reported"); await expect(self).not.toContainText(/Reviewed by|Verified \d/); await expect(self).toContainText("No supporting evidence recorded");
  await expect(self).toContainText("Private to you"); await expect(self.getByRole("link", { name: "Manage sharing" })).toHaveCount(0);
  const retracted = panel.getByRole("article", { name: /16 hours/ });
  await expect(retracted).toContainText("Verification retracted"); await expect(retracted).toContainText("by the employer representative"); await expect(retracted).toContainText("Reviewed the wrong week");
  await expect(panel.getByRole("article", { name: /8 hours/ })).toContainText("Disputed");
  await panel.getByRole("button", { name: "Needs attention" }).click();
  await expect(panel.getByRole("article")).toHaveCount(2);
  await panel.getByRole("button", { name: "Reviewed" }).click(); await expect(panel.getByRole("article")).toHaveCount(1);
  await panel.getByRole("button", { name: "Self-reported" }).click(); await expect(panel.getByRole("article")).toHaveCount(3);
  await panel.getByText("What the Trust Chain does not guarantee").click(); await expect(panel).toContainText("demo-authority.v1 policy");
});

test("an empty chain explains how to start, and a failure is recoverable", async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route("**/api/v1/trust-chain", route => ++calls === 1 ? route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }) : route.fulfill({ json: chain([]) }));
  await page.goto("/app/passport");
  const panel = page.getByRole("region", { name: "Trust Chain" });
  await expect(panel.locator("p[role=alert]")).toContainText("could not be loaded");
  await panel.getByRole("button", { name: "Retry" }).click();
  await expect(panel).toContainText("No claims yet. Add employment history, log work or save an offer"); await expect(panel.locator("p[role=alert]")).toHaveCount(0);
});

test("the Trust Chain heading follows the selected language and the layout holds on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.route("**/api/v1/trust-chain", route => route.fulfill({ json: chain(claims) }));
  await page.goto("/app/settings"); await page.getByLabel("Language").selectOption("de");
  await page.goto("/app/passport");
  await expect(page.getByRole("heading", { name: "Vertrauenskette" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
