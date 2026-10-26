import { expect, test, type Page } from "@playwright/test";

const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SECRET = "A".repeat(43);
async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/developer/webhooks", route => route.request().method() === "GET" ? route.fulfill({ json: { data: { items: [] } } }) : route.fallback());
}

test("a person creates a key, sees the full key once, then only metadata, and revokes it with a confirmation", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  await signedIn(page);
  let rows: { keyId: string; label: string; scopes: string[]; createdAt: string; revokedAt: string | null; callsLast24h: number }[] = [{ keyId: id(7), label: "Old integration", scopes: ["credentials:verify"], createdAt: "2026-10-01T00:00:00Z", revokedAt: null, callsLast24h: 12 }];
  const bodies: Record<string, unknown>[] = []; let revoked = "";
  await page.route("**/api/v1/developer/keys", route => {
    if (route.request().method() === "POST") {
      bodies.push(route.request().postDataJSON());
      rows = [{ keyId: id(8), label: "HR system", scopes: ["credentials:verify"], createdAt: "2026-10-27T00:00:00Z", revokedAt: null, callsLast24h: 0 }, ...rows];
      return route.fulfill({ json: { data: { keyId: id(8), scopes: ["credentials:verify"], key: `oryq_live_${id(8)}.${SECRET}`, note: "Copy this key now. It cannot be shown again." } } });
    }
    return route.fulfill({ json: { data: { items: rows } } });
  });
  await page.route("**/api/v1/developer/keys/revoke", route => { revoked = route.request().postDataJSON().keyId; rows = rows.map(row => row.keyId === revoked ? { ...row, revokedAt: "2026-10-27T01:00:00Z" } : row); return route.fulfill({ json: { data: { keyId: revoked, status: "revoked" } } }); });
  await page.goto("/app/settings");
  await page.getByText("Developer access").click();
  const panel = page.getByRole("region", { name: "Developer access" });
  await expect(panel).toContainText("never reads or changes any account"); await expect(panel).toContainText("Old integration"); await expect(panel).toContainText("12 checks in the last 24 hours");
  await panel.getByLabel(/Name for this key/).fill("HR system");
  await panel.getByRole("button", { name: "Create key" }).click();
  const shown = panel.getByRole("group", { name: "New key" });
  await expect(shown).toContainText("It cannot be shown again"); await expect(shown.getByLabel("New key")).toHaveValue(`oryq_live_${id(8)}.${SECRET}`);
  expect(bodies).toEqual([{ label: "HR system" }]);
  await shown.getByRole("button", { name: "I have saved it" }).click();
  await expect(panel).not.toContainText(SECRET); await expect(panel).toContainText("HR system");
  const item = panel.getByRole("listitem").filter({ hasText: "Old integration" });
  await item.getByRole("button", { name: "Revoke" }).click(); expect(revoked).toBe("");
  await expect(item.getByRole("group", { name: "Confirm revoking" })).toBeVisible();
  await item.getByRole("button", { name: "Revoke now" }).click();
  await expect(item).toContainText("revoked"); await expect(item.getByRole("button", { name: "Revoke" })).toHaveCount(0); expect(revoked).toBe(id(7));
});

