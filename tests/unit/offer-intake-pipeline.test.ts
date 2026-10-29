import { describe, expect, it } from "vitest";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { assessOfferTerms } from "@/features/offer/assessment";

// The paste -> suggest -> save pipeline without a database: the terms the form would send, and the score the server rules derive from them.
// The real-stack script expects exactly this outcome for this text (see docs/ORYQEN_OFFER_REALSTACK_HANDOFF.md).
describe("paste to assessment pipeline", () => {
  const text = "Role: Synthetic local maintenance\nSalary: LKR 1000 monthly\nResponsibilities: Synthetic local maintenance task";
  it("detects the fields the real-stack journey checks", () => {
    expect(extractOfferTermsRuleBased(text).detectedTerms).toMatchObject({ role: "Synthetic local maintenance", salary: 1000, currency: "LKR", payPeriod: "monthly", responsibilities: "Synthetic local maintenance task" });
  });
  it("scores those detected terms 25 and does not claim employer verification", () => {
    const terms = Object.fromEntries(Object.entries(extractOfferTermsRuleBased(text).detectedTerms).map(([k, v]) => [k, String(v)]));
    const result = assessOfferTerms(terms);
    expect(result.score).toBe(25);
    expect(result.employerVerification).toBe("not_assessed");
  });
  it("says nothing is stated for an empty offer rather than inventing a score", () => {
    const result = assessOfferTerms({});
    expect(result.statedCount).toBe(0);
    expect(result.score).toBe(0);
  });
});
