import { describe, expect, it } from "vitest";
import { checkJurisdiction } from "@/features/jurisdiction/check";
import { GERMANY, JURISDICTIONS, SELECTABLE_COUNTRIES, jurisdictionFor, referenceAgeDays } from "@/features/jurisdiction/references";

const NOW = new Date("2026-10-26T00:00:00Z");
const check = (country: string, hoursPerWeek: number | null, daysPerWeek: number | null) => checkJurisdiction({ country, hoursPerWeek, daysPerWeek }, NOW);

describe("reference registry integrity", () => {
  it("only supported entries carry rules, and each rule has a primary-source URL, quote, dates and scope", () => {
    for (const entry of Object.values(JURISDICTIONS)) {
      if (entry.support !== "supported") { expect("rules" in entry).toBe(false); continue; }
      expect(entry.rules.length).toBeGreaterThan(0);
      for (const rule of entry.rules) {
        expect(rule.sourceUrl).toMatch(/^https:\/\/www\.gesetze-im-internet\.de\//);
        expect(rule.quote.length).toBeGreaterThan(40); expect(rule.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(rule.scope.length).toBeGreaterThan(20); expect(rule.validity.note.length).toBeGreaterThan(10);
        expect(["unofficial_consolidation", "official_text"]).toContain(rule.sourceStatus);
      }
    }
  });
  it("encodes exactly the figures in the quoted German text", () => {
    const [daily, breaks] = GERMANY.support === "supported" ? GERMANY.rules : [];
    expect(daily!.quote).toContain("acht Stunden nicht überschreiten"); expect(daily!.quote).toContain("bis zu zehn Stunden");
    expect(daily!.quote).toContain("sechs Kalendermonaten"); expect(daily!.quote).toContain("24 Wochen");
    expect(daily!.parameters).toEqual({ maxDailyHours: 8, extendedMaxDailyHours: 10, averagingMonths: 6, averagingWeeks: 24 });
    expect(breaks!.quote).toContain("mindestens 30 Minuten"); expect(breaks!.quote).toContain("45 Minuten"); expect(breaks!.quote).toContain("mehr als neun Stunden");
    expect(breaks!.parameters).toMatchObject({ breakMinutesOver6h: 30, breakMinutesOver9h: 45, minBlockMinutes: 15, maxHoursWithoutBreak: 6 });
  });
  it("lists Sri Lanka as unavailable with the reason and official pointers, and never invents thresholds", () => {
    const lk = jurisdictionFor("LK");
    expect(lk.support).toBe("source_unavailable");
    expect(JSON.stringify(lk)).not.toMatch(/\b(8|45|48)\s*hours?\b/i);
    expect(lk.support === "source_unavailable" && lk.whereToCheck.every(link => link.url.startsWith("https://"))).toBe(true);
    for (const { code } of SELECTABLE_COUNTRIES) expect(jurisdictionFor(code).support === "supported" ? "rules" : "reason").toBeTruthy();
  });
  it("tracks reference age for re-verification", () => {
    expect(referenceAgeDays({ retrievedOn: "2026-10-26" }, NOW)).toBe(0);
    expect(referenceAgeDays({ retrievedOn: "2026-01-01" }, NOW)).toBe(298);
  });
});

describe("working-time check", () => {
  it("asks for the missing figures instead of assuming them", () => {
    for (const [h, d] of [[null, null], [40, null], [null, 5], [0, 5], [200, 5], [40, 0], [40, 8], [40, 2.5]] as const) {
      const result = check("DE", h, d);
      expect(result.support).toBe("supported");
      if (result.support === "supported") expect(result.findings.map(f => f.id)).toEqual(["need-hours-days"]);
    }
  });
  it("classifies daily averages against the cited limits at the boundaries", () => {
    const ids = (h: number, d: number) => { const r = check("DE", h, d); return r.support === "supported" ? r.findings.map(f => f.id) : []; };
    expect(ids(40, 5)).toEqual(["daily-within", "break-required"]);           // 8.0 h
    expect(ids(41, 5)).toEqual(["daily-needs-averaging", "break-required"]);  // 8.2 h
    expect(ids(50, 5)).toEqual(["daily-needs-averaging", "break-required"]);  // 10.0 h is not above the extended maximum
    expect(ids(51, 5)).toEqual(["daily-over-extended", "break-required"]);    // 10.2 h
    expect(ids(30, 6)).toEqual(["daily-within", "break-not-triggered"]);      // 5.0 h
  });
  it("derives the break minimum from the cited text and always attaches the rule and its source", () => {
    const text = (h: number, d: number) => { const r = check("DE", h, d); return r.support === "supported" ? r.findings : []; };
    expect(text(40, 5).find(f => f.id === "break-required")!.title).toContain("at least 30 minutes");
    expect(text(45, 5).find(f => f.id === "break-required")!.title).toContain("at least 30 minutes"); // exactly 9 h is not "more than nine"
    expect(text(50, 5).find(f => f.id === "break-required")!.title).toContain("at least 45 minutes"); // 10 h/day
    expect(text(60, 5).find(f => f.id === "break-required")!.title).toContain("at least 45 minutes"); // 12 h/day
    for (const f of text(40, 5)) expect(f.rule?.sourceUrl).toMatch(/^https:\/\/www\.gesetze-im-internet\.de\/arbzg\//);
    expect(JSON.stringify(text(60, 5))).not.toMatch(/illegal|unlawful|violat|broke the law|fraud/i);
  });
  it("returns a limitation, not a verdict, for unsupported countries, and flags stale references", () => {
    const lk = check("LK", 45, 6);
    expect(lk).toMatchObject({ support: "source_unavailable", country: "LK" });
    expect("findings" in lk).toBe(false);
    expect(check("ZZ", 40, 5)).toMatchObject({ support: "source_unavailable" });
    const later = checkJurisdiction({ country: "DE", hoursPerWeek: 40, daysPerWeek: 5 }, new Date("2027-06-01T00:00:00Z"));
    expect(later.support === "supported" && later.stale).toBe(true);
    expect(check("DE", 40, 5).support === "supported" && (check("DE", 40, 5) as { stale: boolean }).stale).toBe(false);
  });
});