test("a refused creation shows a plain error and the page holds on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page);
  await page.route("**/api/v1/developer/keys", route => route.request().method() === "POST"
    ? route.fulfill({ status: 429, json: { error: { code: "RATE_LIMITED" } } })
    : route.fulfill({ json: { data: { items: [] } } }));
  await page.goto("/app/settings");
  await page.getByText("Developer access").click();
  const panel = page.getByRole("region", { name: "Developer access" });
  await expect(panel).toContainText("No keys yet");
  await panel.getByLabel(/Name for this key/).fill("A very long key name that should wrap inside the panel instead of widening it");
  await panel.getByRole("button", { name: "Create key" }).click();
  await expect(panel.getByRole("alert")).toBeVisible(); await expect(panel.getByRole("group", { name: "New key" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("a person adds a webhook endpoint, sees its signing secret once, sends a test event, and removes it with a confirmation", async ({ page }) => {
  await signedIn(page);
  await page.route("**/api/v1/developer/keys", route => route.fulfill({ json: { data: { items: [] } } }));
  let hooks: unknown[] = [{ webhookId: id(21), url: "https://old.example.test/in", createdAt: "2026-10-01T00:00:00Z", lastDelivery: { at: "2026-10-02T00:00:00Z", outcome: "failed", statusCode: 503, eventType: "credential.revoked", attempt: 3 } }];
  const created: Record<string, unknown>[] = []; let removed = "", pinged = "";
  await page.route("**/api/v1/developer/webhooks", route => {
    if (route.request().method() === "POST") {
      created.push(route.request().postDataJSON());
      hooks = [...hooks, { webhookId: id(22), url: "https://hooks.example.test/oryqen", createdAt: "2026-10-27T00:00:00Z", lastDelivery: null }];
      return route.fulfill({ json: { data: { webhookId: id(22), url: "https://hooks.example.test/oryqen", secret: "S".repeat(43), note: "Copy this signing secret now. It cannot be shown again." } } });
    }
    return route.fulfill({ json: { data: { items: hooks } } });
  });
  await page.route("**/api/v1/developer/webhooks/test", route => { pinged = route.request().postDataJSON().webhookId; return route.fulfill({ json: { data: { eventId: id(30), outcome: "delivered", statusCode: 204 } } }); });
  await page.route("**/api/v1/developer/webhooks/delete", route => { removed = route.request().postDataJSON().webhookId; hooks = hooks.filter(item => (item as { webhookId: string }).webhookId !== removed); return route.fulfill({ json: { data: { webhookId: removed, status: "deleted" } } }); });
  await page.goto("/app/settings");
  await page.getByText("Developer access").click();
  const panel = page.getByRole("region", { name: "Developer access" });
  await expect(panel).toContainText("Oryqen-Signature"); await expect(panel).toContainText("last delivery failed (HTTP 503)"); await expect(panel).toContainText("credential.revoked");
  await panel.getByLabel("Endpoint address (https)").fill("https://hooks.example.test/oryqen");
  await panel.getByRole("button", { name: "Add endpoint" }).click();
  const secret = panel.getByRole("group", { name: "New signing secret" });
  await expect(secret).toContainText("cannot be shown again"); await expect(secret.getByLabel("Signing secret")).toHaveValue("S".repeat(43));
  expect(created).toEqual([{ url: "https://hooks.example.test/oryqen" }]);
  await secret.getByRole("button", { name: "I have saved it" }).click(); await expect(panel).not.toContainText("S".repeat(43));
  const item = panel.getByRole("listitem").filter({ hasText: "hooks.example.test" });
  await item.getByRole("button", { name: "Send test event" }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Test event delivered (HTTP 204)" })).toBeVisible(); expect(pinged).toBe(id(22));
  const old = panel.getByRole("listitem").filter({ hasText: "old.example.test" });
  await old.getByRole("button", { name: "Remove endpoint" }).click(); expect(removed).toBe("");
  await old.getByRole("button", { name: "Remove now" }).click();
  await expect(panel).not.toContainText("old.example.test"); expect(removed).toBe(id(21));
});

test("a refused or unreachable endpoint shows a plain explanation", async ({ page }) => {
  await signedIn(page);
  await page.route("**/api/v1/developer/keys", route => route.fulfill({ json: { data: { items: [] } } }));
  await page.route("**/api/v1/developer/webhooks", route => route.request().method() === "POST"
    ? route.fulfill({ status: 422, json: { error: { code: "VALIDATION_FAILED" } } })
    : route.fulfill({ json: { data: { items: [{ webhookId: id(21), url: "https://down.example.test/in", createdAt: "2026-10-01T00:00:00Z", lastDelivery: null }] } } }));
  await page.route("**/api/v1/developer/webhooks/test", route => route.fulfill({ json: { data: { eventId: id(30), outcome: "failed", statusCode: null } } }));
  await page.goto("/app/settings");
  await page.getByText("Developer access").click();
  const panel = page.getByRole("region", { name: "Developer access" });
  await panel.getByLabel("Endpoint address (https)").fill("https://127.0.0.1/hook");
  await panel.getByRole("button", { name: "Add endpoint" }).click();
  await expect(panel.getByRole("alert")).toBeVisible(); await expect(panel.getByRole("group", { name: "New signing secret" })).toHaveCount(0);
  await panel.getByRole("button", { name: "Send test event" }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Test event not delivered (no response)" })).toBeVisible();
});
