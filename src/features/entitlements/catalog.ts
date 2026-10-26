import { z } from "zod";

// Plan catalog (module 22, docs/ORYQEN_ENTITLEMENTS_DESIGN.md). Plans are assigned by an operator; there is no
// payment provider, price or checkout, and nothing here implies one. Limits below are placeholders for the
// owner's commercial decision, not published pricing.
export const planIds = ["worker_free", "worker_plus"] as const;
export type PlanId = (typeof planIds)[number];
export const planIdSchema = z.enum(planIds);

// Worker protections that every person keeps on every plan, including when the plan cannot be read.
// Adding a feature here is a deliberate promise; removing one is a product decision, and a test pins the list.
export const essentialFeatures = [
  "passport", "work_records", "case_review", "employment_history", "offer_assessment", "guidance",
  "saved_analyses", "trust_chain_view", "credential_verification", "privacy_requests", "language_choice",
] as const;
export type EssentialFeature = (typeof essentialFeatures)[number];

export const limitKeys = ["activeCredentials"] as const;
export type LimitKey = (typeof limitKeys)[number];

type PlanDefinition = { id: PlanId; name: string; summary: string; limits: Record<LimitKey, number> };
export const plans: Record<PlanId, PlanDefinition> = {
  worker_free: { id: "worker_free", name: "Free worker protection", summary: "Every protection a worker needs, at no cost.", limits: { activeCredentials: 10 } },
  worker_plus: { id: "worker_plus", name: "Worker plus", summary: "Higher sharing limits. Assigned by an operator; not purchasable.", limits: { activeCredentials: 50 } },
};

// Anything unrecognised resolves to the free plan, so a bad value can only ever reduce a limit, never an essential feature.
export function resolvePlan(value: unknown): PlanDefinition {
  const parsed = planIdSchema.safeParse(value);
  return plans[parsed.success ? parsed.data : "worker_free"];
}

export function isEssential(feature: string): feature is EssentialFeature {
  return (essentialFeatures as readonly string[]).includes(feature);
}

export function featureAllowed(plan: PlanDefinition, feature: string): boolean {
  if (isEssential(feature)) return true;
  return false; // no non-essential feature flags exist yet; unknown features are closed
}

export function checkLimit(plan: PlanDefinition, key: LimitKey, used: number) {
  const limit = plan.limits[key];
  const safeUsed = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  return { key, limit, used: safeUsed, remaining: Math.max(0, limit - safeUsed), allowed: safeUsed < limit };
}

export const entitlementRead = z.strictObject({ plan: planIdSchema, assignedAt: z.string().nullable() });
export const entitlementAssignRequest = z.strictObject({ subjectId: z.uuid(), plan: planIdSchema, reason: z.string().trim().min(1).max(300), idempotencyKey: z.uuid() });
export const entitlementAssigned = z.strictObject({ assignmentId: z.uuid(), plan: planIdSchema, replayed: z.boolean() });

// Organization plans (module 22). Operator-granted like worker plans, with no price or payment. They limit how much an organization
// can publish; they never gate a worker's essential protections, and an organization with no assignment is on the basic plan.
export const orgPlanIds = ["org_free", "org_team"] as const;
export type OrgPlanId = (typeof orgPlanIds)[number];
export const orgPlanIdSchema = z.enum(orgPlanIds);
export const orgLimitKeys = ["liveListings"] as const;
export type OrgLimitKey = (typeof orgLimitKeys)[number];
type OrgPlanDefinition = { id: OrgPlanId; name: string; summary: string; limits: Record<OrgLimitKey, number> };
export const orgPlans: Record<OrgPlanId, OrgPlanDefinition> = {
  org_free: { id: "org_free", name: "Organization basic", summary: "Publish a small number of live listings at no cost.", limits: { liveListings: 5 } },
  org_team: { id: "org_team", name: "Organization team", summary: "Higher listing limits. Assigned by an operator; not purchasable.", limits: { liveListings: 50 } },
};
export function resolveOrgPlan(value: unknown): OrgPlanDefinition {
  const parsed = orgPlanIdSchema.safeParse(value);
  return orgPlans[parsed.success ? parsed.data : "org_free"];
}
export function checkOrgLimit(plan: OrgPlanDefinition, key: OrgLimitKey, used: number) {
  const limit = plan.limits[key];
  const safeUsed = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  return { key, limit, used: safeUsed, remaining: Math.max(0, limit - safeUsed), allowed: safeUsed < limit };
}
export const orgEntitlementRead = z.strictObject({ plan: orgPlanIdSchema, assignedAt: z.string().nullable(), liveListings: z.number().int().nonnegative() });
export const orgEntitlementAssignRequest = z.strictObject({ companyId: z.uuid(), plan: orgPlanIdSchema, reason: z.string().trim().min(1).max(300), idempotencyKey: z.uuid() });
export const orgEntitlementAssigned = z.strictObject({ assignmentId: z.uuid(), plan: orgPlanIdSchema, replayed: z.boolean() });
