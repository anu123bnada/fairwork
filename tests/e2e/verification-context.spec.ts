import { expect, test } from "@playwright/test";

for (const [suffix, heading] of [["", "Open your verification email"], ["#token_hash=invalid", "This link cannot be used"], ["#error_code=otp_expired", "This link has expired"]]) {
  test(`verification recovery: ${heading}`, async ({ page }) => {
    test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true");
    let calls = 0;
    await page.route("**/api/v1/auth/confirm", route => { calls++; return route.abort(); });
    await page.goto(`/auth/confirm?workspace=employer${suffix}`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm my email" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/sign-in?workspace=employer");
    await page.getByText("Need another verification email?").click();
    await expect(page.getByLabel("Email address")).toBeVisible();
    const contrasts = await page.getByRole("button", { name: "Resend verification email" }).evaluate(element => {
      const style = getComputedStyle(element);
      function luminance(color: string) {
        const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
      }
      const foreground = luminance(style.color);
      return (style.backgroundImage.match(/rgb\([^)]+\)/g) ?? [style.backgroundColor]).map(color => {
        const background = luminance(color);
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      });
    });
    expect(Math.min(...contrasts)).toBeGreaterThanOrEqual(4.5);
    expect(calls).toBe(0);
  });
}

test("resend limits disable retry and never claim email delivery", async ({ page }) => {
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true");
  let calls = 0;
  await page.route("**/api/v1/auth/resend", route => { calls++; return route.fulfill({ status: 429, json: { error: { code: "RATE_LIMITED" } } }); });
  await page.goto("/auth/confirm");
  await page.getByText("Need another verification email?").click();
  await page.getByLabel("Email address").fill("synthetic@example.test");
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend available in/ })).toBeDisabled();
  expect(calls).toBe(1);
});

const callback = "#access_token=synthetic.access.signature&refresh_token=synthetic-refresh&token_type=bearer&type=signup&expires_in=3600";
test("default email callback scrubs credentials, requires explicit validation and retains the employer destination", async ({ page }) => {
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true");
  let calls = 0;
  const getRequests: string[] = [];
  page.on("request", request => { if (request.method() === "GET") getRequests.push(request.url()); });
  await page.route("**/api/v1/auth/confirm", route => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({ accessToken: "synthetic.access.signature", refreshToken: "synthetic-refresh" });
    return route.fulfill({ json: { data: { confirmed: true } } });
  });
  await page.goto(`/auth/confirm?workspace=employer${callback}`);
  await expect(page).toHaveURL("/auth/confirm?workspace=employer");
  await expect(page.getByRole("button", { name: "Confirm my email" })).toBeVisible();
  expect(calls).toBe(0);
  expect(await page.locator("body").innerText()).not.toContain("synthetic-refresh");
  expect(await page.evaluate(() => JSON.stringify([sessionStorage, localStorage]))).not.toContain("synthetic-refresh");
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page).toHaveURL("/register/profile?workspace=employer");
  expect(calls).toBe(1);
  expect(getRequests.some(url => /access_token|refresh_token|synthetic-refresh/.test(url))).toBe(false);
});

test("an expired default callback cannot advance or retain credentials", async ({ page }) => {
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true");
  await page.route("**/api/v1/auth/confirm", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  await page.goto(`/auth/confirm${callback}`);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("invalid or has expired");
  await expect(page.getByRole("button", { name: "Confirm my email" })).toHaveCount(0);
  await expect(page).toHaveURL("/auth/confirm");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Open your verification email" })).toBeVisible();
});

test("mixed callback credentials are rejected without a request and stripped from navigation", async ({ page }) => {
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true");
  let calls = 0;
  await page.route("**/api/v1/auth/confirm", route => { calls++; return route.abort(); });
  await page.goto(`/auth/confirm?token_hash=${"a".repeat(64)}&workspace=employer${callback}`);
  await expect(page.getByRole("heading", { name: "This link cannot be used" })).toBeVisible();
  await expect(page).toHaveURL("/auth/confirm?workspace=employer");
  expect(calls).toBe(0);
});

test("a success-shaped response without confirmation cannot advance", async ({ page }) => {
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true");
  await page.route("**/api/v1/auth/confirm", route => route.fulfill({ json: { data: {} } }));
  await page.goto(`/auth/confirm${callback}`);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Unable to establish your session");
  await expect(page).toHaveURL("/auth/confirm");
});
