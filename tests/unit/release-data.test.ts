import { expect, it } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { androidRelease, windowsRelease, httpsUrl } from "@/features/releases/releases";

const manifest = readFileSync("docs/RELEASE_MANIFEST.md", "utf8");
const bytes = (text: string) => Number(/([\d,]+) bytes/.exec(text)![1]!.replaceAll(",", ""));

it.each([windowsRelease, androidRelease])("$name release data matches the release manifest", release => {
  expect(manifest).toContain(release.sha256);
  expect(manifest).toContain(release.size.split(" (")[0]!);
  expect(release.signed).toBe(false);
  expect(release.signing).toMatch(/unsigned|debug/i);
});

it.each([
  [windowsRelease, "release-artifacts/windows-staging/ORYQEN-Preview-0.1.0-x64-Setup.exe"],
  [androidRelease, "release-artifacts/android-staging/ORYQEN-Online-Preview-1.0.0-staging-debug.apk"],
] as const)("$0.name figures match the built file when it is present locally", (release, path) => {
  if (!existsSync(path)) return; // artifacts are git-ignored; verified wherever they exist
  expect(statSync(path).size).toBe(bytes(release.size));
  expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(release.sha256);
});

it("the APK served with the site is the same file the manifest describes", () => {
  const served = "public/downloads/ORYQEN-Online-Preview-1.0.0-staging-debug.apk";
  expect(existsSync(served)).toBe(true);
  expect(statSync(served).size).toBe(bytes(androidRelease.size));
  expect(createHash("sha256").update(readFileSync(served)).digest("hex")).toBe(androidRelease.sha256);
});

it("only accepts https download URLs", () => {
  expect(httpsUrl("https://downloads.example.test/oryqen.exe")).toBe("https://downloads.example.test/oryqen.exe");
  for (const bad of [undefined, "", "http://example.test/a.exe", "javascript:alert(1)", "not a url", "file:///c:/a.exe"]) expect(httpsUrl(bad)).toBeNull();
});
