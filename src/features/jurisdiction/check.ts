import { jurisdictionFor, referenceAgeDays, REFERENCE_STALE_AFTER_DAYS, type RuleReference } from "./references";

export type CheckFinding = {
  id: string;
  kind: "within" | "exceeds" | "needs_info" | "info";
  title: string;
  detail: string;
  rule: RuleReference | null;
};
export type JurisdictionCheck =
  | { support: "supported"; country: string; name: string; findings: CheckFinding[]; references: CheckFinding[]; limitations: string[]; stale: boolean }
  | { support: "source_unavailable"; country: string; name: string; reason: string; whereToCheck: { title: string; url: string }[] };

// Compares figures the user already has with a cited rule. It reports what a rule says about those
// figures; it never concludes that an employer broke the law and never fills in missing figures.
export function checkJurisdiction(input: { country: string; hoursPerWeek: number | null; daysPerWeek: number | null }, now: Date): JurisdictionCheck {
  const entry = jurisdictionFor(input.country);
  if (entry.support !== "supported") return { support: "source_unavailable", country: entry.country, name: entry.name, reason: entry.reason, whereToCheck: entry.whereToCheck };
  const rule = (id: string) => entry.rules.find(r => r.id === id)!;
  const daily = rule("de-arbzg-3"), breaks = rule("de-arbzg-4");
  const findings: CheckFinding[] = [];
  const { hoursPerWeek, daysPerWeek } = input;
  const validHours = hoursPerWeek !== null && Number.isFinite(hoursPerWeek) && hoursPerWeek > 0 && hoursPerWeek <= 168;
  const validDays = daysPerWeek !== null && Number.isInteger(daysPerWeek) && daysPerWeek >= 1 && daysPerWeek <= 7;
  if (!validHours || !validDays) {
    findings.push({ id: "need-hours-days", kind: "needs_info", title: "More information is needed", detail: "Enter the weekly hours and the number of working days per week to compare them with the daily limits. ORYQEN does not assume either.", rule: null });
  } else {
    const perDay = Math.round((hoursPerWeek / daysPerWeek) * 100) / 100;
    const p = daily.parameters;
    if (perDay > p.extendedMaxDailyHours!) findings.push({ id: "daily-over-extended", kind: "exceeds", title: `About ${perDay} hours a day is above the ${p.extendedMaxDailyHours}-hour extended maximum`, detail: `${hoursPerWeek} hours over ${daysPerWeek} days averages ${perDay} hours a day. The cited rule allows more than ${p.maxDailyHours} hours only up to ${p.extendedMaxDailyHours}, and only with averaging. Ask the employer how the schedule complies.`, rule: daily });
    else if (perDay > p.maxDailyHours!) findings.push({ id: "daily-needs-averaging", kind: "needs_info", title: `About ${perDay} hours a day is above ${p.maxDailyHours}`, detail: `The cited rule allows up to ${p.extendedMaxDailyHours} hours a day only if the average over ${p.averagingMonths} months or ${p.averagingWeeks} weeks stays at ${p.maxDailyHours} hours per working day. Ask whether and how the offer meets that condition.`, rule: daily });
    else findings.push({ id: "daily-within", kind: "within", title: `About ${perDay} hours a day is within the ${p.maxDailyHours}-hour daily limit`, detail: "This compares an even daily average with one rule only. Actual shifts, overtime and exceptions can differ.", rule: daily });
    const b = breaks.parameters;
    const required = perDay > 9 ? b.breakMinutesOver9h! : perDay > 6 ? b.breakMinutesOver6h! : 0;
    findings.push(required > 0
      ? { id: "break-required", kind: "info", title: `A daily average of ${perDay} hours calls for breaks of at least ${required} minutes in total`, detail: `The cited rule requires pre-arranged breaks of at least ${b.breakMinutesOver6h} minutes for more than 6 to 9 hours and ${b.breakMinutesOver9h} minutes above 9 hours. Check that the offer states breaks.`, rule: breaks }
      : { id: "break-not-triggered", kind: "info", title: "The break minimums apply above 6 hours a day", detail: "At this daily average the cited minimum-break rule is not triggered, though the 6-hours-in-a-row limit still applies to any single stretch.", rule: breaks });
  }
  // Cited rules that need no figure from the offer. They are shown as references, never as findings about the employer.
  const references: CheckFinding[] = [];
  const restRule = rule("de-arbzg-5"), leaveRule = rule("de-burlg-3"), noticeRule = rule("de-bgb-622");
  references.push({ id: "rest-period", kind: "info", title: `The cited rule requires at least ${restRule.parameters.minRestHours} hours of uninterrupted rest after the working day`, detail: "Compare with the rota or shift pattern in the offer. This check cannot see the shifts, so it does not say whether they comply.", rule: restRule });
  const validDaysForLeave = validDays ? (daysPerWeek as number) : null;
  const werktage = leaveRule.parameters.minLeaveWerktage!, basis = leaveRule.parameters.werktageBasisDaysPerWeek!;
  references.push({
    id: "annual-leave", kind: "info",
    title: `The cited rule sets a statutory minimum of ${werktage} Werktage of annual leave`,
    detail: validDaysForLeave === null
      ? `Werktage count Monday to Saturday, so ${werktage} Werktage are four weeks of a ${basis}-day week. Enter the working days per week to see the same four weeks in your pattern. A contract can give more, never less.`
      : `Werktage count Monday to Saturday, so ${werktage} Werktage are four weeks of a ${basis}-day week. For ${validDaysForLeave} working days a week that is ${Math.round((werktage / basis) * validDaysForLeave * 10) / 10} days (ORYQEN's own arithmetic: ${werktage} ÷ ${basis} × ${validDaysForLeave}, not a statement in the source). A contract can give more, never less.`,
    rule: leaveRule,
  });
  references.push({ id: "notice-period", kind: "info", title: "The cited rule sets statutory notice periods", detail: "The basic notice period is four weeks to the 15th or the end of a calendar month; when the employer gives notice, the period grows after 2, 5, 8, 10, 12, 15 and 20 years of service. Probation, small employers and contract terms can differ; check the notice clause in the offer.", rule: noticeRule });
  const stale = [daily, breaks, restRule, leaveRule, noticeRule].some(r => referenceAgeDays(r, now) > REFERENCE_STALE_AFTER_DAYS);
  return { support: "supported", country: entry.country, name: entry.name, findings, references, limitations: entry.limitations, stale };
}
