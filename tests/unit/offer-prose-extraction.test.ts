import { describe, expect, it } from "vitest";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { assessOfferTerms } from "@/features/offer/assessment";

const score = (text: string) => { const { detectedTerms } = extractOfferTermsRuleBased(text); return { detectedTerms, assessment: assessOfferTerms(detectedTerms) }; };

describe("unlabeled prose extraction is input-dependent and verbatim", () => {
  const fair = "Position: Garden Designer. Salary LKR 95,000 per month paid on the 28th by bank transfer. 40 hours per week, Monday to Friday. 14 days annual leave. 30 days notice for termination. 3 month probation.";
  const risky = "Pay is TBD. You must pay a registration fee of LKR 25,000 before starting. Unpaid overtime is mandatory. You must surrender your passport until the contract ends.";

  it("copies stated clauses and scores them", () => {
    const { detectedTerms, assessment } = score(fair);
    expect(detectedTerms.leave).toBe("14 days annual leave");
    expect(detectedTerms.notice).toBe("30 days notice for termination");
    expect(assessment.concernCount).toBe(0);
    expect(assessment.score).toBeGreaterThan(score("Position: Garden Designer.").assessment.score);
  });

  it("flags explicit affirmative obligations from prose and changes with the input", () => {
    const { assessment } = score(risky);
    const concerns = assessment.items.filter(i => i.status === "concern").map(i => i.id).sort();
    expect(concerns).toEqual(["documentRetention", "overtime", "trainingDeposit"]);
    expect(score(risky.replace("registration fee", "friendly chat")).assessment.items.find(i => i.id === "trainingDeposit")?.status).not.toBe("concern");
  });

  it("does not guess when two sentences mention the same topic", () => {
    expect(score("Annual leave is 14 days. Sick leave is 7 days.").detectedTerms.leave).toBeUndefined();
  });
});
