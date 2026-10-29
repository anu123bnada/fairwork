"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { offerListSchema, type OfferList } from "@/features/offer/list-schema";
import { workListSchema, type WorkList } from "@/features/work/schema";
import { bcp47 } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";

// Everything on this dashboard comes from the person's own records through the existing APIs. When a read fails the card says so; nothing is estimated or invented.
type Loaded<T> = { state: "loading" } | { state: "failed" } | { state: "ready"; data: T };
function useRead<T>(path: string, parse: (raw: unknown) => T): Loaded<T> {
  const [value, setValue] = useState<Loaded<T>>({ state: "loading" });
  useEffect(() => {
    let active = true;
    appRequest(path).then(raw => { if (active) setValue({ state: "ready", data: parse(raw) }); }).catch(() => { if (active) setValue({ state: "failed" }); });
    return () => { active = false; };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps -- parse is a module-level function
  return value;
}
const parseOffers = (raw: unknown): OfferList => offerListSchema.parse(raw);
const parseRecords = (raw: unknown): WorkList => workListSchema.parse(raw);

export function useDashboardData() {
  const offers = useRead("/api/v1/offers?context=WORKER&view=active", parseOffers);
  const records = useRead("/api/v1/work-records", parseRecords);
  return { offers, records };
}
type Data = ReturnType<typeof useDashboardData>;

const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const ICONS = { offer: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6", record: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", passport: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4", spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" };

// Where the person is in the employment journey, shown only from what their records prove.
export function JourneyStrip({ data }: { data: Data }) {
  const { t } = useI18n();
  const hasOffer = data.offers.state === "ready" && data.offers.data.items.length > 0;
  const hasRecord = data.records.state === "ready" && data.records.data.items.length > 0;
  const hasVerified = data.records.state === "ready" && data.records.data.items.some(item => item.state === "verified");
  const steps = [
    { href: "/app/add-offer", label: t("dash.j.offer"), done: hasOffer },
    { href: "/app/check", label: t("dash.j.check"), done: false },
    { href: "/app/agreement-workflow", label: t("dash.j.agreement"), done: false },
    { href: "/app/work-record", label: t("dash.j.record"), done: hasRecord },
    { href: "/app/passport", label: t("dash.j.passport"), done: hasVerified },
  ];
  const current = steps.findIndex(step => !step.done);
  return <ol className="fw-journey" aria-label={t("dash.journey")}>
    {steps.map((step, index) => <li key={step.href} className={step.done ? "is-done" : index === current ? "is-current" : ""}>
      <Link href={step.href} aria-current={index === current ? "step" : undefined}><span className="fw-journey-dot" aria-hidden="true">{step.done ? "✓" : index + 1}</span>{step.label}</Link>
    </li>)}
  </ol>;
}

function Card({ icon, title, children, label }: { icon: keyof typeof ICONS; title: string; children: React.ReactNode; label: string }) {
  return <section className="fw-sum-card" aria-label={label}>
    <span className="fw-sum-icon"><Icon d={ICONS[icon]} /></span>
    <h3>{title}</h3>
    {children}
  </section>;
}

export function SummaryCards({ data }: { data: Data }) {
  const { t } = useI18n();
  const offers = data.offers.state === "ready" ? data.offers.data.items : null;
  const records = data.records.state === "ready" ? data.records.data.items : null;
  const open = offers?.reduce((sum, item) => sum + item.questions, 0) ?? 0;
  const latest = offers?.[0];
  const verified = records?.filter(item => item.state === "verified").length ?? 0;
  const unavailable = <p className="fw-sum-note">{t("dash.unavailable")}</p>;
  return <div className="fw-sum-grid">
    <Card icon="offer" title={t("dash.offers")} label={t("dash.offers")}>
      {data.offers.state === "failed" ? unavailable : offers === null ? <p className="fw-sum-note" role="status">…</p> : offers.length === 0
        ? <><p className="fw-sum-value">0</p><p className="fw-sum-note">{t("dash.offersEmpty")}</p><Link className="fw-sum-link" href="/app/add-offer">{t("home.addOffer")} →</Link></>
        : <><p className="fw-sum-value">{offers.length}{data.offers.state === "ready" && data.offers.data.nextCursor ? "+" : ""}</p><p className="fw-sum-note">{t("dash.offersLatest", { role: latest?.role || t("offers.untitled") })}</p>{open > 0 && <p className="fw-sum-chip">{t("dash.questionsOpen", { count: open })}</p>}</>}
    </Card>
    <Card icon="record" title={t("dash.records")} label={t("dash.records")}>
      {data.records.state === "failed" ? unavailable : records === null ? <p className="fw-sum-note" role="status">…</p> : records.length === 0
        ? <><p className="fw-sum-value">0</p><p className="fw-sum-note">{t("dash.recordsEmpty")}</p></>
        : <><p className="fw-sum-value">{records.length}</p><p className="fw-sum-note">{t("dash.recordsVerified", { count: verified })}</p></>}
    </Card>
    <Card icon="passport" title={t("dash.passport")} label={t("dash.passport")}>
      {data.records.state === "failed" ? unavailable : records === null ? <p className="fw-sum-note" role="status">…</p>
        : <><p className="fw-sum-value">{verified}</p><p className="fw-sum-note">{verified === 0 ? t("dash.passportNone") : t("dash.passportSome", { count: verified })}</p><Link className="fw-sum-link" href="/app/passport">{t("dash.openPassport")} →</Link></>}
    </Card>
  </div>;
}

export function RecentOffers({ data }: { data: Data }) {
  const { t, locale } = useI18n();
  const day = (value: string) => Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleDateString(bcp47(locale), { year: "numeric", month: "short", day: "numeric" });
  return <section className="fw-recent" aria-label={t("dash.recent")}>
    <header><h3>{t("dash.recent")}</h3><Link href="/app/add-offer">{t("home.addOffer")}</Link></header>
    {data.offers.state === "failed" && <p className="fw-sum-note">{t("dash.unavailable")}</p>}
    {data.offers.state === "ready" && data.offers.data.items.length === 0 && <div className="fw-recent-empty">
      <p><strong>{t("dash.recentEmptyTitle")}</strong></p><p>{t("dash.recentEmptyBody")}</p>
      <Link className="fw-primary" href="/app/add-offer">{t("home.addOffer")}</Link>
    </div>}
    {data.offers.state === "ready" && data.offers.data.items.length > 0 && <ul>
      {data.offers.data.items.slice(0, 5).map(item => <li key={item.offerId}>
        <span className="fw-recent-mark" aria-hidden="true">{(item.role || "?").slice(0, 1).toUpperCase()}</span>
        <span className="fw-recent-main"><strong>{item.role || t("offers.untitled")}</strong><small>{day(item.createdAt)} · {t("dash.revision", { version: item.version })}</small></span>
        <span className="fw-recent-pill">{item.questions > 0 ? t("dash.questionsOpen", { count: item.questions }) : t("dash.noQuestions")}</span>
        <Link href={`/app/agreement?offerId=${item.offerId}`} aria-label={t("dash.reviewAria", { role: item.role || t("offers.untitled") })}>{t("dash.review")}</Link>
      </li>)}
    </ul>}
  </section>;
}

export function DashboardHero({ name, data, status }: { name: string; data: Data; status: string }) {
  const { t } = useI18n();
  const hasOffer = data.offers.state === "ready" && data.offers.data.items.length > 0;
  // The line under the greeting comes from the records when they loaded; until then, or if they failed, the existing session-based sentence stays.
  const open = data.offers.state === "ready" ? data.offers.data.items.reduce((sum, item) => sum + item.questions, 0) : 0;
  const line = hasOffer && data.offers.state === "ready" ? t(open > 0 ? "dash.heroOpen" : "dash.heroSaved", { count: data.offers.data.items.length, questions: open }) : status;
  return <section className="fw-hero" aria-label={t("dash.heroAria")}>
    <span className="fw-hero-orb fw-hero-orb-a" aria-hidden="true" /><span className="fw-hero-orb fw-hero-orb-b" aria-hidden="true" />
    <div className="fw-hero-copy">
      <p className="fw-hero-eyebrow">{t("home.workspace")}</p>
      <h2>{t("home.greeting", { name })}</h2>
      <p className="fw-hero-status">{line}</p>
      <div className="fw-hero-actions">
        <Link className="fw-hero-primary" href={hasOffer ? "/app/check" : "/app/add-offer"}><Icon d={ICONS.spark} />{hasOffer ? t("home.reviewOffer") : t("home.addOffer")}</Link>
        <Link className="fw-hero-secondary" href="/app/opportunities">{t("home.discover")}</Link>
      </div>
    </div>
    <JourneyStrip data={data} />
  </section>;
}
