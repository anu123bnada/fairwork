import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { checkOrgLimit, orgPlans, orgPlanIds, resolveOrgPlan, essentialFeatures } from "@/features/entitlements/catalog";
import { enforceListingLimit, orgEntitlementSummary, readOrgPlan } from "@/server/entitlements";

const company = crypto.randomUUID(), listing = crypto.randomUUID();
const rpcReturning = (data: unknown, error: { message: string } | null = null) => vi.fn(async () => ({ data, error }));

describe("organization plan catalog", () => {
  it("has a basic and a team plan, ordered by allowance, and unknown values fall back to basic", () => {
    expect(orgPlanIds).toEqual(["org_free", "org_team"]);
    expect(orgPlans.org_team.limits.liveListings).toBeGreaterThan(orgPlans.org_free.limits.liveListings);
    expect(resolveOrgPlan("enterprise").id).toBe("org_free");
    expect(resolveOrgPlan(null).id).toBe("org_free");
  });
  it("counts remaining allowance without going negative or accepting bad numbers", () => {
    const plan = orgPlans.org_free;
    expect(checkOrgLimit(plan, "liveListings", 4)).toMatchObject({ remaining: 1, allowed: true });
    expect(checkOrgLimit(plan, "liveListings", 5)).toMatchObject({ remaining: 0, allowed: false });
    expect(checkOrgLimit(plan, "liveListings", 99).remaining).toBe(0);
    expect(checkOrgLimit(plan, "liveListings", Number.NaN).used).toBe(0);
    expect(checkOrgLimit(plan, "liveListings", -3).used).toBe(0);
  });
  it("never lists a worker protection as limited by an organization plan", () => {
    expect(JSON.stringify(orgPlans)).not.toMatch(new RegExp(essentialFeatures.join("|")));
  });
});

describe("organization plan enforcement", () => {
  it("allows publishing under the limit and refuses at it, using the plan the database reports", async () => {
    await expect(enforceListingLimit(rpcReturning({ plan: "org_free", assignedAt: null, liveListings: 4 }), company, listing)).resolves.toMatchObject({ allowed: true, remaining: 1 });
    await expect(enforceListingLimit(rpcReturning({ plan: "org_free", assignedAt: null, liveListings: 5 }), company, listing)).rejects.toMatchObject({ status: 429 });
    await expect(enforceListingLimit(rpcReturning({ plan: "org_team", assignedAt: "2026-10-28T00:00:00Z", liveListings: 5 }), company, listing)).resolves.toMatchObject({ allowed: true });
  });
  it("asks the database to exclude the listing being edited", async () => {
    const rpc = rpcReturning({ plan: "org_free", assignedAt: null, liveListings: 0 });
    await enforceListingLimit(rpc, company, listing);
    expect(rpc).toHaveBeenCalledWith("org_entitlement_read", { companyId: company, listingId: listing });
  });
  it("passes through a refusal (not a representative) instead of treating it as the basic plan", async () => {
    await expect(readOrgPlan(rpcReturning(null, { message: "ACTION_FORBIDDEN" }), company)).rejects.toMatchObject({ status: 403 });
  });
  it("falls back to the basic plan, and says so, when the read is unavailable or malformed", async () => {
    expect(await readOrgPlan(rpcReturning(null, { message: "function does not exist" }), company)).toMatchObject({ degraded: true, liveListings: 0, plan: { id: "org_free" } });
    expect(await readOrgPlan(rpcReturning({ plan: "enterprise" }), company)).toMatchObject({ degraded: true });
  });
  it("summarizes the plan with an honest billing statement", async () => {
    const summary = await orgEntitlementSummary(rpcReturning({ plan: "org_team", assignedAt: "2026-10-28T00:00:00Z", liveListings: 7 }), company);
    expect(summary).toMatchObject({ plan: { id: "org_team" }, limits: [{ key: "liveListings", used: 7, remaining: 43 }], billing: { available: false } });
  });
});
