import { describe, expect, it } from "vitest";
import { profileProbe } from "../../scripts/profile-probe.mjs";

describe("hosted profile probe diagnostics", () => {
  it("retains a backend failure instead of reporting cookie loss", () => {
    expect(profileProbe({ status: 503, data: { error: { code: "SERVICE_UNAVAILABLE" } } })).toEqual({
      available: false, note: "HTTP 503; application code SERVICE_UNAVAILABLE",
    });
  });
  it("distinguishes authentication rejection from backend failure", () => {
    expect(profileProbe({ status: 401, data: { error: { code: "AUTH_REQUIRED" } } })).toEqual({
      available: false, note: "HTTP 401; application code AUTH_REQUIRED",
    });
  });
  it("accepts only the domain NOT_FOUND response as profile bootstrap eligibility", () => {
    expect(profileProbe({ status: 404, data: { error: { code: "NOT_FOUND" } } }).available).toBe(true);
    expect(profileProbe({ status: 404, data: null }).available).toBe(false);
    expect(profileProbe({ status: 200 }).available).toBe(true);
  });
  it("does not include untrusted codes or response content in diagnostics", () => {
    const response = { status: 500, data: { error: { code: "synthetic-secret", message: "private provider body" }, access_token: "synthetic-token" } };
    expect(profileProbe(response)).toEqual({ available: false, note: "HTTP 500; application code OTHER" });
  });
});
