import { bcp47, type LocaleCode } from "./index";

// Locale-aware formatting through the platform's Intl implementation. Nothing here invents data:
// invalid input yields an explicit "unknown" marker rather than a guess.
export function formatDate(locale: LocaleCode, value: string | Date, timeZone?: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try { return new Intl.DateTimeFormat(bcp47(locale), { year: "numeric", month: "long", day: "numeric", ...(timeZone ? { timeZone } : {}) }).format(date); }
  catch { return "—"; }
}
export function formatDateTime(locale: LocaleCode, value: string | Date, timeZone?: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try { return new Intl.DateTimeFormat(bcp47(locale), { dateStyle: "medium", timeStyle: "short", ...(timeZone ? { timeZone } : {}) }).format(date); }
  catch { return "—"; }
}
export function formatCurrency(locale: LocaleCode, amount: number, currency: string): string {
  if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(currency)) return "—";
  try { return new Intl.NumberFormat(bcp47(locale), { style: "currency", currency }).format(amount); }
  catch { return `${amount} ${currency}`; }
}
export function isValidTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}

// ---- Pay-period normalization (module 15/19) ---------------------------------------------------
// Converting between pay periods needs explicit assumptions, so they are inputs, never hidden:
// 52 weeks and 12 months per year. Hourly and daily pay additionally need the hours or days actually
// worked, which a document may not state; without them the result is null with a reason.
export type PayPeriod = "hourly" | "daily" | "weekly" | "monthly" | "yearly";
export type NormalizedPay = { monthly: number; assumptions: string[] } | { monthly: null; reason: string };
export function normalizeToMonthly(input: { amount: number; period: PayPeriod; hoursPerWeek?: number | null; daysPerWeek?: number | null }): NormalizedPay {
  const { amount, period } = input;
  if (!Number.isFinite(amount) || amount < 0) return { monthly: null, reason: "The amount is not a valid non-negative number." };
  const weeksPerMonth = 52 / 12;
  const assumptions = ["52 weeks and 12 months per year"];
  const round = (n: number) => Math.round(n * 100) / 100;
  switch (period) {
    case "monthly": return { monthly: round(amount), assumptions: [] };
    case "yearly": return { monthly: round(amount / 12), assumptions };
    case "weekly": return { monthly: round(amount * weeksPerMonth), assumptions };
    case "daily":
      if (!input.daysPerWeek || input.daysPerWeek <= 0 || input.daysPerWeek > 7) return { monthly: null, reason: "Daily pay needs the number of days worked per week." };
      return { monthly: round(amount * input.daysPerWeek * weeksPerMonth), assumptions: [...assumptions, `${input.daysPerWeek} working days per week`] };
    case "hourly":
      if (!input.hoursPerWeek || input.hoursPerWeek <= 0 || input.hoursPerWeek > 168) return { monthly: null, reason: "Hourly pay needs the hours worked per week." };
      return { monthly: round(amount * input.hoursPerWeek * weeksPerMonth), assumptions: [...assumptions, `${input.hoursPerWeek} working hours per week`] };
  }
}

// Currency-aware comparison without invented exchange rates: amounts in different currencies are
// only comparable when the caller supplies a dated, sourced rate.
export type RateInput = { from: string; to: string; rate: number; asOf: string; source: string };
export function compareMonthly(a: { monthly: number; currency: string }, b: { monthly: number; currency: string }, rate?: RateInput):
  { comparable: true; difference: number; currency: string; basis: string } | { comparable: false; reason: string } {
  if (a.currency === b.currency) return { comparable: true, difference: Math.round((a.monthly - b.monthly) * 100) / 100, currency: a.currency, basis: "same currency" };
  if (!rate) return { comparable: false, reason: `Amounts in ${a.currency} and ${b.currency} cannot be compared without a dated, sourced exchange rate. ORYQEN does not assume one.` };
  const valid = rate.rate > 0 && Number.isFinite(rate.rate) && !Number.isNaN(Date.parse(rate.asOf)) && rate.source.trim().length > 0 && ((rate.from === a.currency && rate.to === b.currency) || (rate.from === b.currency && rate.to === a.currency));
  if (!valid) return { comparable: false, reason: "The supplied exchange rate is incomplete or does not match these currencies." };
  const aInB = rate.from === a.currency ? a.monthly * rate.rate : a.monthly / rate.rate;
  return { comparable: true, difference: Math.round((aInB - b.monthly) * 100) / 100, currency: b.currency, basis: `${rate.from}/${rate.to} ${rate.rate} as of ${rate.asOf} (${rate.source})` };
}
