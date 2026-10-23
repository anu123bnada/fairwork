import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogChecks, expiryWaitPlan, isExpiredJwtResponse, readSessionWithoutRefresh, rpcSurfaceVerdict, validCatalogReport } from "../../scripts/day1-verification-inputs.mjs";

const passingReport = () => catalogChecks.map(check_name => ({ check_name, result: "PASS" }));
const now = 1_800_000_000_000;
const projectRef = "synthetic-project";
const envelope = (rows: unknown = passingReport()) => ({ projectRef, timestamp: new Date(now).toISOString(), rows });
const valid = (value: unknown) => validCatalogReport(value, projectRef, now);

describe("authenticated RPC surface evidence", () => {
  const paths = { "/": {}, "/rpc/get_me": {}, "/rpc/update_profile": {}, "/rpc/create_profile": {} };
  const restricted = { status: 401, data: { message: "Secret API key required" } };

  it("accepts an exact OpenAPI inventory only with passing direct RPC probes", () => {
    expect(rpcSurfaceVerdict({ status: 200, data: { paths } }, false, true)).toBe(true);
    expect(rpcSurfaceVerdict({ status: 200, data: { paths } }, true, false)).toBe(false);
  });

  it("fails extra, missing or malformed paths even with a passing catalog", () => {
    for (const bad of [{ ...paths, "/private_data": {} }, { "/rpc/get_me": {} }, null, [], {}]) {
      expect(rpcSurfaceVerdict({ status: 200, data: { paths: bad } }, true, true)).toBe(false);
    }
  });

  it("requires current catalog and direct evidence for a known gateway restriction", () => {
    expect(rpcSurfaceVerdict(restricted, true, true)).toBe(true);
    expect(rpcSurfaceVerdict(restricted, false, true)).toBeNull();
    expect(rpcSurfaceVerdict(restricted, true, false)).toBe(false);
    expect(rpcSurfaceVerdict({ status: 403, data: {
      message: "Access to schema is forbidden",
      hint: "Accessing the schema via the Data API is only allowed using a secret API key.",
    } }, true, true)).toBe(true);
  });

  it("never treats unrelated denial or infrastructure failure as inventory proof", () => {
    for (const response of [null, { status: 401, data: { message: "JWT expired" } },
      { status: 403, data: { message: "Access to schema is forbidden" } },
      { status: 404, data: { code: "PGRST126" } },
      { status: 500, data: restricted.data }, { status: 401, data: null }]) {
      expect(rpcSurfaceVerdict(response, true, true)).toBe(false);
    }
  });
});

describe("owner-exported hosted catalog evidence", () => {
  it("accepts the complete current SQL verdict set in any order", () => {
    const sql = readFileSync("scripts/day1-hosted-catalog.sql", "utf8");
    const names = [...sql.matchAll(/select '([^']+)'/g)].map(match => match[1]);
    expect([...catalogChecks].sort()).toEqual(names.sort());
    expect(catalogChecks).toHaveLength(16);
    expect(valid(envelope(passingReport().reverse()))).toBe(true);
  });

  it("rejects failures, missing checks, duplicate checks and unknown checks", () => {
    const failed = passingReport();
    failed[0]!.result = "FAIL";
    expect(valid(envelope(failed))).toBe(false);
    expect(valid(envelope(passingReport().slice(1)))).toBe(false);
    const duplicated = passingReport();
    duplicated[0] = duplicated[1]!;
    expect(valid(envelope(duplicated))).toBe(false);
    const unknown = passingReport();
    unknown[0]!.check_name = "Unrelated check";
    expect(valid(envelope(unknown))).toBe(false);
  });

  it("rejects incomplete or malformed verdict formats", () => {
    for (const invalid of [null, {}, { results: passingReport() }, [], [null], "PASS"]) {
      expect(valid(invalid)).toBe(false);
    }
    for (const result of ["UNVERIFIED", "pass", "PASS ", null, true]) {
      const invalid: unknown[] = passingReport();
      invalid[0] = { check_name: catalogChecks[0], result };
      expect(valid(envelope(invalid))).toBe(false);
    }
  });

  it("requires current evidence for the configured project", () => {
    expect(valid({ ...envelope(), projectRef: "another-project" })).toBe(false);
    expect(valid({ ...envelope(), timestamp: new Date(now - 3_600_001).toISOString() })).toBe(false);
    expect(valid({ ...envelope(), timestamp: new Date(now + 300_001).toISOString() })).toBe(false);
    expect(valid({ ...envelope(), timestamp: "invalid" })).toBe(false);
    expect(valid({ rows: passingReport() })).toBe(false);
    expect(valid(passingReport())).toBe(false);
  });
});

