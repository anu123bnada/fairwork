"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { bcp47 } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";

type Credential = { credentialId: string; status: string; expiresAt: string };
const DAY = 86_400_000;
export const REMINDER_WINDOW_DAYS = 14;

// Pure helper so the rule is testable: valid credentials that end within the window, soonest first.
export function expiringCredentials(items: Credential[], now: number, windowDays = REMINDER_WINDOW_DAYS) {
  return items
    .filter(item => item.status === "valid" && Date.parse(item.expiresAt) > now && Date.parse(item.expiresAt) - now <= windowDays * DAY)
    .map(item => ({ ...item, daysLeft: Math.max(1, Math.ceil((Date.parse(item.expiresAt) - now) / DAY)) }))
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}

// Reminders are derived in the app from data the person already has; nothing is emailed or pushed (those channels are not connected).
export function Reminders() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<ReturnType<typeof expiringCredentials> | null>(null);
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/credentials").then(raw => {
      const list = (raw as { items?: Credential[] }).items;
      if (active && Array.isArray(list)) setItems(expiringCredentials(list, Date.now()));
    }).catch(() => { /* reminders are a convenience; no reminder is better than a false one */ });
    return () => { active = false; };
  }, []);
  if (!items || items.length === 0) return null;
  return <section className="fw-list-card" aria-label={t("reminders.title")}>
    <h3>{t("reminders.title")}</h3>
    <ul>{items.map(item => <li key={item.credentialId}>
      {t(item.daysLeft === 1 ? "reminders.expiresOne" : "reminders.expiresMany", { days: item.daysLeft, date: new Date(item.expiresAt).toLocaleDateString(bcp47(locale), { year: "numeric", month: "short", day: "numeric" }) })}
    </li>)}</ul>
    <Link className="fw-secondary" href="/app/passport">{t("reminders.open")}</Link>
  </section>;
}
