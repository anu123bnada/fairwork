import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { enforceLimit, entitlementSummary, readPlan } from "@/server/entitlements";
import { plans } from "@/features/entitlements/catalog";

const ok = (data: unknown) => async () => ({ data, error: null });

describe("entitlement server helpers", () => {
  it("reads the assigned plan", async () => {
    expect(await readPlan(ok({ plan: "worker_plus", assignedAt: "2026-10-26T00:00:00Z" }))).toMatchObject({ plan: { id: "worker_plus" }, degraded: false });
  });

  it("degrades to the free plan on an error or a malformed answer", async () => {
    expect(await readPlan(async () => ({ data: null, error: { code: "P0001", message: "SERVICE_UNAVAILABLE" } }))).toMatchObject({ plan: { id: "worker_free" }, degraded: true });
    expect(await readPlan(ok({ plan: "platinum", assignedAt: null }))).toMatchObject({ plan: { id: "worker_free" }, degraded: true });
    expect(await readPlan(ok({ plan: "worker_plus", assignedAt: null, extra: true }))).toMatchObject({ plan: { id: "worker_free" }, degraded: true });
  });

  it("refuses issuing past the plan limit with the limit-reached error", () => {
    expect(() => enforceLimit(plans.worker_free, "activeCredentials", plans.worker_free.limits.activeCredentials - 1)).not.toThrow();
    expect(() => enforceLimit(plans.worker_free, "activeCredentials", plans.worker_free.limits.activeCredentials)).toThrow();
  });

  it("summarises the plan without any billing claim", async () => {
    const summary = await entitlementSummary(ok({ plan: "worker_free", assignedAt: null }), { activeCredentials: 3 });
    expect(summary.billing.available).toBe(false);
    expect(summary.essentialFeatures).toContain("privacy_requests");
    expect(summary.limits[0]).toMatchObject({ key: "activeCredentials", used: 3, allowed: true });
  });
});
