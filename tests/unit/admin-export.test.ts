import { describe, expect, it } from "vitest";
import { ADMIN_EXPORT_FORMAT, buildAdminExport, canonicalJson, sha256Hex } from "@/features/admin/export";

const NOW = new Date("2026-10-28T10:00:00Z");
const rows = (from: number, to: number) => Array.from({ length: to - from }, (_, index) => ({ id: `row-${from + index}`, status: "recorded", detail: { b: 2, a: 1 } }));

describe("administrative record export", () => {
  it("follows the cursor through every page and checksums the items", async () => {
    const pages: Record<string, { items: ReturnType<typeof rows>; nextCursor: string | null }> = { start: { items: rows(0, 2), nextCursor: "p2" }, p2: { items: rows(2, 3), nextCursor: null } };
    const seen: (string | null)[] = [];
    const result = await buildAdminExport({ resource: "audit", filters: { status: "" }, now: NOW, getPage: async cursor => { seen.push(cursor); return pages[cursor ?? "start"]!; } });
    expect(seen).toEqual([null, "p2"]);
    expect(result).toMatchObject({ format: ADMIN_EXPORT_FORMAT, resource: "audit", count: 3, pagesRead: 2, complete: true, exportedAt: NOW.toISOString() });
    expect(result.checksumSha256).toBe(await sha256Hex(canonicalJson(result.items)));
    expect(result.notes.join(" ")).toMatch(/not a signature/);
  });
  it("says so when it stops early instead of pretending to be complete", async () => {
    let n = 0;
    const result = await buildAdminExport({ resource: "audit", filters: {}, now: NOW, maxPages: 3, getPage: async () => ({ items: rows(n * 2, ++n * 2), nextCursor: `c${n}` }) });
    expect(result).toMatchObject({ complete: false, pagesRead: 3, count: 6 });
    expect(result.notes.join(" ")).toMatch(/Only the first 3 pages/);
  });
  it("gives the same checksum whatever the key order, and a different one when a record changes", async () => {
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(canonicalJson({ a: [{ c: 2, d: 1 }], b: 1 }));
    const first = await buildAdminExport({ resource: "x", filters: {}, now: NOW, getPage: async () => ({ items: [{ id: "1", status: "open" }], nextCursor: null }) });
    const second = await buildAdminExport({ resource: "x", filters: {}, now: NOW, getPage: async () => ({ items: [{ status: "open", id: "1" }], nextCursor: null }) });
    const changed = await buildAdminExport({ resource: "x", filters: {}, now: NOW, getPage: async () => ({ items: [{ id: "1", status: "closed" }], nextCursor: null }) });
    expect(second.checksumSha256).toBe(first.checksumSha256);
    expect(changed.checksumSha256).not.toBe(first.checksumSha256);
  });
  it("handles an empty result", async () => {
    const result = await buildAdminExport({ resource: "x", filters: {}, now: NOW, getPage: async () => ({ items: [], nextCursor: null }) });
    expect(result).toMatchObject({ count: 0, complete: true, pagesRead: 1 });
    expect(result.checksumSha256).toBe(await sha256Hex("[]"));
  });
});
