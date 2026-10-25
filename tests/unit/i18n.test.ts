import { describe, expect, it } from "vitest";
import { coverage, isLocale, LOCALES, translate, untranslatedKeys } from "@/i18n";
import { en } from "@/i18n/messages";
import { compareMonthly, formatCurrency, formatDate, formatDateTime, isValidTimeZone, normalizeToMonthly } from "@/i18n/format";

describe("message catalog", () => {
  it("falls back to English for a missing key and never shows the key", () => {
    expect(translate("en", "nav.home")).toBe("Home");
    expect(translate("si", "nav.home")).toBe("මුල් පිටුව");
    expect(translate("de", "nav.check")).toBe("Prüfen");
    // Simulate an untranslated key by borrowing a locale that lacks nothing: use the helper below.
    for (const locale of LOCALES) for (const key of untranslatedKeys(locale.code)) expect(translate(locale.code, key)).toBe(en[key]);
  });
  it("interpolates variables and leaves unknown placeholders visible rather than inventing text", () => {
    expect(translate("en", "language.selected", { language: "Sinhala" })).toContain("Sinhala selected.");
    expect(translate("en", "language.selected")).toContain("{language}");
  });
  it("reports coverage computed from the catalog, and every non-English locale keeps placeholders intact", () => {
    expect(coverage("en")).toMatchObject({ percent: 100 });
    for (const code of ["si", "ta", "de"] as const) {
      const stats = coverage(code);
      expect(stats.total).toBe(Object.keys(en).length); expect(stats.percent).toBeLessThanOrEqual(100);
      expect(stats.translated + untranslatedKeys(code).length).toBe(stats.total);
      expect(translate(code, "language.selected", { language: "X" })).not.toContain("{language}");
    }
  });
  it("identifies supported locales and rejects everything else", () => {
    expect(LOCALES.map(l => l.code)).toEqual(["en", "si", "ta", "de"]);
    for (const bad of ["fr", "", null, undefined, "EN", "en-US", {}]) expect(isLocale(bad)).toBe(false);
  });
  it("keeps Sinhala and Tamil strings in their own scripts, not Latin placeholders", () => {
    expect(translate("si", "settings.title")).toMatch(/[඀-෿]/);
    expect(translate("ta", "settings.title")).toMatch(/[஀-௿]/);
  });
});

describe("locale-aware formatting", () => {
  it("formats dates, times and currencies per locale and rejects invalid input", () => {
    const date = "2026-10-26T12:00:00Z";
    expect(formatDate("en", date, "UTC")).toBe("October 26, 2026");
    expect(formatDate("de", date, "UTC")).toBe("26. Oktober 2026");
    expect(formatDateTime("en", date, "Asia/Colombo")).toMatch(/5:30\s?PM/);
    expect(formatDate("en", "not a date")).toBe("—");
    expect(formatCurrency("en", 90000, "LKR")).toMatch(/LKR|Rs/); expect(formatCurrency("de", 1234.5, "EUR")).toContain("1.234,50");
    expect(formatCurrency("en", Number.NaN, "LKR")).toBe("—"); expect(formatCurrency("en", 5, "lkr")).toBe("—");
    expect(isValidTimeZone("Asia/Colombo")).toBe(true); expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});

describe("pay-period normalization", () => {
  it("converts with stated assumptions and refuses when a required input is missing", () => {
    expect(normalizeToMonthly({ amount: 120000, period: "yearly" })).toEqual({ monthly: 10000, assumptions: ["52 weeks and 12 months per year"] });
    expect(normalizeToMonthly({ amount: 90000, period: "monthly" })).toEqual({ monthly: 90000, assumptions: [] });
    expect(normalizeToMonthly({ amount: 1000, period: "weekly" })).toMatchObject({ monthly: 4333.33 });
    expect(normalizeToMonthly({ amount: 500, period: "hourly", hoursPerWeek: 40 })).toMatchObject({ monthly: 86666.67, assumptions: expect.arrayContaining(["40 working hours per week"]) });
    expect(normalizeToMonthly({ amount: 500, period: "daily", daysPerWeek: 5 })).toMatchObject({ monthly: 10833.33 });
    for (const input of [{ amount: 500, period: "hourly" as const }, { amount: 500, period: "hourly" as const, hoursPerWeek: 500 }, { amount: 500, period: "daily" as const, daysPerWeek: 9 }, { amount: -1, period: "monthly" as const }, { amount: Number.NaN, period: "yearly" as const }])
      expect(normalizeToMonthly(input)).toMatchObject({ monthly: null, reason: expect.any(String) });
  });
  it("compares only same-currency amounts, or with a complete dated sourced rate; never invents one", () => {
    expect(compareMonthly({ monthly: 100, currency: "LKR" }, { monthly: 80, currency: "LKR" })).toMatchObject({ comparable: true, difference: 20 });
    expect(compareMonthly({ monthly: 100, currency: "LKR" }, { monthly: 80, currency: "USD" })).toMatchObject({ comparable: false, reason: expect.stringContaining("does not assume one") });
    const rate = { from: "USD", to: "LKR", rate: 300, asOf: "2026-10-01", source: "test fixture" };
    expect(compareMonthly({ monthly: 1000, currency: "LKR" }, { monthly: 2, currency: "USD" }, rate)).toMatchObject({ comparable: true, difference: 1.33, currency: "USD" });
    for (const bad of [{ ...rate, rate: 0 }, { ...rate, asOf: "nope" }, { ...rate, source: " " }, { ...rate, from: "EUR" }]) expect(compareMonthly({ monthly: 1, currency: "LKR" }, { monthly: 1, currency: "USD" }, bad)).toMatchObject({ comparable: false });
  });
});
