import { describe, expect, it } from "vitest";
import { scamIndicators } from "@/features/scam/check";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";

const ids = (text: string, companyDomain?: string) => scamIndicators(text, { companyDomain }).map(item => item.id);

describe("recruiter scam indicators", () => {
  it("flags unusual payment methods, pay-to-start and guaranteed-visa wording with the exact quote", () => {
    expect(ids("Please buy iTunes gift cards and send the codes.")).toContain("scam-gift-card-crypto");
    expect(ids("You must pay LKR 15,000 to secure your place before you start.")).toContain("scam-pay-to-start");
    expect(ids("We offer guaranteed visa and job in Dubai.")).toContain("scam-guaranteed-abroad");
    const quote = scamIndicators("Send your bank PIN to confirm your salary account.")[0];
    expect(quote?.id).toBe("scam-sensitive-data-early");
    expect("Send your bank PIN to confirm your salary account.".toLowerCase()).toContain(quote!.quote.toLowerCase());
  });

  it("flags a free email address for a company role, but not a personal message", () => {
    expect(ids("Our HR department invites you. Email hr.acme.jobs@gmail.com")).toContain("scam-free-mail-company");
    expect(ids("Call me back. My email is sam@gmail.com")).not.toContain("scam-free-mail-company");
  });

  it("compares email domains with the company's domain, catching look-alikes without accusing agencies", () => {
    expect(ids("Apply to careers@acrne.com", "acme.com")).toContain("scam-lookalike-domain");
    expect(ids("Apply to careers@acme.co.uk", "acme.co.uk")).toEqual([]);
    expect(ids("Apply to jobs@staffing-partners.com", "acme.com")).toEqual(["scam-domain-mismatch"]);
    expect(ids("Apply to careers@jobs.acme.com", "https://www.acme.com/careers")).toEqual([]);
    expect(ids("Write to someone@gmail.com", "acme.com")).not.toContain("scam-domain-mismatch");
  });

  it("stays quiet on an ordinary offer and never states a verdict", () => {
    const text = "Offer: Maintenance technician, LKR 120,000 monthly, 40 hours per week. Please confirm by 30 November. Contact hr@acme.com.";
    expect(scamIndicators(text, { companyDomain: "acme.com" })).toEqual([]);
    const all = scamIndicators("Pay a fee to secure your guaranteed visa. WhatsApp only. Reply within 24 hours.").map(item => `${item.title} ${item.description}`).join(" ");
    expect(all).not.toMatch(/\b(?:is a scam|fraudster|is fraudulent|safe)\b/i);
  });

  it("appears in the offer analysis warning signs with valid shape", () => {
    const result = extractOfferTermsRuleBased("Role: cleaner. Salary LKR 50000 monthly. Pay a fee to secure your job before you start. Guaranteed job abroad.");
    const scam = result.data.warningSigns.filter(sign => sign.id.startsWith("scam-"));
    expect(scam.length).toBeGreaterThanOrEqual(2);
    for (const sign of scam) { expect(sign.description.length).toBeLessThanOrEqual(500); expect(sign.quote?.length ?? 0).toBeLessThanOrEqual(1500); }
    expect(result.data.warningSigns.length).toBeLessThanOrEqual(12);
  });
});
