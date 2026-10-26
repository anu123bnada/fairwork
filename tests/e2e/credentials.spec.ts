import { expect, test, type Page } from "@playwright/test";
import { generateSigningKey, issueCredential } from "../../src/features/credentials/core";
import type { TrustClaim } from "../../src/features/trust/schema";

const ISSUER = "http://127.0.0.1:3101", STATUS_URL = `${ISSUER}/api/v1/credentials/status`;
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`, h = (c: string) => c.repeat(64);
const DEMO = "The reviewer's organization authority was approved under the demo-authority.v1 policy. ORYQEN has not verified a real employer or legal identity.";
const reviewed: TrustClaim = {
  claimId: h("a"), type: "work_performed", statement: "Welder: 40 hours, 2026-10-01 to 2026-10-05.",
  source: { kind: "work_record", id: id(10), version: 1, contentHash: h("b"), recordedAt: "2026-10-01T10:00:00Z" }, providedBy: { role: "you", label: "You submitted this record" },
  verification: { assurance: "independently_reviewed", method: "An approved employer representative reviewed the exact record.", verifiedAt: "2026-10-02T09:00:00Z", verifier: { role: "employer_representative", authorityDecisionId: id(80) }, caveat: DEMO },
  evidence: [], validity: { state: "active", expiresAt: null, endedAt: null, endedBy: null, reason: null, supersededByVersion: null },
  challenge: { possible: true, how: "You can open a case.", href: "/app/cases" }, visibility: { summary: "Visible to you and the named representative.", shareable: true, manageHref: "/app/share" }, audit: [],
};
async function mint(over: { now?: Date; days?: number; kid?: string } = {}) {
  const keys = await generateSigningKey("e2e-key");
  const issued = await issueCredential({ claim: reviewed, issuer: ISSUER, statusUrl: STATUS_URL, now: over.now ?? new Date(), lifetimeDays: over.days ?? 90, credentialId: id(500), subjectRef: id(501), kid: over.kid ?? "e2e-key" }, keys.privateJwk);
  return { token: issued.jws, keys };
}
async function serve(page: Page, keys: Awaited<ReturnType<typeof mint>>["keys"], status: { status: string; reason: string | null } | number = { status: "valid", reason: null }) {
  await page.route("**/.well-known/oryqen-keys.json", route => route.fulfill({ json: { issuer: ISSUER, keys: [{ ...keys.publicJwk, use: "sig", alg: "EdDSA" }] } }));
  await page.route("**/api/v1/credentials/status?*", route => typeof status === "number" ? route.fulfill({ status, json: { error: { code: "SERVICE_UNAVAILABLE" } } }) : route.fulfill({ json: { data: { ...status, checkedAt: new Date().toISOString() }, meta: {} } }));
}

test("a genuine credential verifies in the browser, shows its limits, and never sends the credential to the server", async ({ page }, testInfo) => {
  const { token, keys } = await mint(); await serve(page, keys);
  const sent: string[] = []; page.on("request", request => { sent.push(request.url() + (request.postData() ?? "")); });
  await page.goto(`/verify#c=${token}`);
  const result = page.getByRole("status").filter({ hasText: "Valid credential" });
  await expect(result).toContainText("ORYQEN's records still support this claim");
  await expect(result).toContainText("Welder: 40 hours"); await expect(result).toContainText("Reviewed by an employer representative");
  await expect(result).toContainText("demo-authority.v1"); await expect(result).toContainText(ISSUER);
  await page.screenshot({ path: testInfo.outputPath("verify-valid-desktop.png"), fullPage: true });
  await result.getByText("What this does and does not show").click();
  await expect(result).toContainText("not a legal, government or professional certification");
  expect(sent.filter(entry => entry.includes(token) || entry.includes(token.slice(0, 40)))).toEqual([]); // the fragment never leaves the browser
  expect(sent.some(entry => entry.includes(`/api/v1/credentials/status?id=${id(500)}`))).toBe(true); // only the random id is asked about
});

