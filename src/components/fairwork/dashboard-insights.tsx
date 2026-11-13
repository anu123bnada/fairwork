"use client";
import Link from "next/link";
import { Donut, StackedBars, type Bar, type DonutSegment } from "./charts";
import { bcp47 } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import type { DashboardData } from "./dashboard";

// Insights built only from the person's own saved offers and work records. A chart appears only when there is something real to draw;
// a failed read says so; with nothing saved yet the band explains what will appear instead of drawing an empty chart.
const toHours = (value: string) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; };
const round = (value: number) => Math.round(value * 100) / 100;

export function DashboardInsights({ data }: { data: DashboardData }) {
  const { t, locale } = useI18n();
  const offers = data.offers.state === "ready" ? data.offers.data.items : [];
  const records = data.records.state === "ready" ? data.records.data.items : [];

  if (data.offers.state === "loading" || data.records.state === "loading") return <section className="oq-insights is-loading" aria-label={t("v2.insights")} aria-busy="true"><div className="oq-skel" /><div className="oq-skel" /><div className="oq-skel" /></section>;
  if (data.offers.state === "failed" && data.records.state === "failed") return <section className="oq-insights" aria-label={t("v2.insights")}><article className="oq-insight oq-insight-wide"><h3>{t("v2.insights")}</h3><p className="fw-sum-note" role="status">{t("dash.unavailable")}</p></article></section>;
  if (offers.length === 0 && records.length === 0) return <section className="oq-insights" aria-label={t("v2.insights")}>
    <article className="oq-insight oq-insight-wide oq-insight-empty">
      <h3>{t("v2.emptyTitle")}</h3>
      <p>{t("v2.emptyBody")}</p>
      <ul className="oq-empty-list"><li>{t("v2.emptyHours")}</li><li>{t("v2.emptyDecisions")}</li><li>{t("v2.emptyStates")}</li></ul>
      <Link className="fw-primary" href="/app/add-offer">{t("dash.firstOffer")}</Link>
    </article>
  </section>;

  // Hours per calendar month of the work period, split into confirmed and not-yet-confirmed. Withdrawn, retracted and replaced records are not counted.
  const months = new Map<string, { verified: number; other: number }>();
  for (const record of records) {
    const key = record.periodStart.slice(0, 7);
    const entry = months.get(key) ?? { verified: 0, other: 0 };
    if (record.state === "verified") entry.verified += toHours(record.hours);
    else if (record.state !== "withdrawn" && record.state !== "invalidated" && record.state !== "superseded") entry.other += toHours(record.hours);
    months.set(key, entry);
  }
  const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString(bcp47(locale), { month: "short", year: "2-digit", timeZone: "UTC" });
  const bars: Bar[] = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).filter(([, value]) => value.verified + value.other > 0).map(([key, value]) => ({
    key, label: monthLabel(key), primary: round(value.verified), secondary: round(value.other),
    title: t("v2.barTitle", { month: monthLabel(key), verified: round(value.verified), pending: round(value.other) }),
  }));

  const decisionCounts = new Map<string, number>();
  for (const offer of offers) decisionCounts.set(offer.decision ?? "considering", (decisionCounts.get(offer.decision ?? "considering") ?? 0) + 1);
  const decisions: DonutSegment[] = (["considering", "interested", "accepted", "declined"] as const).map((key, index) => ({ key, label: t(`offers.${key}` as MessageKey), value: decisionCounts.get(key) ?? 0, tone: ([1, 2, 3, 4] as const)[index]! }));

  const stateCounts = new Map<string, number>();
  for (const record of records) stateCounts.set(record.state, (stateCounts.get(record.state) ?? 0) + 1);
  const stateOrder = ["verified", "submitted", "draft", "disputed", "rejected", "withdrawn", "invalidated", "superseded"] as const;
  const tones: Record<(typeof stateOrder)[number], 1 | 2 | 3 | 4 | 5> = { verified: 1, submitted: 2, draft: 5, disputed: 4, rejected: 4, withdrawn: 5, invalidated: 5, superseded: 5 };
  const states: DonutSegment[] = stateOrder.map(key => ({ key, label: t(`v2.state.${key}` as MessageKey), value: stateCounts.get(key) ?? 0, tone: tones[key] }));

  const failedNote = <p className="fw-sum-note" role="status">{t("dash.unavailable")}</p>;
  return <section className="oq-insights" aria-label={t("v2.insights")}>
    <article className="oq-insight oq-insight-hours" aria-label={t("v2.hoursTitle")}>
      <header><h3>{t("v2.hoursTitle")}</h3><Link href="/app/work-record">{t("v2.openRecords")} →</Link></header>
      {data.records.state === "failed" ? failedNote : bars.length === 0
        ? <p className="fw-sum-note">{t("v2.hoursNone")}</p>
        : <StackedBars bars={bars} unit={t("v2.unitHours")} primaryName={t("v2.confirmed")} secondaryName={t("v2.notYetConfirmed")} ariaLabel={t("v2.hoursAria")} />}
    </article>
    <article className="oq-insight oq-insight-decisions" aria-label={t("v2.decisionsTitle")}>
      <header><h3>{t("v2.decisionsTitle")}</h3><Link href="/app/check">{t("v2.openCheck")} →</Link></header>
      {data.offers.state === "failed" ? failedNote : offers.length === 0
        ? <p className="fw-sum-note">{t("dash.offersEmpty")}</p>
        : <Donut segments={decisions} centerValue={offers.length} centerLabel={t("v2.offers")} ariaLabel={t("v2.decisionsAria")} />}
    </article>
    <article className="oq-insight oq-insight-states" aria-label={t("v2.statesTitle")}>
      <header><h3>{t("v2.statesTitle")}</h3><Link href="/app/passport">{t("v2.openPassport")} →</Link></header>
      {data.records.state === "failed" ? failedNote : records.length === 0
        ? <p className="fw-sum-note">{t("dash.recordsEmpty")}</p>
        : <Donut segments={states} centerValue={records.length} centerLabel={t("v2.records")} ariaLabel={t("v2.statesAria")} />}
    </article>
  </section>;
}
