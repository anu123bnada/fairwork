import { describe, expect, it } from "vitest";
import { interviewKeys, negotiationQuestionKeys } from "@/features/offer/preparation";
import { assessOfferTerms } from "@/features/offer/assessment";
import { translate, type LocaleCode, type MessageKey } from "@/i18n";

describe("interview and negotiation preparation", () => {
  it("asks about every checklist point of an empty offer, one question each, and nothing for a point that is stated", () => {
    const all = assessOfferTerms({}).items.map(item => item.id);
    expect(negotiationQuestionKeys({})).toHaveLength(all.length);
    const stated = assessOfferTerms({ role: "Technician", salary: 80000, currency: "LKR" }).items.filter(item => item.status === "stated").map(item => `prep.q.${item.id}`);
    expect(stated.length).toBeGreaterThan(0);
    const keys = negotiationQuestionKeys({ role: "Technician", salary: 80000, currency: "LKR" });
    for (const key of stated) expect(keys).not.toContain(key);
  });
  it("puts concerns before unclear points before missing ones", () => {
    const items = assessOfferTerms({ probation: "unpaid trial is required" }).items;
    expect(items.find(item => item.id === "probation")?.status).toBe("concern");
    const keys = negotiationQuestionKeys({ probation: "unpaid trial is required" });
    expect(keys[0]).toBe("prep.q.probation");
  });
  it("is deterministic and has wording in every language for every checklist point and the interview list", () => {
    expect(negotiationQuestionKeys({})).toEqual(negotiationQuestionKeys({}));
    const keys: MessageKey[] = [...assessOfferTerms({}).items.map(item => `prep.q.${item.id}` as MessageKey), ...interviewKeys];
    for (const key of keys) {
      const english = translate("en", key);
      expect(english, key).not.toBe(key);
      for (const locale of ["si", "ta", "de"] as LocaleCode[]) { const text = translate(locale, key); expect(text.length, `${locale} ${key}`).toBeGreaterThan(0); expect(text, `${locale} ${key} still English`).not.toBe(english); }
    }
  });
});
