import type { Opportunity, Preferences } from "./schema";
export function explainMatch(item: Opportunity, preferences: Preferences | null) {
  const reasons: { criterion: string; outcome: "matches" | "differs" | "unknown"; detail: string }[] = [];
  if (!preferences) return reasons;
  const fields = item.fields;
  for (const [criterion, wanted, actual] of [["Role", preferences.role, fields.title], ["Location", preferences.location, fields.location]] as const) {
    if (wanted) reasons.push({ criterion, outcome: actual.toLocaleLowerCase().includes(wanted.toLocaleLowerCase()) ? "matches" : "differs", detail: `Your preference: ${wanted}. Listing: ${actual}. Text match only.` });
  }
  if (preferences.workMode) reasons.push({ criterion: "Work arrangement", outcome: preferences.workMode === fields.workMode ? "matches" : "differs", detail: `Your preference: ${preferences.workMode}. Listing: ${fields.workMode}.` });
  if (preferences.minimumPay !== null) {
    const comparable = fields.salary !== null && preferences.currency === fields.currency && preferences.payPeriod === fields.payPeriod;
    reasons.push({ criterion: "Minimum stated pay", outcome: !comparable ? "unknown" : fields.salary! >= preferences.minimumPay ? "matches" : "differs", detail: comparable ? `Listing: ${fields.salary} ${fields.currency}/${fields.payPeriod}. Your minimum: ${preferences.minimumPay}. Confirm gross/net basis and deductions with the employer.` : "Missing amount or different currency/pay period. No conversion or pay equivalence assumed." });
  }
  return reasons;
}
