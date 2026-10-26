"use client";
import { useState } from "react";
import { compareMonthly, formatCurrency, normalizeToMonthly, type PayPeriod } from "@/i18n/format";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";

const PERIODS: { value: PayPeriod; key: MessageKey }[] = [
  { value: "hourly", key: "pay.hourly" }, { value: "daily", key: "pay.daily" }, { value: "weekly", key: "pay.weekly" }, { value: "monthly", key: "pay.monthly" }, { value: "yearly", key: "pay.yearly" },
];
const CURRENCIES = ["LKR", "EUR", "USD", "GBP", "INR", "AUD", "SGD", "AED"];
type Side = { amount: string; currency: string; period: PayPeriod; hours: string; days: string };
const blank = (): Side => ({ amount: "", currency: "LKR", period: "monthly", hours: "", days: "" });
const num = (value: string) => value.trim() === "" ? null : Number(value);

function Pay({ title, value, onChange }: { title: string; value: Side; onChange: (next: Side) => void }) {
  const { t } = useI18n();
  const set = (patch: Partial<Side>) => onChange({ ...value, ...patch });
  return <fieldset className="fw-field"><legend>{title}</legend>
    <label className="fw-field">{t("pay.amount")}<input inputMode="decimal" value={value.amount} onChange={event => set({ amount: event.target.value.replace(/[^0-9.]/g, "") })} /></label>
    <label className="fw-field">{t("pay.currency")}<select value={value.currency} onChange={event => set({ currency: event.target.value })}>{CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
    <label className="fw-field">{t("pay.period")}<select value={value.period} onChange={event => set({ period: event.target.value as PayPeriod })}>{PERIODS.map(item => <option key={item.value} value={item.value}>{t(item.key)}</option>)}</select></label>
    <label className="fw-field">{t("pay.hours")}<input inputMode="decimal" value={value.hours} onChange={event => set({ hours: event.target.value.replace(/[^0-9.]/g, "") })} /></label>
    <label className="fw-field">{t("pay.days")}<input inputMode="numeric" maxLength={1} value={value.days} onChange={event => set({ days: event.target.value.replace(/[^1-7]/g, "") })} /></label>
  </fieldset>;
}

// Converts pay to a comparable monthly figure with every assumption shown, and compares two offers only in the same
// currency, or with an exchange rate the person supplies together with its date and source. ORYQEN never assumes a rate.
export function PayCompare() {
  const { t, locale } = useI18n();
  const [a, setA] = useState<Side>(blank()), [b, setB] = useState<Side>(blank());
  const [rate, setRate] = useState(""), [asOf, setAsOf] = useState(""), [source, setSource] = useState("");
  const norm = (side: Side) => side.amount.trim() === "" ? null : normalizeToMonthly({ amount: Number(side.amount), period: side.period, hoursPerWeek: num(side.hours), daysPerWeek: num(side.days) });
  const na = norm(a), nb = norm(b);
  const sameCurrency = a.currency === b.currency;
  const comparison = na && nb && na.monthly !== null && nb.monthly !== null
    ? compareMonthly({ monthly: na.monthly, currency: a.currency }, { monthly: nb.monthly, currency: b.currency }, sameCurrency || !rate ? undefined : { from: a.currency, to: b.currency, rate: Number(rate), asOf, source })
    : null;
  const line = (label: string, n: ReturnType<typeof norm>, currency: string) => n === null ? null : n.monthly === null
    ? <p role="note">{label}: {n.reason}</p>
    : <p>{label}: <strong>{formatCurrency(locale, n.monthly, currency)}</strong> {t("pay.perMonth")}{n.assumptions.length > 0 && <small> · {t("pay.assumes")} {n.assumptions.join("; ")}</small>}</p>;
  return <section className="fw-list-card" aria-label={t("pay.title")}>
    <h3>{t("pay.title")}</h3>
    <p>{t("pay.intro")}</p>
    <Pay title={t("pay.offerA")} value={a} onChange={setA} />
    <Pay title={t("pay.offerB")} value={b} onChange={setB} />
    {line(t("pay.offerA"), na, a.currency)}{line(t("pay.offerB"), nb, b.currency)}
    {na && nb && !sameCurrency && <div>
      <p>{t("pay.rateHelp")}</p>
      <label className="fw-field">{t("pay.rate")} ({a.currency}→{b.currency})<input inputMode="decimal" value={rate} onChange={event => setRate(event.target.value.replace(/[^0-9.]/g, ""))} /></label>
      <label className="fw-field">{t("pay.rateDate")}<input type="date" value={asOf} onChange={event => setAsOf(event.target.value)} /></label>
      <label className="fw-field">{t("pay.rateSource")}<input value={source} maxLength={120} onChange={event => setSource(event.target.value)} /></label>
    </div>}
    {comparison && (comparison.comparable
      ? <p role="status">{comparison.difference === 0 ? t("pay.same") : comparison.difference > 0 ? t("pay.aHigher", { amount: formatCurrency(locale, comparison.difference, comparison.currency) }) : t("pay.bHigher", { amount: formatCurrency(locale, Math.abs(comparison.difference), comparison.currency) })} <small>({comparison.basis})</small></p>
      : <p role="note">{comparison.reason}</p>)}
    <p>{t("pay.disclaimer")}</p>
  </section>;
}
