"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listRecordsOf } from "@/features/records/client";
import { scheduleReminders, type Reminder } from "@/features/records/reminders";
import { useI18n } from "@/i18n/use-i18n";
import "./records.css";

// Reminders from the person's own Application tracker, shown above the notification feed. Derived each time from their records, never sent anywhere, and never contacting an employer.
export function ScheduleReminders() {
  const { t } = useI18n();
  const [items, setItems] = useState<Reminder[] | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try { const list = await listRecordsOf("application"); if (live) setItems(scheduleReminders(list, new Date().toISOString().slice(0, 10))); }
      catch { if (live) setFailed(true); }
    })();
    return () => { live = false; };
  }, []);
  if (failed) return <p role="status" className="oq-rec-group">{t("rem.loadError")}</p>;
  if (!items || items.length === 0) return null;
  return <section className="oq-rec-group" aria-label={t("rem.aria")}>
    <h3>{t("rem.title")}</h3>
    <ul aria-label={t("rem.listAria")}>{items.map(item => <li key={`${item.id}-${item.kind}`}>
      <strong>{item.title}</strong>: {item.kind === "today" ? t("rem.today", { at: item.at.replace("T", " ") }) : item.kind === "soon" ? t("rem.soon", { days: item.days, at: item.at.replace("T", " ") }) : item.kind === "overdue_next_step" ? t("rem.overdue", { days: item.days }) : t("rem.noReply", { days: item.days })}
    </li>)}</ul>
    <Link href="/app/applications">{t("rem.open")}</Link>
    <p className="fw-notice">{t("rem.note")}</p>
  </section>;
}