test("tampered, expired, wrongly keyed and malformed credentials are rejected with an honest reason", async ({ page }) => {
  const { token, keys } = await mint(); await serve(page, keys);
  const [head, payload, signature] = token.split(".");
  const altered = JSON.parse(Buffer.from(payload!, "base64url").toString()); altered.claim.statement = "Director for 20 years";
  await page.goto(`/verify#c=${head}.${Buffer.from(JSON.stringify(altered)).toString("base64url")}.${signature}`);
  await expect(page.getByRole("status").filter({ hasText: "Not verified" })).toContainText("altered, or it was not issued by ORYQEN");
  const old = await mint({ now: new Date(Date.now() - 100 * 86400000), days: 30 }); await serve(page, old.keys);
  await page.goto(`/verify#c=${old.token}`); await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Not verified" })).toContainText("expired");
  const foreign = await mint(); await serve(page, keys); // published key set does not contain the signer
  await page.goto(`/verify#c=${foreign.token}`); await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Not verified" })).toContainText(/signature does not match|not publish/);
  await page.goto("/verify#c=not.a.credential"); await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Not verified" })).toContainText("not a valid ORYQEN credential");
});

test("a revoked, unknown or unreachable status is never shown as valid", async ({ page }) => {
  const { token, keys } = await mint();
  for (const [status, headline, text] of [
    [{ status: "revoked", reason: "holder_requested" }, "Revoked", "holder revoked"], [{ status: "revoked", reason: "source_changed" }, "Revoked", "record behind this credential has changed"],
    [{ status: "expired", reason: null }, "Expired", "validity period has ended"], [{ status: "unknown", reason: null }, "Cannot confirm", "not in ORYQEN's register"], [503, "Signature valid, status unchecked", "could not be checked"],
  ] as const) {
    await page.unrouteAll({ behavior: "ignoreErrors" }); await serve(page, keys, status as never);
    await page.goto(`/verify#c=${token}`); await page.reload();
    const result = page.getByRole("status").filter({ hasText: headline });
    await expect(result).toContainText(text); await expect(page.getByText("Valid credential")).toHaveCount(0);
  }
  await page.unrouteAll({ behavior: "ignoreErrors" }); await page.route("**/.well-known/oryqen-keys.json", route => route.fulfill({ status: 404, json: { error: "x" } }));
  await page.goto(`/verify#c=${token}`); await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Could not check" })).toBeVisible();
});

