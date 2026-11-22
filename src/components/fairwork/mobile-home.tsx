"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/use-i18n";
import type { DashboardData } from "./dashboard";
import { JourneyStrip } from "./dashboard";
import { openCommandPalette } from "./command-palette";
import { openNavMenu } from "./menu-sheet";

// Phone composition of the Worker Dashboard (Finology / Finora references). It reads the same data object as the desktop dashboard and invents nothing:
// every number is derived from the person's own offers and work records, and a failed read says so.
const QUERY = "(max-width: 767px)";
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    notify => { const list = window.matchMedia(QUERY); list.addEventListener("change", notify); return () => list.removeEventListener("change", notify); },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

const path = (d: string) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const ICON = {
  offer: "M12 5v14M5 12h14", scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10",
  work: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", passport: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4",
  menu: "M4 7h16M4 12h16M4 17h10", search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5", bell: "M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0",
};

// Smooth line through the per-record hours (real values only); nothing is drawn when there is nothing to draw.
function Wave({ values }: { values: number[] }) {
  if (values.length < 2 || Math.max(...values) <= 0) return null;
  const w = 300, h = 90, max = Math.max(...values), step = w / (values.length - 1);
  const points = values.map((value, index) => [index * step, h - 10 - (value / max) * (h - 28)] as const);
  const line = points.map(([x, y], index) => {
    if (index === 0) return `M${x},${y}`;
    const [px] = points[index - 1]!, py = points[index - 1]![1], mid = (px + x) / 2;
    return `C${mid},${py} ${mid},${y} ${x},${y}`;
  }).join(" ");
  return <svg className="mh-wave" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
    <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#mhw)" /><path d={line} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    <defs><linearGradient id="mhw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
  </svg>;
}

export function MobileHome({ name, data }: { name: string; data: DashboardData }) {
  const { t } = useI18n();
  const offers = data.offers.state === "ready" ? data.offers.data.items : null;
  const records = data.records.state === "ready" ? data.records.data.items : null;
  const hours = (value: string) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : 0; };
  const verified = records?.filter(item => item.state === "verified") ?? [];
  const verifiedHours = Math.round(verified.reduce((sum, item) => sum + hours(item.hours), 0) * 100) / 100;
  const ordered = records ? [...records].sort((a, b) => a.periodStart.localeCompare(b.periodStart)).slice(-8).map(item => hours(item.hours)) : [];
  const none = <b className="mh-chip-v">–</b>;
  const first = name.split(" ")[0]!;
  return <div className="mh">
    <header className="mh-top">
      <Link className="mh-avatar" href="/app/settings" aria-label={t("home.openSettings")}>{name.slice(0, 1).toUpperCase()}</Link>
      <div className="mh-hello"><p className="mh-eyebrow">{t("home.workspace")}</p><h2>{t("home.greeting", { name: first })}</h2></div>
      <button type="button" className="mh-round" aria-label={t("v2.menu")} aria-haspopup="dialog" onClick={openNavMenu}>{path(ICON.menu)}</button>
      <button type="button" className="mh-round" aria-label={t("cp.openAria")} onClick={openCommandPalette}>{path(ICON.search)}</button>
      <Link className="mh-round" href="/app/notifications" aria-label={t("home.notifications")}>{path(ICON.bell)}</Link>
    </header>

    <section className="mh-hero" aria-label={t("dash.cardHours")}>
      <p className="mh-hero-label">{t("dash.hours")}</p>
      <p className="mh-hero-value">{data.records.state === "failed" ? "–" : records === null ? "…" : <>{verifiedHours.toLocaleString()}<small> h</small></>}</p>
      <Wave values={ordered} />
      <ul className="mh-chips">
        <li><span>{t("dash.offers")}</span>{offers ? <b className="mh-chip-v">{offers.length}</b> : none}</li>
        <li><span>{t("dash.records")}</span>{records ? <b className="mh-chip-v">{records.length}</b> : none}</li>
        <li><span>{t("dash.passport")}</span>{records ? <b className="mh-chip-v">{verified.length}</b> : none}</li>
      </ul>
    </section>

    <div className="mh-actions" role="region" aria-label={t("dash.heroAria")}>
      {([["/app/add-offer", "offer", t("v2.addOffer")], ["/app/scan", "scan", t("nav.scan")], ["/app/work-record", "work", t("nav.record")], ["/app/passport", "passport", t("nav.passport")]] as const).map(([href, icon, label]) => <Link key={href} href={href}><span aria-hidden="true">{path(ICON[icon])}</span>{label}</Link>)}
    </div>

    <JourneyStrip data={data} />
  </div>;
}
