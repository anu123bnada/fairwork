import { describe, expect, it } from "vitest";
import { buildOfferSummary } from "@/features/offer/summary";
import { translate, type LocaleCode, type MessageKey } from "@/i18n";

const tIn = (locale: LocaleCode) => (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
const input = { version: 3, termHash: "a".repeat(64), generatedAt: new Date("2026-10-28T10:00:00Z"), snapshot: { role: "Technician", salary: 80000, currency: "LKR", probation: "unpaid trial is required" }, unresolved: [{ field: "startDate", question: "When does the job start?" }] };
const label = (field: string) => field;

describe("offer summary", () => {
  it("lists the saved terms, open questions, checklist and limits, and never claims to be an agreement or verification", () => {
    const text = buildOfferSummary(input, tIn("en"), label);
    expect(text).toContain("# Offer summary");
    expect(text).toContain("Prepared on 2026-10-28 from saved revision 3");
    expect(text).toContain("- role: Technician"); expect(text).toContain("- salary: 80000");
    expect(text).toContain("- startDate: When does the job start?");
    expect(text).toMatch(/\d+\/100 — /);
    expect(text).toContain("Trial and probation: concern (0/5)");
    expect(text).toContain("not an agreement, a signature or a verification of the employer");
    expect(text).toContain("a".repeat(64));
  });
  it("is deterministic for the same input and handles an empty offer", () => {
    expect(buildOfferSummary(input, tIn("en"), label)).toBe(buildOfferSummary(input, tIn("en"), label));
    const empty = buildOfferSummary({ ...input, snapshot: {}, unresolved: [] }, tIn("en"), label);
    expect(empty).toContain("No terms are saved."); expect(empty).toContain("No open questions."); expect(empty).toContain("0/100");
  });
  it("is written in the chosen language, including the checklist, but keeps the person's own words untouched", () => {
    for (const locale of ["si", "ta", "de"] as const) {
      const text = buildOfferSummary(input, tIn(locale), label);
      expect(text).toContain(translate(locale, "sum.title")); expect(text).toContain(translate(locale, "as.i.salary.l"));
      expect(text).toContain("- role: Technician"); // the person's value is not translated
      expect(text).not.toContain("Clarity and protection checklist");
    }
  });
});
