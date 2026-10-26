import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// The language note tells people which screens are still English. This keeps that statement true: a screen with readable English text
// must either use the translation hook or be on the list below. When a screen is translated it must leave the list (and the note is
// edited if it named that screen); when a new English screen appears the build fails until it is translated or consciously listed.
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => { const file = path.join(dir, name); return statSync(file).isDirectory() ? walk(file) : [file]; });
const ENGLISH_ON_PURPOSE: Record<string, string> = {
  "src/components/admin/admin-center.tsx": "administration console (operators), listed in the language note",
  "src/components/admin/operations-overview.tsx": "administration console (operators)",
  "src/components/fairwork/company-profiles.tsx": "organization and company screens, listed in the note",
  "src/components/fairwork/credential-verifier.tsx": "public verifier page",
  "src/components/fairwork/dashboard-records.tsx": "home record lists",
  "src/components/fairwork/day3-offer-demo.tsx": "legacy demo route",
  "src/components/fairwork/developer-access.tsx": "developer access, listed in the note",
  "src/components/fairwork/jurisdiction-check.tsx": "country references (legal text kept in English)",
  "src/components/fairwork/offer-company-selector.tsx": "organization screens",
  "src/components/fairwork/organization-requests.tsx": "organization screens, listed in the note",
  "src/components/fairwork/org-plan-panel.tsx": "organization plan panel and operator form (employer workspace and operator tools, English like the screens around them)",
  "src/components/fairwork/page-shell.tsx": "layout wrapper", "src/components/fairwork/status.tsx": "layout wrapper",
  "src/components/oryqen/appearance.tsx": "appearance picker", "src/components/oryqen/cinematic-core.tsx": "landing animation", "src/components/oryqen/profile-editor.tsx": "profile editor",
  "src/app/about/page.tsx": "public page", "src/app/admin/[[...section]]/page.tsx": "administration console", "src/app/auth/confirm/page.tsx": "server page shell",
  "src/app/auth/recover/page.tsx": "server page shell", "src/app/downloads/page.tsx": "public downloads page, listed in the note", "src/app/error.tsx": "error boundary",
  "src/app/forgot-password/page.tsx": "server page shell", "src/app/not-found.tsx": "error page", "src/app/operator/authority/page.tsx": "operator console",
  "src/app/page.tsx": "public landing page, listed in the note", "src/app/register/page.tsx": "server page shell", "src/app/register/profile/page.tsx": "server page shell",
  "src/app/sign-in/information/page.tsx": "public information page",
};
const hasEnglishText = (text: string) => />[A-Z][a-z]+( [a-zA-Z’']+){1,}[^<{]*</.test(text) || /"[A-Z][a-z]+ [a-z]+ [a-z]+[^"]*"/.test(text);

describe("localization coverage statement", () => {
  const files = [...walk("src/components"), ...walk("src/app")].map(file => file.replace(/\\/g, "/")).filter(file => file.endsWith(".tsx"));
  const english = files.filter(file => { const text = readFileSync(file, "utf8"); return !text.includes("useI18n") && hasEnglishText(text); });

  it("every screen with English text either translates or is listed on purpose", () => {
    const unlisted = english.filter(file => !ENGLISH_ON_PURPOSE[file]);
    expect(unlisted, `these screens show English text without the translation hook; translate them or list them with a reason: ${unlisted.join(", ")}`).toEqual([]);
  });
  it("the list does not name a screen that has since been translated or removed", () => {
    const stale = Object.keys(ENGLISH_ON_PURPOSE).filter(file => !english.includes(file));
    expect(stale, `remove these from the list (and update the language note if it names them): ${stale.join(", ")}`).toEqual([]);
  });
});
