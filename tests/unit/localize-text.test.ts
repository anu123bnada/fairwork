import { describe, expect, it } from "vitest";
import { assessOfferTerms } from "@/features/offer/assessment";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { CRITERIA, QUESTION_IDS, WARNING_IDS, localizeAssessment, localizeQuestion, localizeWarning } from "@/features/offer/localize-text";
import { translate, type LocaleCode, type MessageKey } from "@/i18n";

const tIn = (locale: LocaleCode) => (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
const sample = [
  "Role: Technician. Salary LKR 90000 monthly. Unpaid trial for 30 days. Pay a security deposit. Hold passport. Unpaid overtime.",
  "Send the fee via gift card to secure your place before you start. Guaranteed visa abroad. Message us on WhatsApp only. Share your OTP. Reply now, urgent. Earn $500 per day, no experience.",
  "Contact recruiter@gmail.com for the Acme Tools role.",
].join("\n");

describe("localized rule text", () => {
  it("English catalog equals the engine wording exactly, for every criterion, status and rule", () => {
    const empty = assessOfferTerms({});
    expect(localizeAssessment(empty, tIn("en"))).toEqual(empty); // all 20 criteria missing
    const mixed = assessOfferTerms({ salary: "abc", currency: "LKR", role: "Tech", overtime: "unpaid overtime is mandatory", probation: "unpaid trial is required", documentRetention: "you must surrender your passport", deductions: "all losses will be deducted from your salary", trainingDeposit: "you must pay a training fee" });
    expect(localizeAssessment(mixed, tIn("en"))).toEqual(mixed); // stated, uncertain and concern explanations
    expect(new Set(mixed.items.map(item => item.status)).size).toBeGreaterThanOrEqual(3);
    const { data } = extractOfferTermsRuleBased(sample);
    for (const sign of data.warningSigns) expect(localizeWarning(sign, tIn("en"))).toEqual(sign);
    for (const question of data.followUpQuestions) expect(localizeQuestion(question, tIn("en"))).toEqual(question);
    expect(translate("en", "ra.notice")).toBe(data.companyClaimNotice);
  });

  it("covers every id the engines can produce in every non-English language", () => {
    const empty = assessOfferTerms({});
    expect(empty.items.map(item => item.id).sort()).toEqual([...CRITERIA].sort());
    for (const locale of ["si", "ta", "de"] as const) {
      const t = tIn(locale);
      const localized = localizeAssessment(empty, t);
      localized.items.forEach((item, index) => {
        expect(item.label, `${locale} ${item.id} label`).not.toBe(empty.items[index]!.label);
        expect(item.recommendation, `${locale} ${item.id} question`).not.toBe(empty.items[index]!.recommendation);
      });
      expect(localized.meaning).not.toBe(empty.meaning); expect(localized.limitations).not.toBe(empty.limitations);
      for (const id of WARNING_IDS) for (const part of ["t", "d", "r"]) expect(translate(locale, `ra.w.${id}.${part}` as MessageKey), `${locale} ${id}.${part}`).not.toBe(translate("en", `ra.w.${id}.${part}` as MessageKey));
      for (const id of QUESTION_IDS) expect(translate(locale, `ra.q.${id}` as MessageKey)).not.toBe(translate("en", `ra.q.${id}` as MessageKey));
    }
  });

  it("covers every warning sign the engines produce for real offer text", () => {
    const { data } = extractOfferTermsRuleBased(sample);
    const known = new Set<string>(WARNING_IDS);
    expect(data.warningSigns.length).toBeGreaterThanOrEqual(8);
    for (const sign of data.warningSigns) expect(known.has(sign.id), `${sign.id} has no catalog entry`).toBe(true);
  });

  it("leaves anything without an entry exactly as the engine wrote it", () => {
    const odd = { id: "scam-lookalike-domain", title: "Email domain looks like the company's but is different", description: "The address uses acrne.com", recommendation: "Ask." };
    expect(localizeWarning(odd, tIn("si"))).toEqual(odd);
    const question = { id: "q-custom", question: "A custom question" };
    expect(localizeQuestion(question, tIn("de"))).toEqual(question);
  });
});
