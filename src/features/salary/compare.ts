// Salary comparison from reference points THE PERSON supplies, each with its own source. ORYQEN holds no market salary dataset, so nothing here is a market rate. It describes the person's
// own list: how many points, their range and median, and where an offer falls. Different currencies are never mixed (no exchange rates are applied), and every result states how many
// points it rests on. Small or old or mixed lists are flagged instead of being presented as a benchmark.
export const periods = ["month", "year"] as const;
export const sourceTypes = ["job_ad", "own_research", "colleague", "survey", "sample"] as const;
export type Period = (typeof periods)[number];
export type SourceType = (typeof sourceTypes)[number];
export type ReferencePoint = { id: string; label: string; amount: number; currency: string; period: Period; role: string; country: string; sourceType: SourceType; sourceDate: string };

export const monthly = (amount: number, period: Period) => (period === "year" ? amount / 12 : amount);
const monthIndex = (value: string) => { const m = /^(\d{4})-(\d{2})/.exec(value); return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null; };
const median = (sorted: number[]) => { const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2; };

export type Summary = {
  currency: string; n: number; min: number; median: number; max: number;
  excludedOtherCurrency: number; stale: number; undated: number; mixedCountries: boolean; mixedRoles: boolean; fewPoints: boolean; samplePoints: number;
  bySource: Record<SourceType, number>;
};
export const MIN_POINTS = 5, STALE_MONTHS = 24;

// All amounts are per month in the chosen currency. Returns null when no point uses that currency.
export function summarize(points: readonly ReferencePoint[], currency: string, today: string): Summary | null {
  const cur = currency.trim().toUpperCase();
  const used = points.filter(point => point.currency.trim().toUpperCase() === cur && Number.isFinite(point.amount) && point.amount > 0);
  if (used.length === 0) return null;
  const values = used.map(point => monthly(point.amount, point.period)).sort((a, b) => a - b);
  const now = monthIndex(today) ?? 0;
  const bySource = Object.fromEntries(sourceTypes.map(type => [type, 0])) as Record<SourceType, number>;
  for (const point of used) bySource[point.sourceType] += 1;
  return {
    currency: cur, n: used.length, min: values[0]!, median: median(values), max: values[values.length - 1]!,
    excludedOtherCurrency: points.length - used.length,
    stale: used.filter(point => { const at = monthIndex(point.sourceDate); return at !== null && now - at > STALE_MONTHS; }).length,
    undated: used.filter(point => monthIndex(point.sourceDate) === null).length,
    mixedCountries: new Set(used.map(point => point.country.trim().toLowerCase()).filter(Boolean)).size > 1,
    mixedRoles: new Set(used.map(point => point.role.trim().toLowerCase()).filter(Boolean)).size > 1,
    fewPoints: used.length < MIN_POINTS, samplePoints: bySource.sample, bySource,
  };
}

export type Position = { where: "below" | "within" | "above"; shareAtOrBelow: number; differenceFromMedianPercent: number };
// Where an offer (per month, same currency) falls among the person's own points. shareAtOrBelow is the percentage of points at or below the offer.
export function positionOf(offerMonthly: number, points: readonly ReferencePoint[], currency: string): Position | null {
  const cur = currency.trim().toUpperCase();
  const values = points.filter(point => point.currency.trim().toUpperCase() === cur && point.amount > 0).map(point => monthly(point.amount, point.period)).sort((a, b) => a - b);
  if (values.length === 0 || !(offerMonthly > 0)) return null;
  const med = median(values);
  return {
    where: offerMonthly < values[0]! ? "below" : offerMonthly > values[values.length - 1]! ? "above" : "within",
    shareAtOrBelow: Math.round((100 * values.filter(value => value <= offerMonthly).length) / values.length),
    differenceFromMedianPercent: Math.round((100 * (offerMonthly - med)) / med),
  };
}
