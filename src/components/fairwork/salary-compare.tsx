"use client";
import { useEffect, useMemo, useState } from "react";
import { periods, positionOf, sourceTypes, summarize, monthly, type Period, type ReferencePoint, type SourceType } from "@/features/salary/compare";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

const storageKey = "oryqen.salary.v1";
type Offer = { amount: string; currency: string; period: Period };
const emptyOffer: Offer = { amount: "", currency: "LKR", period: "month" };
const blankPoint = { label: "", amount: "", currency: "LKR", period: "month" as Period, role: "", country: "", sourceType: "job_ad" as SourceType, sourceDate: "" };
const today = () => new Date().toISOString().slice(0, 10);

const sampleRows: [string, number, string][] = [["Warehouse assistant, sample A", 48000, "2026-06"], ["Warehouse assistant, sample B", 52000, "2026-07"], ["Warehouse assistant, sample C", 55000, "2026-08"], ["Warehouse assistant, sample D", 60000, "2026-08"], ["Warehouse assistant, sample E", 63000, "2026-09"], ["Warehouse assistant, sample F", 70000, "2026-10"]];

function readStored(): { points: ReferencePoint[]; offer: Offer } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (!raw || !Array.isArray(raw.points)) return { points: [], offer: emptyOffer };
    const points = raw.points.slice(0, 60).filter((item: ReferencePoint) => item && typeof item.id === "string" && typeof item.label === "string" && Number.isFinite(item.amount) && item.amount > 0 && (periods as readonly string[]).includes(item.period) && (sourceTypes as readonly string[]).includes(item.sourceType) && typeof item.currency === "string").map((item: ReferencePoint) => ({ id: item.id, label: item.label.slice(0, 80), amount: item.amount, currency: item.currency.slice(0, 3).toUpperCase(), period: item.period, role: String(item.role ?? "").slice(0, 60), country: String(item.country ?? "").slice(0, 60), sourceType: item.sourceType, sourceDate: /^\d{4}-\d{2}$/.test(item.sourceDate) ? item.sourceDate : "" }));
    const o = raw.offer ?? {};
    return { points, offer: { amount: typeof o.amount === "string" ? o.amount.slice(0, 12) : "", currency: typeof o.currency === "string" ? o.currency.slice(0, 3).toUpperCase() : "LKR", period: o.period === "year" ? "year" : "month" } };
  } catch { return { points: [], offer: emptyOffer }; }
}

