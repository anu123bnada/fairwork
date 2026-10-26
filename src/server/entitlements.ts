import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { checkLimit, checkOrgLimit, entitlementRead, essentialFeatures, limitKeys, orgEntitlementRead, resolveOrgPlan, resolvePlan, type LimitKey } from "@/features/entitlements/catalog";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

// The plan the caller is on. A failed or malformed read falls back to the free plan: it can lower a limit,
// but essential protections never depend on it.
export async function readPlan(rpc: Rpc) {
  const { data, error } = await rpc("entitlement_read", {});
  const parsed = entitlementRead.safeParse(error ? null : data);
  return { plan: resolvePlan(parsed.success ? parsed.data.plan : null), assignedAt: parsed.success ? parsed.data.assignedAt : null, degraded: !parsed.success };
}

// Throws RATE_LIMITED (the application's "limit reached" error) when issuing would pass the plan limit.
export function enforceLimit(plan: ReturnType<typeof resolvePlan>, key: LimitKey, used: number) {
  const result = checkLimit(plan, key, used);
  if (!result.allowed) throw new AppError("RATE_LIMITED", 429);
  return result;
}

export async function entitlementSummary(rpc: Rpc, usage: Record<LimitKey, number>) {
  const { plan, assignedAt, degraded } = await readPlan(rpc);
  return {
    plan: { id: plan.id, name: plan.name, summary: plan.summary }, assignedAt, degraded,
    essentialFeatures: [...essentialFeatures],
    limits: limitKeys.map(key => checkLimit(plan, key, usage[key])),
    billing: { available: false as const, note: "No payment provider is connected. Plans are assigned by an operator." },
  };
}

export async function assignPlan(rpc: Rpc, request: Record<string, unknown>) {
  const { data, error } = await rpc("entitlement_assign", request);
  if (error) throw mapDatabaseError(error);
  return data;
}

// An organization's plan and live-listing usage, for approved representatives only (the database refuses everyone else). A failed or
// malformed read falls back to the basic plan, which can only lower the allowance.
export async function readOrgPlan(rpc: Rpc, companyId: string, listingId?: string) {
  const { data, error } = await rpc("org_entitlement_read", listingId ? { companyId, listingId } : { companyId });
  if (error && ["ACTION_FORBIDDEN", "AUTH_REQUIRED", "VALIDATION_FAILED"].some(code => error.message?.includes(code))) throw mapDatabaseError(error);
  const parsed = orgEntitlementRead.safeParse(error ? null : data);
  const plan = resolveOrgPlan(parsed.success ? parsed.data.plan : null);
  return { plan, assignedAt: parsed.success ? parsed.data.assignedAt : null, liveListings: parsed.success ? parsed.data.liveListings : 0, degraded: !parsed.success };
}
export async function orgEntitlementSummary(rpc: Rpc, companyId: string) {
  const { plan, assignedAt, liveListings, degraded } = await readOrgPlan(rpc, companyId);
  return {
    plan: { id: plan.id, name: plan.name, summary: plan.summary }, assignedAt, degraded,
    limits: [checkOrgLimit(plan, "liveListings", liveListings)],
    billing: { available: false as const, note: "No payment provider is connected. Organization plans are assigned by an operator." },
  };
}
// Publishing a listing that is not already live must fit the organization's plan. Editing a live listing never counts against it.
export async function enforceListingLimit(rpc: Rpc, companyId: string, listingId: string) {
  const { plan, liveListings } = await readOrgPlan(rpc, companyId, listingId);
  const result = checkOrgLimit(plan, "liveListings", liveListings);
  if (!result.allowed) throw new AppError("RATE_LIMITED", 429);
  return result;
}
export async function assignOrgPlan(rpc: Rpc, request: Record<string, unknown>) {
  const { data, error } = await rpc("org_entitlement_assign", request);
  if (error) throw mapDatabaseError(error);
  return data;
}
