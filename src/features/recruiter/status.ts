import type { ClaimInput, Evidence, RecruiterStatus } from "./schema";

// The verification state is decided by these rules and nothing else; no language model takes part.
//  CONFLICTING_EVIDENCE  an employer disputes the claim, or something material contradicts it (a look-alike address, or, once an employer has
//                        confirmed this person, an address or page that does not belong to the employer)
//  VERIFIED              at least one approved representative of the employer currently confirms this person, and nothing material contradicts it
//  PARTIALLY_VERIFIED    some claims are supported by evidence ORYQEN could observe, but the employer has not confirmed this person
//  UNVERIFIED            nothing supports the claim yet
// A matching name, an email format, a profile page or a model's summary is never counted as support.
export type Decision = { confirmations: number; disputes: number; confirmedUntil?: string | null };
export type Evaluation = { status: RecruiterStatus; summary: string; reasons: string[]; unresolved: string[] };

export function evaluateRecruiter(input: { claim: Pick<ClaimInput, "recruiterName" | "claimedEmployer"> & { companyId?: string | null; email?: string | null }; employer: Decision; evidence: Evidence[] }): Evaluation {
  const { employer, evidence } = input;
  const confirmed = employer.confirmations > 0 && employer.disputes === 0;
  const material = evidence.filter(item => item.effect === "contradicts" && (item.material || (item.materialWhenConfirmed && employer.confirmations > 0)));
  const supporting = evidence.filter(item => item.effect === "supports" && item.source !== "employer_confirmation");
  const reasons: string[] = [];
  const unresolved: string[] = [];

  if (employer.disputes > 0) reasons.push(employer.confirmations > 0 ? "One representative confirms this person and another disputes the claim." : "A representative of the employer disputes that this person is authorized to recruit for it.");
  for (const item of material) reasons.push(item.title);
  if (employer.confirmations > 0 && employer.disputes === 0) reasons.push(`A representative of the employer currently confirms this person${employer.confirmedUntil ? ` (confirmation valid until ${employer.confirmedUntil.slice(0, 10)})` : ""}.`);
  for (const item of supporting) reasons.push(item.title);

  if (employer.confirmations === 0 && employer.disputes === 0) {
    unresolved.push(input.claim.companyId
      ? "The employer's representatives have not confirmed or disputed this person yet. Check again later, or ask the recruiter to have the employer confirm in writing through the employer's own official channel."
      : "This employer is not an ORYQEN organization, so it cannot confirm this person here. Find the employer's official contact details yourself and ask them directly; do not rely on contact details the recruiter gave you.");
  }
  for (const item of evidence) if (item.effect === "not_checked" && item.area !== "profile") unresolved.push(item.title);
  if (!supporting.length && !confirmed) unresolved.push("No independent evidence supports the claimed affiliation yet.");

  let status: RecruiterStatus, summary: string;
  if (employer.disputes > 0 || material.length > 0) {
    status = "CONFLICTING_EVIDENCE";
    summary = "Some evidence contradicts the claim. This needs your review before you share documents or money; it is not a finding about the person.";
  } else if (confirmed) {
    status = "VERIFIED";
    summary = "An approved representative of the employer has confirmed this person, and nothing ORYQEN could observe contradicts it. Confirmations expire and can be withdrawn.";
  } else if (supporting.length) {
    status = "PARTIALLY_VERIFIED";
    summary = "Some details are supported by evidence ORYQEN observed, but the employer has not confirmed this person.";
  } else {
    status = "UNVERIFIED";
    summary = "ORYQEN found no evidence that confirms or contradicts this claim. Unverified is not a finding that anything is wrong.";
  }
  return { status, summary, reasons: [...new Set(reasons)].slice(0, 12), unresolved: [...new Set(unresolved)].slice(0, 12) };
}
