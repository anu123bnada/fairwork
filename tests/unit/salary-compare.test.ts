import { describe, expect, it } from "vitest";
import { MIN_POINTS, monthly, positionOf, summarize, type ReferencePoint } from "@/features/salary/compare";

let n = 0;
const point = (amount: number, over: Partial<ReferencePoint> = {}): ReferencePoint => ({ id: `p${++n}`, label: "Job ad", amount, currency: "LKR", period: "month", role: "Welder", country: "LK", sourceType: "job_ad", sourceDate: "2026-09", ...over });
const today = "2026-11-10";

describe("salary comparison from the person's own reference points", () => {
  it("normalizes yearly amounts to monthly", () => {
    expect(monthly(120000, "year")).toBe(10000);
    expect(monthly(50000, "month")).toBe(50000);
  });
  it("summarizes count, range and median per currency and never mixes currencies", () => {
    const points = [point(40000), point(50000), point(60000), point(70000), point(480000, { period: "year" }), point(900, { currency: "USD" })];
    const summary = summarize(points, "lkr", today)!;
    expect(summary).toMatchObject({ currency: "LKR", n: 5, min: 40000, median: 50000, max: 70000, excludedOtherCurrency: 1, fewPoints: false });
    expect(summarize(points, "USD", today)).toMatchObject({ n: 1, median: 900, fewPoints: true });
    expect(summarize(points, "EUR", today)).toBeNull();
  });
  it("flags small, old, undated, mixed and sample lists instead of calling them a benchmark", () => {
    const summary = summarize([point(40000), point(52000, { sourceDate: "2022-01", country: "IN", role: "Fitter" }), point(60000, { sourceDate: "", sourceType: "sample" })], "LKR", today)!;
    expect(summary).toMatchObject({ n: 3, fewPoints: true, stale: 1, undated: 1, mixedCountries: true, mixedRoles: true, samplePoints: 1 });
    expect(MIN_POINTS).toBe(5);
    expect(summary.bySource).toMatchObject({ job_ad: 2, sample: 1, own_research: 0 });
  });
  it("places an offer below, within or above the person's own range and reports the share at or below", () => {
    const points = [40000, 50000, 60000, 70000].map(value => point(value));
    expect(positionOf(35000, points, "LKR")).toEqual({ where: "below", shareAtOrBelow: 0, differenceFromMedianPercent: -36 });
    expect(positionOf(60000, points, "LKR")).toMatchObject({ where: "within", shareAtOrBelow: 75, differenceFromMedianPercent: 9 });
    expect(positionOf(90000, points, "LKR")).toMatchObject({ where: "above", shareAtOrBelow: 100 });
    expect(positionOf(60000, points, "USD")).toBeNull();
    expect(positionOf(0, points, "LKR")).toBeNull();
    expect(positionOf(Number.NaN, points, "LKR")).toBeNull();
  });
  it("ignores non-positive or non-finite amounts", () => {
    expect(summarize([point(0), point(-5), point(Number.NaN)], "LKR", today)).toBeNull();
  });
});
