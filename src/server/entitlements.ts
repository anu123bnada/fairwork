import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { checkLimit, entitlementRead, essentialFeatures, limitKeys, resolvePlan, type LimitKey } from "@/features/entitlements/catalog";

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
