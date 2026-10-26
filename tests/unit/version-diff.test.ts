import { describe, expect, it } from "vitest";
import { changedTerms, diffTerms } from "@/features/offer/version-diff";
import { translate, type LocaleCode } from "@/i18n";

describe("agreement version comparison", () => {
  it("reports changed, added, removed and unchanged terms, sorted by field", () => {
    const rows = diffTerms({ salary: 80000, role: "Technician", notice: "30 days", probation: "3 months" }, { salary: 90000, role: "Technician", notice: "30 days", overtime: "1.5x" });
    expect(rows.map(row => [row.field, row.change])).toEqual([["notice", "same"], ["overtime", "added"], ["probation", "removed"], ["role", "same"], ["salary", "changed"]]);
    expect(rows.find(row => row.field === "salary")).toMatchObject({ before: 80000, after: 90000 });
    expect(changedTerms(rows).map(row => row.field)).toEqual(["overtime", "probation", "salary"]);
  });
  it("treats an open question as different from a value and equal numbers and strings as the same", () => {
    expect(diffTerms({ a: null }, { a: "x" })[0]?.change).toBe("changed");
    expect(diffTerms({ a: null }, { a: null })[0]?.change).toBe("same");
    expect(diffTerms({ a: "null" }, { a: null })[0]?.change).toBe("changed");
    expect(diffTerms({ a: 5 }, { a: "5" })[0]?.change).toBe("same");
  });
  it("handles empty versions and does not mutate its input", () => {
    expect(diffTerms({}, {})).toEqual([]);
    const before = { a: 1 }; diffTerms(before, { a: 2 }); expect(before).toEqual({ a: 1 });
  });
  it("has wording for every change kind in every language", () => {
    for (const kind of ["same", "changed", "added", "removed"]) {
      const english = translate("en", `agc.c.${kind}` as never);
      for (const locale of ["si", "ta", "de"] as LocaleCode[]) expect(translate(locale, `agc.c.${kind}` as never)).not.toBe(english);
    }
  });
});
