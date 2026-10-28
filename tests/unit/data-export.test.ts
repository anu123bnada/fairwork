import { describe, expect, it } from "vitest";
import { buildDataExport, EXPORT_FORMAT, sources, stripSecrets } from "@/features/privacy/export";

const NOW = new Date("2026-10-27T10:00:00Z");
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function fake(overrides: Record<string, (path: string) => unknown> = {}) {
  const calls: string[] = [];
  const get = async (path: string) => {
    calls.push(path);
    const base = path.split("?")[0]!;
    if (overrides[path]) return overrides[path]!(path);
    if (overrides[base]) return overrides[base]!(path);
    if (base === "/api/v1/offers") return path.includes("cursor=") ? { items: [{ offerId: id(2) }], nextCursor: null } : { items: [{ offerId: id(1) }], nextCursor: id(1) };
    if (base === "/api/v1/credentials") return { signingConfigured: true, verifyBase: "https://x.test/verify", items: [{ credentialId: id(5), status: "valid", token: "SECRET.TOKEN.VALUE", expiresAt: "2027-01-01T00:00:00Z" }] };
    if (base === "/api/v1/developer/webhooks") return { items: [{ webhookId: id(6), url: "https://hooks.example.test/in", secret: "S".repeat(43) }] };
    if (base === "/api/v1/offers/analyses") return { offerId: new URL(`http://x${path}`).searchParams.get("offerId"), items: [{ id: id(9) }] };
    if (base === "/api/v1/notifications") return path.includes("cursorAt=") ? { items: [{ eventKey: "b" }], nextCursor: null } : { items: [{ eventKey: "a" }], nextCursor: { cursorAt: "2026-10-01T00:00:00Z", cursorKey: "a" } };
    return { items: [], nextCursor: null };
  };
  return { get, calls };
}

describe("data export", () => {
  it("reads every listed source, follows pagination, and labels the file", async () => {
    const { get, calls } = fake();
    const result = await buildDataExport(get, NOW);
    expect(result.format).toBe(EXPORT_FORMAT); expect(result.exportedAt).toBe(NOW.toISOString());
    for (const source of sources) expect(result.sections[source.name]?.status, source.name).toBe("ok");
    expect(calls.filter(call => call.startsWith("/api/v1/offers?"))).toEqual(["/api/v1/offers?context=WORKER&view=all", `/api/v1/offers?context=WORKER&view=all&cursor=${id(1)}`]);
    const offers = result.sections.offers as { data: { items: unknown[]; complete: boolean } };
    expect(offers.data.items).toHaveLength(2); expect(offers.data.complete).toBe(true);
    expect(calls).toContain("/api/v1/notifications?cursorAt=2026-10-01T00%3A00%3A00Z&cursorKey=a");
    expect(result.sections.savedAnalyses).toMatchObject({ status: "ok", count: 2 });
    expect(result.notes.join(" ")).toMatch(/not included/);
  });

  it("never includes credential tokens, webhook secrets or other secret fields", async () => {
    const text = JSON.stringify(await buildDataExport(fake().get, NOW));
    expect(text).not.toContain("SECRET.TOKEN.VALUE"); expect(text).not.toContain("S".repeat(43));
    expect(text).toContain(id(5)); expect(text).toContain("https://hooks.example.test/in");
    expect(stripSecrets({ a: [{ token: "x", ok: 1, nested: { password: "p", keep: 2 } }] })).toEqual({ a: [{ ok: 1, nested: { keep: 2 } }] });
  });

  it("reports a section it cannot read as unavailable, keeps going, and never invents data", async () => {
    const { get } = fake({ "/api/v1/credentials": () => { throw new Error("Too many requests. Try again shortly."); }, "/api/v1/vault": () => { throw new Error("SERVICE_UNAVAILABLE"); } });
    const result = await buildDataExport(get, NOW);
    expect(result.sections.credentials).toEqual({ status: "unavailable", reason: "Too many requests. Try again shortly." });
    expect(result.sections.evidenceVaultDocuments?.status).toBe("unavailable");
    expect(Object.keys(result.sections)).toEqual(expect.arrayContaining(["evidenceVaultStatus", "researchHistory"]));
    expect(result.sections.profile?.status).toBe("ok"); expect(result.sections.workRecords?.status).toBe("ok");
  });

  it("stops following cursors after a bounded number of pages and says the section is incomplete", async () => {
    let n = 0;
    const result = await buildDataExport(fake({ "/api/v1/work-records": () => ({ items: [{ n: n++ }], nextCursor: id(n) }) }).get, NOW);
    const records = result.sections.workRecords as { status: "ok"; data: { items: unknown[]; complete: boolean } };
    expect(records.data.items.length).toBe(20); expect(records.data.complete).toBe(false);
  });

  it("handles a failing analysis lookup without losing the offers", async () => {
    const result = await buildDataExport(fake({ "/api/v1/offers/analyses": () => { throw new Error("x"); } }).get, NOW);
    expect(result.sections.offers?.status).toBe("ok"); expect(result.sections.savedAnalyses).toEqual({ status: "unavailable", reason: "Saved analyses could not be read." });
  });

  it("includes the person's recruiter checks, privacy requests and Passport sharing grants", async () => {
    const { get, calls } = fake({ "/api/v1/recruiter": () => ({ items: [{ verificationId: id(7), recruiterName: "Synthetic Recruiter" }] }) });
    const result = await buildDataExport(get, NOW);
    for (const name of ["recruiterChecks", "privacyRequests", "passportSharing"]) expect(result.sections[name]?.status, name).toBe("ok");
    expect(result.sections.recruiterChecks).toMatchObject({ count: 1 });
    expect(calls).toEqual(expect.arrayContaining(["/api/v1/recruiter", "/api/v1/privacy-requests", "/api/v1/passport/sharing"]));
  });
});