describe("natural session expiry observation", () => {
  it("waits until provider expiry plus a clock-boundary margin without shortening it", () => {
    const now = 1_800_000_000_000;
    expect(expiryWaitPlan(now / 1000 + 3600, now)).toEqual({
      expiresAtMs: now + 3_600_000,
      waitUntilMs: now + 3_635_000,
      remainingMs: 3_635_000,
    });
    expect(expiryWaitPlan(now / 1000, now).remainingMs).toBe(35000);
  });

  it("does not wait again after expiry has actually passed", () => {
    expect(expiryWaitPlan(1_800_000_000, 1_800_000_036_000).remainingMs).toBe(0);
  });

  it("refuses absent, invalid and overflowing expiry metadata", () => {
    for (const expiry of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
      expect(() => expiryWaitPlan(expiry)).toThrow("VALID_SESSION_EXPIRY_REQUIRED");
    }
    expect(() => expiryWaitPlan(1_800_000_000, NaN)).toThrow("VALID_SESSION_EXPIRY_REQUIRED");
  });

  it("recognizes actual JWT expiry across PostgREST versions, never unrelated denial", () => {
    for (const code of ["PGRST301", "PGRST303"]) {
      expect(isExpiredJwtResponse({ status: 401, data: { code, message: "JWT expired" } })).toBe(true);
      expect(isExpiredJwtResponse({ status: 401, data: { code, message: "JWT invalid signature" } })).toBe(false);
      expect(isExpiredJwtResponse({ status: 401, data: { code, message: "JWT issued at future" } })).toBe(false);
      expect(isExpiredJwtResponse({ status: 403, data: { code, message: "JWT expired" } })).toBe(false);
    }
    expect(isExpiredJwtResponse({ status: 401, data: { code: "42501", message: "JWT expired" } })).toBe(false);
    expect(isExpiredJwtResponse({ status: 401, data: null })).toBe(false);
  });
});

describe("passive browser-session observation", () => {
  afterEach(() => vi.unstubAllGlobals());
  const cookies = (secondsRemaining: number) => [{ name: "sb-synthetic-auth-token", value: "base64-" + Buffer.from(JSON.stringify({
    access_token: "synthetic-access", refresh_token: "synthetic-refresh", token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + secondsRemaining, user: { id: "synthetic-identity" },
  })).toString("base64url") }];

  it("reads an unexpired cookie without provider requests or cookie changes", async () => {
    const network = vi.fn(() => { throw new Error("Unexpected provider request"); });
    vi.stubGlobal("fetch", network);
    const input = cookies(3600);
    const before = JSON.stringify(input);
    const session = await readSessionWithoutRefresh("https://synthetic.supabase.co", "sb_publishable_synthetic", input);
    expect(session?.access_token).toBe("synthetic-access");
    expect(session?.refresh_token).toBe("synthetic-refresh");
    expect(JSON.stringify(input)).toBe(before);
    expect(network).not.toHaveBeenCalled();
  });

  it("cannot refresh expired cookies and cannot turn missing cookies into a session", async () => {
    const network = vi.fn(() => { throw new Error("Unexpected provider request"); });
    vi.stubGlobal("fetch", network);
    const input = cookies(-10);
    const before = JSON.stringify(input);
    expect(await readSessionWithoutRefresh("https://synthetic.supabase.co", "sb_publishable_synthetic", input)).toBeNull();
    expect(await readSessionWithoutRefresh("https://synthetic.supabase.co", "sb_publishable_synthetic", [])).toBeNull();
    expect(JSON.stringify(input)).toBe(before);
    expect(network).not.toHaveBeenCalled();
  });
});
