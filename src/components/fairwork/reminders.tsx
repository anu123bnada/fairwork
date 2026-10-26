"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { bcp47 } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";

type Credential = { credentialId: string; status: string; expiresAt: string };
type RecruiterCheck = { verificationId: string; recruiterName: string; expiresAt: string };
const DAY = 86_400_000;
export const REMINDER_WINDOW_DAYS = 14;

// Pure helper so the rule is testable: valid credentials that end within the window, soonest first.
export function expiringCredentials(items: Credential[], now: number, windowDays = REMINDER_WINDOW_DAYS) {
  return items
    .filter(item => item.status === "valid" && Date.parse(item.expiresAt) > now && Date.parse(item.expiresAt) - now <= windowDays * DAY)
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

// Reminders are derived in the app from data the person already has; nothing is emailed or pushed (those channels are not connected).
export function Reminders() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<ReturnType<typeof expiringCredentials> | null>(null);
  const [checks, setChecks] = useState<ReturnType<typeof expiringChecks>>([]);
  const [waiting, setWaiting] = useState(0);
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
    appRequest("/api/v1/recruiter/queue").then(raw => {
      const list = (raw as { items?: { mine: unknown }[] }).items;
      if (active && Array.isArray(list)) setWaiting(list.filter(item => !item.mine).length);
    }).catch(() => { /* people who are not representatives have no queue */ });
    return () => { active = false; };
  }, []);
  const credentials = items ?? [];
  if (credentials.length === 0 && checks.length === 0 && waiting === 0) return null;
  const date = (value: string) => new Date(value).toLocaleDateString(bcp47(locale), { year: "numeric", month: "short", day: "numeric" });
  return <section className="fw-list-card" aria-label={t("reminders.title")}>
    <h3>{t("reminders.title")}</h3>
    <ul>
      {credentials.map(item => <li key={item.credentialId}>
        {t(item.daysLeft === 1 ? "reminders.expiresOne" : "reminders.expiresMany", { days: item.daysLeft, date: date(item.expiresAt) })}
      </li>)}
      {checks.map(item => <li key={item.verificationId}>
        {t(item.daysLeft === 1 ? "reminders.checkOne" : "reminders.checkMany", { name: item.recruiterName, days: item.daysLeft, date: date(item.expiresAt) })}
      </li>)}
      {waiting > 0 && <li>{t("reminders.queue", { count: waiting })}</li>}
    </ul>
    {credentials.length > 0 && <Link className="fw-secondary" href="/app/passport">{t("reminders.open")}</Link>}
    {checks.length > 0 && <Link className="fw-secondary" href="/app/check">{t("reminders.checkOpen")}</Link>}
    {waiting > 0 && <Link className="fw-secondary" href="/app/employer">{t("reminders.queueOpen")}</Link>}
  </section>;
}
