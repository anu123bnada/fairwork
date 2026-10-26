import { expect, test } from "@playwright/test";

test("private decision and archive survive reload, and an ambiguous write retries its key", async ({ page }) => {
  const id = "40000000-0000-4000-8000-000000000001";
  let archived = false, decision = "considering", revision = 0, failOnce = true;
  const keys: string[] = [];
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/offers?*", route => {
    const view = new URL(route.request().url()).searchParams.get("view");
    const visible = view === "all" || archived === (view === "archived");
    return route.fulfill({ json: { data: { items: visible ? [{ offerId: id, companyId: id, version: 1, role: "Synthetic role", createdAt: "2026-10-25", questions: 0, archived, decision, lifecycleRevision: revision }] : [], nextCursor: null } } });
  });
  await page.route("**/api/v1/offers/lifecycle", route => {
    const body = route.request().postDataJSON();
    keys.push(body.idempotencyKey);
    if (failOnce) { failOnce = false; return route.abort("failed"); }
    archived = body.archived; decision = body.decision; revision++;
    return route.fulfill({ json: { data: { saved: true, revision } } });
  });
  await page.goto("/app/home");
  const region = page.getByRole("region", { name: "Saved offers", exact: true });
  const decisions = region.getByLabel("Your decision for Synthetic role");
  await decisions.selectOption("interested");
  await expect(region.getByRole("alert")).toBeVisible();
  await decisions.selectOption("interested");
  await expect(decisions).toHaveValue("interested");
  expect(keys[0]).toBe(keys[1]);
  await region.getByRole("button", { name: "Archive offer", exact: true }).click();
  await expect(region).toContainText("No saved offers");
  await region.getByLabel("Offer view").selectOption("archived");
  await expect(region.getByRole("button", { name: "Restore offer" })).toBeVisible();
  await page.reload();
  await expect(region).toContainText("No saved offers");
  await region.getByLabel("Offer view").selectOption("archived");
  await expect(decisions).toHaveValue("interested");
  await region.getByRole("button", { name: "Restore offer" }).click();
  await expect(region).toContainText("No saved offers");
  await region.getByLabel("Offer view").selectOption("active");
  await expect(decisions).toHaveValue("interested");
});

test("loaded offers can be searched by role and filtered by decision, and the page says it only covers loaded offers", async ({ page }) => {
  const id = (n: number) => `40000000-0000-4000-8000-00000000000${n}`;
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  const row = (n: number, role: string, decision: string) => ({ offerId: id(n), companyId: id(1), version: 1, role, createdAt: "2026-10-25", questions: 0, archived: false, decision, lifecycleRevision: 0 });
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: [row(2, "Welder", "interested"), row(3, "Warehouse Assistant", "considering"), row(4, "Cook", "declined")], nextCursor: null } } }));
  await page.goto("/app/home");
  const region = page.getByRole("region", { name: "Saved offers" });
  await expect(region.getByRole("link", { name: "Open offer" })).toHaveCount(3);
  await expect(region).toContainText("only the offers loaded on this page");
  await region.getByLabel("Search loaded offers by role").fill("ware");
  await expect(region.getByRole("link", { name: "Open offer" })).toHaveCount(1);
  await region.getByLabel("Search loaded offers by role").fill("");
  await region.getByLabel("Show decision").selectOption("declined");
  await expect(region.getByRole("link", { name: "Open offer" })).toHaveCount(1);
  await region.getByLabel("Search loaded offers by role").fill("welder");
  await expect(region).toContainText("No loaded offer matches");
});
