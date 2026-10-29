import { expect, test as setup } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { hostedOrigin, stateFile } from "../../playwright.hosted.config";
import { assertSafeOrigin, credentials } from "./guard";

// Signs in through the real sign-in page once and keeps the session in a gitignored state file (.tmp is ignored). The password is not written anywhere.
setup("sign in as the dedicated staging test account", async ({ page }) => {
  assertSafeOrigin(hostedOrigin);
  const { email, password } = credentials();
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue securely" }).click();
  // A brand-new account has no profile yet and is sent to /register/profile. Creating it is a write to the test account itself, so it is opt-in.
  const needsProfile = await page.waitForURL(/\/(app\/|register\/profile)/, { timeout: 30_000 }).then(() => /register\/profile/.test(page.url()), () => false);
  if (needsProfile) {
    expect(process.env.ORYQEN_HOSTED_PROFILE, "Sign-in worked, but this account has no profile yet. Re-run with --create-profile, or complete the profile once by hand in a browser.").toBe("1");
    await page.getByLabel("Display name").fill("ORYQEN QA test account");
    await page.getByRole("button", { name: "Create my profile" }).click();
  }
  // An account with an authenticator enrolled stops at a code step; the dedicated test account must not have one.
  await expect(page, "sign-in should land inside the app (an account with an authenticator is not supported by this suite)").toHaveURL(/\/app\//);
  mkdirSync(path.dirname(stateFile), { recursive: true });
  await page.context().storageState({ path: stateFile });
});
