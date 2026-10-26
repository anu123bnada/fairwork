import type { Opportunity, Preferences } from "./schema";
// `id` and `values` let a screen show the same explanation in another language from a catalog; `criterion` and `detail` stay the English
// wording that tests and non-translated callers use. A unit test pins the English catalog to this text.
export type MatchReason = { id: "role" | "location" | "workMode" | "pay" | "payUnknown"; criterion: string; outcome: "matches" | "differs" | "unknown"; detail: string; values: Record<string, string | number> };
export function explainMatch(item: Opportunity, preferences: Preferences | null) {
  const reasons: MatchReason[] = [];
  if (!preferences) return reasons;
  const fields = item.fields;
  for (const [id, criterion, wanted, actual] of [["role", "Role", preferences.role, fields.title], ["location", "Location", preferences.location, fields.location]] as const) {
    if (wanted) reasons.push({ id, criterion, outcome: actual.toLocaleLowerCase().includes(wanted.toLocaleLowerCase()) ? "matches" : "differs", detail: `Your preference: ${wanted}. Listing: ${actual}. Text match only.`, values: { wanted, actual } });
  }
  if (preferences.workMode) reasons.push({ id: "workMode", criterion: "Work arrangement", outcome: preferences.workMode === fields.workMode ? "matches" : "differs", detail: `Your preference: ${preferences.workMode}. Listing: ${fields.workMode}.`, values: { wanted: preferences.workMode, actual: fields.workMode } });
  if (preferences.minimumPay !== null) {
    const comparable = fields.salary !== null && preferences.currency === fields.currency && preferences.payPeriod === fields.payPeriod;
    reasons.push({
      id: comparable ? "pay" : "payUnknown", criterion: "Minimum stated pay", outcome: !comparable ? "unknown" : fields.salary! >= preferences.minimumPay ? "matches" : "differs",
      detail: comparable ? `Listing: ${fields.salary} ${fields.currency}/${fields.payPeriod}. Your minimum: ${preferences.minimumPay}. Confirm gross/net basis and deductions with the employer.` : "Missing amount or different currency/pay period. No conversion or pay equivalence assumed.",
      values: comparable ? { salary: fields.salary!, currency: fields.currency, period: fields.payPeriod, minimum: preferences.minimumPay } : {},
    });
  }
  return reasons;
}
