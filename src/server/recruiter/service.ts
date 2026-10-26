import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { buildEvidence, domainControl, defaultEvidenceDeps, type CompanyDomain, type EvidenceDeps } from "./evidence";
import { evaluateRecruiter } from "@/features/recruiter/status";
import { claimRow, companySearchResponse, domainList, listResponse, NOTICE_VERSION, queueResponse, result as resultSchema, type ClaimInput, type Evidence, type RecruiterResult } from "@/features/recruiter/schema";
import { claimableDomain } from "@/features/recruiter/domain";
import type { z } from "zod";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
async function call<T>(rpc: Rpc, name: string, request: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await rpc(name, request);
  if (error) throw mapDatabaseError(error);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}
const nullable = (value: string | undefined) => value ?? null;

export async function createVerification(rpc: Rpc, input: ClaimInput) {
  return rpc("recruiter_create", {
    verificationId: input.idempotencyKey, companyId: nullable(input.companyId), recruiterName: input.recruiterName, claimedEmployer: input.claimedEmployer, roleTitle: nullable(input.roleTitle),
    email: nullable(input.email), profileUrl: nullable(input.profileUrl), employerSite: nullable(input.employerSite), postingUrl: nullable(input.postingUrl), registryLei: nullable(input.registryLei),
    noticeVersion: NOTICE_VERSION, idempotencyKey: input.idempotencyKey,
  }).then(({ data, error }) => { if (error) throw mapDatabaseError(error); return data as { verificationId: string; replayed: boolean }; });
}
export const listVerifications = (rpc: Rpc) => call(rpc, "recruiter_list", {}, listResponse);
export const searchCompanies = (rpc: Rpc, query: string) => call(rpc, "recruiter_company_search", { query }, companySearchResponse);
export async function deleteVerification(rpc: Rpc, verificationId: string) {
  const { data, error } = await rpc("recruiter_delete", { verificationId });
  if (error) throw mapDatabaseError(error);
  return data;
}

const LIMITS = [
  "ORYQEN can confirm only what an employer's approved representative states and what it can observe now. It cannot confirm a person's identity.",
  "A matching name, an email format, a profile page or a summary written by a model is never counted as proof.",
  "Evidence is read fresh each time and dated. A result can change, and an employer's confirmation expires or can be withdrawn.",
  "This is information for your own judgment, not a finding about the person. Never send money, identity documents or bank details because of a result here.",
];

// The full, current picture for one verification: the stored claim and employer decisions, plus evidence read now.
export async function verificationResult(rpc: Rpc, verificationId: string, deps: EvidenceDeps = defaultEvidenceDeps): Promise<RecruiterResult> {
  const claim = await call(rpc, "recruiter_read", { verificationId }, claimRow);
  let domains: CompanyDomain[] = [];
  if (claim.companyId) {
    const listed = await rpc("company_domain_list", { companyId: claim.companyId });
    if (!listed.error) { const parsed = domainList.safeParse(listed.data); if (parsed.success) domains = parsed.data.items; }
  }
  const { evidence } = await buildEvidence(claim, domains, deps);
  const now = deps.now().toISOString();
  const decisionEvidence: Evidence[] = [];
  const { employer } = claim;
  const decision = (value: Partial<Evidence> & Pick<Evidence, "id" | "effect" | "title" | "detail" | "source">): Evidence => ({ area: "decision", material: false, materialWhenConfirmed: false, sourceLabel: "The employer's approved representative", sourceUrl: null, observedAt: now, quote: null, ...value });
  if (employer.disputes > 0) decisionEvidence.push(decision({ id: "decision-dispute", source: "employer_confirmation", effect: "contradicts", material: true, title: "A representative of the employer disputes this claim", detail: `${claim.decisions.find(item => item.decision === "dispute")?.reason ?? "No reason was recorded."}` }));
  if (employer.confirmations > 0) decisionEvidence.push(decision({ id: "decision-confirm", source: "employer_confirmation", effect: "supports", title: `A representative of the employer confirms this person${employer.confirmedUntil ? ` until ${employer.confirmedUntil.slice(0, 10)}` : ""}`, detail: `${claim.decisions.find(item => item.decision === "confirm")?.reason ?? "No reason was recorded."} This is the employer's own statement, recorded on ORYQEN; ORYQEN did not verify the person's identity.` }));
  if (!employer.confirmations && !employer.disputes) decisionEvidence.push(decision({ id: "decision-none", source: "not_checked", effect: "not_checked", title: claim.companyId ? "No employer representative has confirmed or disputed this person yet" : "No employer confirmation is possible because the employer is not an ORYQEN organization", detail: claim.companyId ? "Representatives see this request without your identity. Confirmations expire." : "Contact the employer through details you found yourself." }));
  const all = [...decisionEvidence, ...evidence];
  const evaluation = evaluateRecruiter({ claim: { recruiterName: claim.recruiterName, claimedEmployer: claim.claimedEmployer, companyId: claim.companyId, email: claim.email }, employer, evidence: all });
  return resultSchema.parse({ generatedAt: now, ...evaluation, evidence: all, claim, limits: LIMITS });
}

// ---- employer side
export const approvalQueue = (rpc: Rpc, cursor: string | null) => call(rpc, "recruiter_queue", { cursor }, queueResponse);
export async function decide(rpc: Rpc, input: { verificationId: string; decision: "confirm" | "dispute" | "withdraw"; reason: string; validDays: number | null; idempotencyKey: string }) {
  const { data, error } = await rpc("recruiter_decide", input);
  if (error) throw mapDatabaseError(error);
  return data;
}
export async function claimDomain(rpc: Rpc, companyId: string, domain: string) {
  const normalized = claimableDomain(domain);
  if (!normalized) throw new AppError("VALIDATION_FAILED", 422);
  const { data, error } = await rpc("company_domain_claim", { companyId, domain: normalized });
  if (error) throw mapDatabaseError(error);
  return data;
}
export async function removeDomain(rpc: Rpc, domainId: string) {
  const { data, error } = await rpc("company_domain_remove", { domainId });
  if (error) throw mapDatabaseError(error);
  return data;
}
// A company's claimed domains with the live outcome of the control check, so a representative can see whether publishing the token worked.
export async function domainsWithProof(rpc: Rpc, companyId: string, deps: EvidenceDeps = defaultEvidenceDeps) {
  const { items } = await call(rpc, "company_domain_list", { companyId }, domainList);
  return Promise.all(items.map(async item => ({ ...item, proof: await domainControl(item.domain, item.token, deps) })));
}
