"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/features/live/use-live-refresh";
import { appRequest } from "@/features/authority/client";
import { offerListSchema, type OfferList } from "@/features/offer/list-schema";
import { workListSchema, type WorkList } from "@/features/work/schema";
import { expiryList } from "@/features/offer/expiry";
import { bcp47 } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./dashboard-overview.css";

// Everything on this dashboard comes from the person's own records through the existing APIs. When a read fails the card says so; nothing is estimated or invented.
type Loaded<T> = { state: "loading" } | { state: "failed" } | { state: "ready"; data: T };
function useRead<T>(path: string, parse: (raw: unknown) => T): Loaded<T> {
  const [value, setValue] = useState<Loaded<T>>({ state: "loading" });
  useEffect(() => {
    let active = true;
    appRequest(path).then(raw => { if (active) setValue({ state: "ready", data: parse(raw) }); }).catch(() => { if (active) setValue({ state: "failed" }); });
    return () => { active = false; };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps -- parse is a module-level function
  // Later refreshes replace the data only on success; a failed background refresh keeps what is shown instead of blanking the card.
  const refresh = useCallback(async () => { setValue({ state: "ready", data: parse(await appRequest(path)) }); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps -- parse is a module-level function
  useLiveRefresh(refresh, value.state === "ready");
  return value;
}
const parseOffers = (raw: unknown): OfferList => offerListSchema.parse(raw);
const parseRecords = (raw: unknown): WorkList => workListSchema.parse(raw);

export function useDashboardData() {
  const offers = useRead("/api/v1/offers?context=WORKER&view=active", parseOffers);
  const records = useRead("/api/v1/work-records", parseRecords);
  // Open agreement proposals that carry an expiry date: the one agreement list the API offers without a record id.
  const agreements = useRead("/api/v1/agreement-expiries", (raw: unknown) => expiryList.parse(raw));
  return { offers, records, agreements };
}
type Data = ReturnType<typeof useDashboardData>;

const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const ICONS = { offer: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6", record: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", passport: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4", agreement: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5", clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" };

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

export function HoursChart({ items }: { items: WorkList["items"] }) {
  const { t } = useI18n();
  const shown = items.slice(0, 8);
  const hours = shown.map(item => Number(item.hours)).map(value => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(...hours, 0);
  if (!shown.length || max === 0) return null;
  const summary = shown.map((item, index) => `${item.periodStart}: ${hours[index]} h${item.state === "verified" ? "" : ` (${t("dash.chartPending")})`}`).join("; ");
  return <><div className="oq-bars" role="img" aria-label={`${t("dash.chartAria")} ${summary}`}>
    {shown.map((item, index) => <i key={item.workId} className={item.state === "verified" ? "is-verified" : ""} style={{ height: `${Math.max(8, Math.round((hours[index]! / max) * 100))}%` }} />)}
  </div><p className="oq-bars-cap">{t("dash.chartCap")}</p></>;
}

export function SummaryCards({ data }: { data: Data }) {
  const { t } = useI18n();
  const offers = data.offers.state === "ready" ? data.offers.data.items : null;
  const records = data.records.state === "ready" ? data.records.data.items : null;
  const open = offers?.reduce((sum, item) => sum + item.questions, 0) ?? 0;
  const latest = offers?.[0];
  const verifiedItems = records?.filter(item => item.state === "verified") ?? [];
  const verified = verifiedItems.length;
  const verifiedHours = Math.round(verifiedItems.reduce((sum, item) => sum + (Number.isFinite(Number(item.hours)) ? Number(item.hours) : 0), 0) * 100) / 100;
  const unavailable = <p className="fw-sum-note">{t("dash.unavailable")}</p>;
  return <div className="fw-sum-grid">
    <Card icon="offer" title={t("dash.offers")} label={t("dash.cardOffers")}>
      {data.offers.state === "failed" ? unavailable : offers === null ? <p className="fw-sum-note" role="status">…</p> : offers.length === 0
        ? <><p className="fw-sum-value">0</p><p className="fw-sum-note">{t("dash.offersEmpty")}</p><Link className="fw-sum-link" href="/app/add-offer">{t("dash.firstOffer")} →</Link></>
        : <><p className="fw-sum-value">{offers.length}{data.offers.state === "ready" && data.offers.data.nextCursor ? "+" : ""}</p><p className="fw-sum-note">{t("dash.offersLatest", { role: latest?.role || t("offers.untitled") })}</p>{open > 0 && <p className="fw-sum-chip">{t("dash.questionsOpen", { count: open })}</p>}</>}
    </Card>
    <Card icon="record" title={t("dash.records")} label={t("dash.cardRecords")}>
      {data.records.state === "failed" ? unavailable : records === null ? <p className="fw-sum-note" role="status">…</p> : records.length === 0
        ? <><p className="fw-sum-value">0</p><p className="fw-sum-note">{t("dash.recordsEmpty")}</p><Link className="fw-sum-link" href="/app/agreement-workflow">{t("dash.startRecord")} →</Link></>
        : <><p className="fw-sum-value">{records.length}</p><p className="fw-sum-note">{t("dash.recordsVerified", { count: verified })}</p></>}
    </Card>
    <Card icon="clock" title={t("dash.hours")} label={t("dash.cardHours")}>
      {data.records.state === "failed" ? unavailable : records === null ? <p className="fw-sum-note" role="status">…</p>
        : <><p className="fw-sum-value">{verifiedHours.toLocaleString()}<span className="fw-sum-unit"> h</span></p>
          <p className="fw-sum-note">{verified === 0 ? t("dash.hoursNone") : t("dash.hoursNote", { count: verified })}</p>
          <HoursChart items={records} /></>}
    </Card>
    <Card icon="agreement" title={t("dash.agreements")} label={t("dash.cardAgreements")}>
      {data.agreements.state === "failed" ? unavailable : data.agreements.state === "loading" ? <p className="fw-sum-note" role="status">…</p> : (() => {
        const items = data.agreements.data.items;
        const expired = items.filter(item => item.expired).length;
        const soonest = items.filter(item => !item.expired).sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))[0];
        return <><p className="fw-sum-value">{items.length}</p>
          <p className="fw-sum-note">{items.length === 0 ? t("dash.agreementsNone") : soonest ? t("dash.agreementsNext", { date: new Date(soonest.expiresAt).toLocaleDateString() }) : t("dash.agreementsAllExpired")}</p>
          {expired > 0 && <p className="fw-sum-chip">{t("dash.agreementsExpired", { count: expired })}</p>}
          <Link className="fw-sum-link" href="/app/agreement-workflow">{t("dash.openAgreements")} →</Link></>;
      })()}
    </Card>
    <Card icon="passport" title={t("dash.passport")} label={t("dash.cardPassport")}>
      {data.records.state === "failed" ? unavailable : records === null ? <p className="fw-sum-note" role="status">…</p>
        : <><p className="fw-sum-value">{verified}</p><p className="fw-sum-note">{verified === 0 ? t("dash.passportNone") : t("dash.passportSome", { count: verified })}</p><Link className="fw-sum-link" href="/app/passport">{t("dash.openPassport")} →</Link></>}
    </Card>
  </div>;
}

export function RecentOffers({ data }: { data: Data }) {
  const { t, locale } = useI18n();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const day = (value: string) => Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleDateString(bcp47(locale), { year: "numeric", month: "short", day: "numeric" });
  const items = data.offers.state === "ready" ? data.offers.data.items.slice(0, 6) : [];
  const selected = items.find(item => item.offerId === pickedId) ?? items[0];
  const decisionKey = (value: string | undefined) => `offers.${value ?? "considering"}` as MessageKey;
  return <section className="fw-recent oq-wb" aria-label={t("dash.recent")}>
    <header><h3>{t("dash.recent")}</h3><Link className="oq-wb-new" href="/app/add-offer">{t("dash.newOffer")}</Link></header>
    {data.offers.state === "failed" && <p className="fw-sum-note">{t("dash.unavailable")}</p>}
    {data.offers.state === "ready" && items.length === 0 && <div className="oq-gs">
      <div className="oq-gs-intro"><p><strong>{t("dash.recentEmptyTitle")}</strong></p><p>{t("dash.recentEmptyBody")}</p></div>
      <ol className="oq-gs-steps">
        {([["/app/add-offer", "dash.gs1", "dash.gs1b"], ["/app/check", "dash.gs2", "dash.gs2b"], ["/app/work-record", "dash.gs3", "dash.gs3b"]] as const).map(([href, title, body], index) => <li key={href}>
          <Link className="oq-gs-link" href={href}><span className="oq-gs-n" aria-hidden="true">{index + 1}</span><span><strong>{t(title)}</strong><small>{t(body)}</small></span></Link>
        </li>)}
      </ol>
      <Link className="fw-primary" href="/app/add-offer">{t("dash.firstOffer")}</Link>
    </div>}
    {data.offers.state === "ready" && selected && <div className="oq-wb-body">
      <ul className="oq-wb-list" aria-label={t("dash.wbList")}>
        {items.map(item => <li key={item.offerId}>
          <button type="button" aria-pressed={item.offerId === selected.offerId} onClick={() => setPickedId(item.offerId)}>
            <span className="fw-recent-mark" aria-hidden="true">{(item.role || "?").slice(0, 1).toUpperCase()}</span>
            <span className="fw-recent-main"><strong>{item.role || t("offers.untitled")}</strong><small>{day(item.createdAt)} · {t("dash.revision", { version: item.version })}</small></span>
            <span className="fw-recent-pill">{item.questions > 0 ? t("dash.questionsOpen", { count: item.questions }) : t("dash.noQuestions")}</span>
          </button>
        </li>)}
        <li><Link className="oq-wb-add" href="/app/add-offer">+ {t("dash.addAnother")}</Link></li>
      </ul>
      <article className="oq-wb-detail" key={selected.offerId} aria-label={t("dash.wbDetail")}>
        <p className="oq-wb-kicker">{t("dash.wbDetail")}</p>
        <h4>{selected.role || t("offers.untitled")}</h4>
        <dl className="oq-wb-facts">
          <div><dt>{t("dash.wbRevision")}</dt><dd>{selected.version}</dd></div>
          <div><dt>{t("dash.wbSaved")}</dt><dd>{day(selected.createdAt)}</dd></div>
          <div><dt>{t("dash.wbQuestions")}</dt><dd>{selected.questions}</dd></div>
          <div><dt>{t("dash.wbDecision")}</dt><dd>{t(decisionKey(selected.decision))}</dd></div>
        </dl>
        <div className="oq-wb-actions">
          <Link className="oq-wb-primary" href={`/app/agreement?offerId=${selected.offerId}`} aria-label={t("dash.reviewAria", { role: selected.role || t("offers.untitled") })}>{t("dash.review")}</Link>
          <Link className="oq-wb-secondary" href={`/app/check?offerId=${selected.offerId}`}>{t("dash.wbFindings")}</Link>
        </div>
      </article>
    </div>}
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