test("a pasted credential can be checked and cleared, on a phone-sized screen without overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { token, keys } = await mint(); await serve(page, keys);
  await page.goto("/verify");
  await page.getByLabel("Paste a credential").fill(token); await page.getByRole("button", { name: "Check credential" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Valid credential" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("verify-valid-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Check another credential" }).click();
  await expect(page.getByLabel("Paste a credential")).toBeVisible(); await expect(page.getByText("Valid credential")).toHaveCount(0);
});

async function trustPage(page: Page, signingConfigured: boolean, items: unknown[]) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/passport**", route => route.fulfill({ json: { data: { policyVersion: "private-work-passport.v1", passportId: id(1), ownerId: id(1), createdAt: "2026-10-01T00:00:00Z", nextCursor: null, entries: [] } } }));
  await page.route("**/api/v1/me/employment-history**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  const selfReported = { ...reviewed, claimId: h("2"), type: "employment_period", statement: "Technician, 2021 to present.", verification: { ...reviewed.verification, assurance: "self_reported", verifiedAt: null, verifier: null, caveat: null }, visibility: { ...reviewed.visibility, shareable: false } };
  await page.route("**/api/v1/trust-chain", route => route.fulfill({ json: { data: { generatedAt: "2026-10-26T12:00:00Z", claims: [reviewed, selfReported], counts: { total: 2, independentlyReviewed: 1, counterpartyAcknowledged: 0, selfReported: 1, needsAttention: 0 }, sources: { employmentEntries: 1, workRecords: 1, offers: 0 }, truncated: false, limitations: ["Test fixture."] } } }));
  await page.route("**/api/v1/credentials", route => route.request().method() === "GET" ? route.fulfill({ json: { data: { signingConfigured, verifyBase: `${ISSUER}/verify`, items } } }) : route.fallback());
}

test("a holder creates a credential from a reviewed claim, sees a QR code and link, then revokes it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  const { token } = await mint(); const verifyUrl = `${ISSUER}/verify#c=${token}`;
  let items: unknown[] = []; const bodies: Record<string, unknown>[] = []; let revoked = false;
  await trustPage(page, true, []);
  await page.route("**/api/v1/credentials", route => {
    if (route.request().method() === "POST") { bodies.push(route.request().postDataJSON()); items = [{ credentialId: id(500), sourceId: id(10), sourceVersion: 1, assurance: "independently_reviewed", issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(), token, status: "valid", reason: null }]; return route.fulfill({ json: { data: { credentialId: id(500), token, expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(), replayed: false, verifyUrl } } }); }
    return route.fulfill({ json: { data: { signingConfigured: true, verifyBase: `${ISSUER}/verify`, items: revoked ? items.map(item => ({ ...(item as object), status: "revoked", reason: "holder_requested" })) : items } } });
  });
  await page.route("**/api/v1/credentials/revoke", route => { revoked = true; return route.fulfill({ json: { data: { credentialId: id(500), status: "revoked" } } }); });
  await page.goto("/app/passport");
  const panel = page.getByRole("region", { name: "Trust Chain" });
  await expect(panel.getByRole("button", { name: "Create a shareable credential" })).toHaveCount(1); // the self-reported claim offers none
  await panel.getByRole("button", { name: "Create a shareable credential" }).click();
  await panel.getByLabel("What it says (you can shorten it, not add to it)").fill("Welder: 40 hours");
  await panel.getByLabel("Valid for").selectOption("30");
  await panel.getByRole("button", { name: "Create credential" }).click();
  const share = panel.getByRole("group", { name: "Share this credential" });
  await expect(share.getByRole("img", { name: /QR code/ })).toBeVisible(); await expect(share.getByLabel("Verification link")).toHaveValue(verifyUrl);
  await expect(share).toContainText("You can revoke it at any time"); await expect(share).toContainText("demo-authority.v1");
  expect(bodies).toHaveLength(1); expect(bodies[0]).toMatchObject({ workId: id(10), lifetimeDays: 30, statement: "Welder: 40 hours" }); expect(Object.keys(bodies[0]!).sort()).toEqual(["idempotencyKey", "lifetimeDays", "statement", "workId"]);
  await share.getByRole("button", { name: "Copy link" }).click(); await expect(share.getByRole("status")).toContainText(/copied|manually/i);
  await share.getByRole("button", { name: "Close" }).click();
  const mine = panel.getByRole("region", { name: "Your credentials" });
  await expect(mine).toContainText("Welder: 40 hours"); await expect(mine).toContainText("Valid");
  await mine.getByRole("button", { name: "Revoke", exact: true }).click(); await expect(mine.getByRole("group", { name: "Confirm revoking" })).toBeVisible(); expect(revoked).toBe(false);
  await mine.getByRole("button", { name: "Revoke now" }).click();
  await expect(mine).toContainText("Revoked"); await expect(mine).toContainText("revoked by you"); await expect(mine.getByRole("button", { name: "Show QR" })).toHaveCount(0);
});

test("when signing is not configured the interface says so instead of offering a credential", async ({ page }) => {
  await trustPage(page, false, []);
  await page.goto("/app/passport");
  const panel = page.getByRole("region", { name: "Trust Chain" });
  await expect(panel).toContainText("this server has no signing key configured"); await expect(panel.getByRole("button", { name: "Create a shareable credential" })).toHaveCount(0);
});