// Salary comparison from reference points the person supplies, each with its own source. ORYQEN has no market salary dataset: nothing here is a market rate, currencies are never converted,
// and every result says how many points it rests on. Data stays on this device.
export function SalaryCompare() {
  const { t } = useI18n();
  const [points, setPoints] = useState<ReferencePoint[]>([]), [offer, setOffer] = useState<Offer>(emptyOffer), [draft, setDraft] = useState(blankPoint), [ready, setReady] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    (async () => { await Promise.resolve(); if (!live) return; const stored = readStored(); setPoints(stored.points); setOffer(stored.offer); setReady(true); })();
    return () => { live = false; };
  }, []);
  useEffect(() => { if (ready) try { window.localStorage.setItem(storageKey, JSON.stringify({ points, offer })); } catch { /* storage unavailable: still works for this visit */ } }, [points, offer, ready]);

  const offerAmount = Number(offer.amount);
  const summary = useMemo(() => summarize(points, offer.currency, today()), [points, offer.currency]);
  const position = useMemo(() => (offerAmount > 0 ? positionOf(monthly(offerAmount, offer.period), points, offer.currency) : null), [offerAmount, offer.period, points, offer.currency]);
  const fmt = (value: number) => Math.round(value).toLocaleString();

  function addPoint() {
    const amount = Number(draft.amount);
    if (!draft.label.trim() || !(amount > 0) || draft.currency.trim().length !== 3) { setError(t("sal.invalidPoint")); return; }
    if (draft.sourceDate && !/^\d{4}-\d{2}$/.test(draft.sourceDate)) { setError(t("sal.invalidPoint")); return; }
    if (points.length >= 60) { setError(t("sal.tooMany")); return; }
    setPoints(current => [...current, { id: crypto.randomUUID(), label: draft.label.trim().slice(0, 80), amount, currency: draft.currency.trim().toUpperCase(), period: draft.period, role: draft.role.trim().slice(0, 60), country: draft.country.trim().slice(0, 60), sourceType: draft.sourceType, sourceDate: draft.sourceDate }]);
    setDraft({ ...blankPoint, currency: draft.currency, period: draft.period }); setError("");
  }
  const loadSample = () => setPoints(current => [...current, ...sampleRows.filter(([label]) => !current.some(item => item.label === label)).map(([label, amount, date]) => ({ id: crypto.randomUUID(), label, amount, currency: "LKR", period: "month" as Period, role: "Warehouse assistant", country: "Sri Lanka", sourceType: "sample" as SourceType, sourceDate: date }))].slice(0, 60));

  return <section className="oq-rec" aria-label={t("sal.aria")}>
    <p className="fw-notice" role="note"><strong>{t("sal.labelTitle")}</strong> {t("sal.labelBody")}</p>
    <fieldset className="oq-rec-group"><legend>{t("sal.offerTitle")}</legend>
      <label className="fw-field">{t("sal.offerAmount")}<input inputMode="decimal" maxLength={12} value={offer.amount} onChange={e => setOffer({ ...offer, amount: e.target.value.replace(/[^\d.]/g, "") })} /></label>
      <label className="fw-field">{t("sal.currency")}<input maxLength={3} value={offer.currency} onChange={e => setOffer({ ...offer, currency: e.target.value.toUpperCase() })} /></label>
      <label className="fw-field">{t("sal.period")}<select value={offer.period} onChange={e => setOffer({ ...offer, period: e.target.value as Period })}>{periods.map(item => <option key={item} value={item}>{t(`sal.p.${item}` as MessageKey)}</option>)}</select></label>
    </fieldset>
    <fieldset className="oq-rec-group"><legend>{t("sal.pointsTitle")}</legend>
      <label className="fw-field">{t("sal.f.label")}<input maxLength={80} value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} /></label>
      <label className="fw-field">{t("sal.f.amount")}<input inputMode="decimal" maxLength={12} value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value.replace(/[^\d.]/g, "") })} /></label>
      <label className="fw-field">{t("sal.f.currency")}<input maxLength={3} value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} /></label>
      <label className="fw-field">{t("sal.f.period")}<select value={draft.period} onChange={e => setDraft({ ...draft, period: e.target.value as Period })}>{periods.map(item => <option key={item} value={item}>{t(`sal.p.${item}` as MessageKey)}</option>)}</select></label>
      <label className="fw-field">{t("sal.f.role")}<input maxLength={60} value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })} /></label>
      <label className="fw-field">{t("sal.f.country")}<input maxLength={60} value={draft.country} onChange={e => setDraft({ ...draft, country: e.target.value })} /></label>
      <label className="fw-field">{t("sal.f.source")}<select value={draft.sourceType} onChange={e => setDraft({ ...draft, sourceType: e.target.value as SourceType })}>{sourceTypes.filter(item => item !== "sample").map(item => <option key={item} value={item}>{t(`sal.s.${item}` as MessageKey)}</option>)}</select></label>
      <label className="fw-field">{t("sal.f.date")}<input type="month" value={draft.sourceDate} onChange={e => setDraft({ ...draft, sourceDate: e.target.value })} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="oq-rec-chips"><button type="button" className="fw-primary" onClick={addPoint}>{t("sal.add")}</button><button type="button" className="fw-secondary" onClick={loadSample}>{t("sal.loadSample")}</button>{points.length > 0 && <button type="button" className="fw-secondary" onClick={() => { if (window.confirm(t("sal.confirmClear"))) setPoints([]); }}>{t("sal.clear")}</button>}</div>
      {points.length === 0 ? <p>{t("sal.noPoints")}</p> : <ul className="oq-rec-list" aria-label={t("sal.listAria")}>{points.map(item => <li key={item.id}>
        <strong>{item.label}</strong> · {fmt(item.amount)} {item.currency} / {t(`sal.p.${item.period}` as MessageKey)} · {t(`sal.s.${item.sourceType}` as MessageKey)}{item.sourceDate ? ` · ${item.sourceDate}` : ` · ${t("sal.undated")}`}
        <button type="button" className="fw-secondary" aria-label={t("sal.removeFor", { label: item.label })} onClick={() => setPoints(current => current.filter(other => other.id !== item.id))}>{t("sal.remove")}</button>
      </li>)}</ul>}
    </fieldset>
    <section className="oq-rec-group" aria-label={t("sal.resultAria")}>
      <h3>{t("sal.resultTitle")}</h3>
      {!summary ? <p>{t("sal.noSummary", { currency: offer.currency || "?" })}</p> : <>
        <p>{t("sal.summary", { n: summary.n, currency: summary.currency, min: fmt(summary.min), median: fmt(summary.median), max: fmt(summary.max) })}</p>
        {position ? <p aria-live="polite"><strong>{t(`sal.where.${position.where}` as MessageKey, { offer: fmt(monthly(offerAmount, offer.period)), currency: summary.currency })}</strong> {t("sal.share", { share: position.shareAtOrBelow, diff: position.differenceFromMedianPercent })}</p> : <p>{t("sal.enterOffer")}</p>}
        <ul aria-label={t("sal.flagsAria")}>
          {summary.fewPoints && <li>{t("sal.flag.few", { n: summary.n, min: 5 })}</li>}
          {summary.excludedOtherCurrency > 0 && <li>{t("sal.flag.currency", { count: summary.excludedOtherCurrency })}</li>}
          {summary.stale > 0 && <li>{t("sal.flag.stale", { count: summary.stale })}</li>}
          {summary.undated > 0 && <li>{t("sal.flag.undated", { count: summary.undated })}</li>}
          {summary.mixedCountries && <li>{t("sal.flag.countries")}</li>}
          {summary.mixedRoles && <li>{t("sal.flag.roles")}</li>}
          {summary.samplePoints > 0 && <li>{t("sal.flag.sample", { count: summary.samplePoints })}</li>}
        </ul>
      </>}
    </section>
    <p className="fw-notice">{t("sal.notice")}</p>
  </section>;
}
