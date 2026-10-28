"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { bcp47 } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";

type Credential = { credentialId: string; status: string; expiresAt: string };
type RecruiterCheck = { verificationId: string; recruiterName: string; expiresAt: string };
type Grant = { grantId: string; owner: boolean; active: boolean; revoked: boolean; expiresAt: string };
const DAY = 86_400_000;
export const REMINDER_WINDOW_DAYS = 14;

// Pure helper so the rule is testable: valid credentials that end within the window, soonest first.
export function expiringCredentials(items: Credential[], now: number, windowDays = REMINDER_WINDOW_DAYS) {
  return items
    .filter(item => item.status === "valid" && Date.parse(item.expiresAt) > now && Date.parse(item.expiresAt) - now <= windowDays * DAY)
    .map(item => ({ ...item, daysLeft: Math.max(1, Math.ceil((Date.parse(item.expiresAt) - now) / DAY)) }))
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}
// Passport links the person shared that are still active and end within the window. Links shared with them are not theirs to renew.
export function expiringShares(items: Grant[], now: number, windowDays = REMINDER_WINDOW_DAYS) {
  return items
    .filter(item => item.owner && item.active && !item.revoked && Date.parse(item.expiresAt) > now && Date.parse(item.expiresAt) - now <= windowDays * DAY)
    .map(item => ({ ...item, daysLeft: Math.max(1, Math.ceil((Date.parse(item.expiresAt) - now) / DAY)) }))
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}
// Recruiter checks are erased automatically after 90 days; remind the person before that happens.
export function expiringChecks(items: RecruiterCheck[], now: number, windowDays = REMINDER_WINDOW_DAYS) {
  return items
    .filter(item => Date.parse(item.expiresAt) > now && Date.parse(item.expiresAt) - now <= windowDays * DAY)
    .map(item => ({ ...item, daysLeft: Math.max(1, Math.ceil((Date.parse(item.expiresAt) - now) / DAY)) }))
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}

// Open agreement proposals whose expiry has passed, or ends within the window (a short one: a proposal is a live negotiation), soonest first.
export function expiringAgreements(items: { expiresAt: string; expired: boolean }[], now: number, windowDays = 7) {
  return items
    .filter(item => item.expired || (Date.parse(item.expiresAt) > now && Date.parse(item.expiresAt) - now <= windowDays * DAY))
    .map(item => ({ ...item, daysLeft: Math.max(1, Math.ceil((Date.parse(item.expiresAt) - now) / DAY)) }))
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}

// Reminders are derived in the app from data the person already has; nothing is emailed or pushed (those channels are not connected).
export function Reminders() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<ReturnType<typeof expiringCredentials> | null>(null);
  const [checks, setChecks] = useState<ReturnType<typeof expiringChecks>>([]);
  const [shares, setShares] = useState<ReturnType<typeof expiringShares>>([]);
  const [waiting, setWaiting] = useState(0);
  const [agreements, setAgreements] = useState<{ expiresAt: string; expired: boolean; daysLeft: number }[]>([]);
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/credentials").then(raw => {
      const list = (raw as { items?: Credential[] }).items;
      if (active && Array.isArray(list)) setItems(expiringCredentials(list, Date.now()));
    }).catch(() => { /* reminders are a convenience; no reminder is better than a false one */ });
    appRequest("/api/v1/recruiter").then(raw => {
      const list = (raw as { items?: RecruiterCheck[] }).items;
      if (active && Array.isArray(list)) setChecks(expiringChecks(list, Date.now()));
    }).catch(() => { /* same rule */ });
    appRequest("/api/v1/passport/sharing").then(raw => {
      const list = (raw as { items?: Grant[] }).items;
      if (active && Array.isArray(list)) setShares(expiringShares(list, Date.now()));
    }).catch(() => { /* same rule */ });
    appRequest("/api/v1/agreement-expiries").then(raw => {
      const list = (raw as { items?: { expiresAt: string; expired: boolean }[] }).items;
      if (active && Array.isArray(list)) setAgreements(expiringAgreements(list, Date.now()));
    }).catch(() => { /* same rule */ });
    appRequest("/api/v1/recruiter/queue").then(raw => {
      const list = (raw as { items?: { mine: unknown }[] }).items;
      if (active && Array.isArray(list)) setWaiting(list.filter(item => !item.mine).length);
    }).catch(() => { /* people who are not representatives have no queue */ });
    return () => { active = false; };
  }, []);
  const credentials = items ?? [];
  if (credentials.length === 0 && checks.length === 0 && shares.length === 0 && waiting === 0 && agreements.length === 0) return null;
  const date = (value: string) => new Date(value).toLocaleDateString(bcp47(locale), { year: "numeric", month: "short", day: "numeric" });
  return <section className="fw-list-card" aria-label={t("reminders.title")}>
    <h3>{t("reminders.title")}</h3>
    <ul>
      {credentials.map(item => <li key={item.credentialId}>
        {t(item.daysLeft === 1 ? "reminders.expiresOne" : "reminders.expiresMany", { days: item.daysLeft, date: date(item.expiresAt) })}
      </li>)}
      {shares.map(item => <li key={item.grantId}>
        {t(item.daysLeft === 1 ? "reminders.shareOne" : "reminders.shareMany", { days: item.daysLeft, date: date(item.expiresAt) })}
      </li>)}
      {checks.map(item => <li key={item.verificationId}>
        {t(item.daysLeft === 1 ? "reminders.checkOne" : "reminders.checkMany", { name: item.recruiterName, days: item.daysLeft, date: date(item.expiresAt) })}
      </li>)}
      {agreements.map(item => <li key={item.expiresAt}>{item.expired ? t("reminders.agreementExpired", { date: date(item.expiresAt) }) : t("reminders.agreementSoon", { days: item.daysLeft, date: date(item.expiresAt) })}</li>)}
      {waiting > 0 && <li>{t("reminders.queue", { count: waiting })}</li>}
    </ul>
    {agreements.length > 0 && <Link className="fw-secondary" href="/app/agreement-workflow">{t("reminders.agreementOpen")}</Link>}
    {(credentials.length > 0 || shares.length > 0) && <Link className="fw-secondary" href="/app/passport">{t("reminders.open")}</Link>}
    {checks.length > 0 && <Link className="fw-secondary" href="/app/check">{t("reminders.checkOpen")}</Link>}
    {waiting > 0 && <Link className="fw-secondary" href="/app/employer">{t("reminders.queueOpen")}</Link>}
  </section>;
}
