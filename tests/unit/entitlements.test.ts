import { describe, expect, it } from "vitest";
import { checkLimit, essentialFeatures, featureAllowed, isEssential, planIds, plans, resolvePlan } from "@/features/entitlements/catalog";

describe("entitlement catalog", () => {
  it("keeps the essential worker protections pinned", () => {
    expect([...essentialFeatures]).toEqual([
      "passport", "work_records", "case_review", "employment_history", "offer_assessment", "guidance",
      "saved_analyses", "trust_chain_view", "credential_verification", "privacy_requests", "language_choice",
    ]);
  });

  it("allows every essential feature on every plan and when the plan is unknown or unreadable", () => {
    for (const value of [...planIds, "enterprise", "", null, undefined, 42, { plan: "worker_plus" }]) {
      const plan = resolvePlan(value);
      for (const feature of essentialFeatures) expect(featureAllowed(plan, feature), `${String(value)}:${feature}`).toBe(true);
    }
  });

  it("falls back to the free plan, never to a higher one, and closes unknown features", () => {
    expect(resolvePlan("enterprise").id).toBe("worker_free");
    expect(resolvePlan(null).id).toBe("worker_free");
    expect(featureAllowed(plans.worker_plus, "unreleased_feature")).toBe(false);
    expect(isEssential("passport")).toBe(true);
    expect(isEssential("unreleased_feature")).toBe(false);
  });

  it("never gives the free plan more than a paid-style plan, and every limit is positive", () => {
    for (const key of Object.keys(plans.worker_free.limits) as (keyof typeof plans.worker_free.limits)[]) {
      expect(plans.worker_free.limits[key]).toBeGreaterThan(0);
      expect(plans.worker_free.limits[key]).toBeLessThanOrEqual(plans.worker_plus.limits[key]);
    }
  });

  it("meters usage against a limit and treats bad counts as zero", () => {
    const free = plans.worker_free;
    expect(checkLimit(free, "activeCredentials", 0)).toMatchObject({ allowed: true, remaining: free.limits.activeCredentials });
    expect(checkLimit(free, "activeCredentials", free.limits.activeCredentials - 1)).toMatchObject({ allowed: true, remaining: 1 });
    expect(checkLimit(free, "activeCredentials", free.limits.activeCredentials)).toMatchObject({ allowed: false, remaining: 0 });
    expect(checkLimit(free, "activeCredentials", Number.NaN)).toMatchObject({ used: 0, allowed: true });
    expect(checkLimit(free, "activeCredentials", -5)).toMatchObject({ used: 0 });
  });
});
