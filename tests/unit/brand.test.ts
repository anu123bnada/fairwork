import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { brandManifestSchema } from "@/lib/brand/contract";
import assets from "@/lib/brand/assets.json";

afterEach(() => { vi.doUnmock("@/lib/brand/identity"); vi.resetModules(); });

// Metadata-only fixture: no replacement logo is drawn or installed in public/.
const fixtureAsset = { src: "/oryqen/approved/test-only.svg", width: 240, height: 60, sha256: "a".repeat(64) };
const fixtureIdentity = { approvalReference: "unit test fixture only", logo: { light: fixtureAsset, dark: { ...fixtureAsset, src: "/oryqen/approved/test-only-dark.svg" } }, mark: { light: { ...fixtureAsset, width: 60 }, dark: { ...fixtureAsset, width: 60 } } };

describe("official brand gate", () => {
  it("does not silently approve an existing asset or reserve any header space", async () => {
    expect(brandManifestSchema.parse(assets).status).toBe("awaiting-approved-assets");
    const { BrandLogo, BrandMark, AppBrandHeader } = await import("@/components/brand/brand");
    for (const Component of [BrandLogo, BrandMark, AppBrandHeader]) expect(renderToStaticMarkup(createElement(Component))).toBe("");
    const existing = createElement("span", { className: "existing-ui" }, "Existing UI");
    expect(renderToStaticMarkup(createElement(BrandLogo, { existing }))).toBe(renderToStaticMarkup(existing));
  });

  it("rejects legacy marks, remote assets, traversal and incomplete approval", () => {
    for (const src of ["/oryqen/mark.svg", "/figma/auth/shield.svg", "https://example.test/logo.svg", "/oryqen/approved/../mark.svg"]) {
      expect(brandManifestSchema.safeParse({ status: "approved", identity: { ...fixtureIdentity, logo: { ...fixtureIdentity.logo, light: { ...fixtureAsset, src } } } }).success).toBe(false);
    }
    expect(brandManifestSchema.safeParse({ status: "approved", identity: null }).success).toBe(false);
    expect(brandManifestSchema.safeParse({ status: "approved", identity: { ...fixtureIdentity, approvalReference: "" } }).success).toBe(false);
    expect(brandManifestSchema.safeParse({ status: "awaiting-approved-assets", identity: fixtureIdentity }).success).toBe(false);
  });

  it("uses supplied dimensions, meaningful alt text and explicit dark artwork without a text wordmark", async () => {
    vi.doMock("@/lib/brand/identity", () => ({ approvedBrand: fixtureIdentity }));
    const { BrandLogo, BrandMark, ExistingBrand, AppBrandHeader } = await import("@/components/brand/brand");
    const html = renderToStaticMarkup(createElement(BrandLogo, { theme: "dark", existing: "Must disappear" }));
    expect(html).toContain('alt="ORYQEN"');
    expect(html).toContain('width="240"');
    expect(html).toContain('height="60"');
    expect(html).toContain('src="/oryqen/approved/test-only-dark.svg"');
    expect(html).not.toContain("Must disappear");
    expect(renderToStaticMarkup(createElement(BrandMark))).toContain('width="60"');
    expect(renderToStaticMarkup(createElement(ExistingBrand, { children: "Old identity" }))).toBe("");
    const prominent = renderToStaticMarkup(createElement(AppBrandHeader, { prominent: true }));
    const collapsed = renderToStaticMarkup(createElement(AppBrandHeader, { collapsed: true }));
    expect((prominent.match(/<img /g) ?? []).length).toBe(1);
    expect((collapsed.match(/<img /g) ?? []).length).toBe(1);
    expect(prominent).toContain('data-oryqen-brand="logo"');
    expect(collapsed).toContain('data-oryqen-brand="mark"');
    expect(collapsed).not.toContain("<a"); // No new navigation that could discard an in-progress workflow.
  });

  it("preserves the existing shield and rejected asset bytes without promoting either", () => {
    const hashes = {
      "public/figma/auth/shield.svg": "c5a5b6ec46be9fb17c13f02332c4826abb04bda5bafbf85ee947f308eddf0abf",
      "public/oryqen/mark.svg": "54eb27b12326fb9f81c5fc1bb4b0d2e3a6fc2284c7041d3f85edf19b06c12871",
      "public/oryqen/restored-icon-512.png": "a39d48f1272494c6a13eed5c12fe156a877094982b1241991102782b53a5be74",
    };
    for (const [path, hash] of Object.entries(hashes)) expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(hash);
  });
});

it("every page and route fallback reaches shared brand infrastructure (including newly added routes)", () => {
  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(dir, entry.name)) : [resolve(dir, entry.name)]);
  }
  const brand = resolve("src/components/brand/brand.tsx");
  function reachesBrand(file: string, visited = new Set<string>()): boolean {
    if (file === brand) return true;
    if (visited.has(file)) return false;
    visited.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
      const name = match[1]!;
      if (!name.startsWith("@/") && !name.startsWith(".")) continue;
      const base = name.startsWith("@/") ? resolve("src", name.slice(2)) : resolve(dirname(file), name);
      const target = [base + ".tsx", base + ".ts", resolve(base, "index.tsx"), resolve(base, "index.ts")].find(existsSync);
      if (target && reachesBrand(target, visited)) return true;
    }
    return false;
  }
  const pages = files(resolve("src/app")).filter(path => /(?:page|error|loading|not-found)\.tsx$/.test(path));
  expect(pages.length).toBeGreaterThanOrEqual(18);
  for (const page of pages) expect(reachesBrand(page), page).toBe(true);
});
