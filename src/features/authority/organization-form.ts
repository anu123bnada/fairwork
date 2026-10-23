import { organizationDecisionSchema, organizationRequestSchema } from "./organization-schema";

export class OrganizationFormError extends Error {
  constructor(readonly field: string, message: string) { super(message); }
}

// Client feedback only. The API and PostgreSQL still validate every command,
// derive identity, check MFA/authority and serialize membership revisions.
export function organizationFormCommand(data: FormData, kind: string, requestId?: string, now = Date.now()) {
  const value = (field: string) => String(data.get(field) ?? "").trim();
  if (!requestId) {
    const result = organizationRequestSchema.safeParse({
      companyId: kind === "existing" ? value("companyId") : null,
      companyName: kind === "new" ? value("companyName") : null,
      statement: value("statement"),
    });
    if (!result.success) {
      const field = String(result.error.issues[0]?.path[0] ?? "companyName");
      throw new OrganizationFormError(field, field === "companyId" ? "Enter the valid organization ID supplied by your organization. A request does not grant access." : field === "statement" ? "Enter a membership request statement (up to 500 characters)." : "Enter an organization name (up to 120 characters).");
    }
    return result.data;
  }
  const decision = value("decision");
  let expiresAt: string | null = null;
  if (decision === "approve") {
    const expires = new Date(value("expiry")).getTime();
    if (!Number.isFinite(expires) || expires <= now || expires > now + 30 * 86400000) {
      throw new OrganizationFormError("expiry", "Choose an approval expiry in the future, within 30 days.");
    }
    expiresAt = new Date(expires).toISOString();
  }
  if (!value("revision")) throw new OrganizationFormError("revision", "Enter the current membership revision; do not guess it.");
  const result = organizationDecisionSchema.safeParse({
    requestId, decision, reason: value("reason"), expectedRevision: Number(value("revision")), expiresAt,
    reviewedEvidenceRefs: decision === "approve" ? value("evidence").split("\n").map(v => v.trim()).filter(Boolean) : [],
  });
  if (!result.success) {
    const field = String(result.error.issues[0]?.path[0] ?? "reviewedEvidenceRefs");
    if (field === "reviewedEvidenceRefs") throw new OrganizationFormError("evidence", "Approval requires 1–10 reviewed synthetic evidence references, each starting with demo: (up to 120 characters after the prefix).");
    if (field === "expectedRevision") throw new OrganizationFormError("revision", "Enter a valid whole-number membership revision.");
    throw new OrganizationFormError(field, "Enter a valid decision and rationale (up to 500 characters).");
  }
  return result.data;
}
