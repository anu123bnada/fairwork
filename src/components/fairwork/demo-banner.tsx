"use client";
import { useI18n } from "@/i18n/use-i18n";
import "./records.css";

// A visible reminder on screens that use sample data. Screens that are entirely sample get the strong banner; screens that hold the person's own records (which may include
// records marked (DEMO)) get a short note. The person's own records are never marked by this app.
const sampleScreens = new Set(["career-explorer", "career-assistant", "employers-demo", "demo"]);
const mixedScreens = new Set(["applications", "interviews", "workroom", "cover-letter", "portfolio"]);

export function DemoBanner({ screen }: { screen: string }) {
  const { t } = useI18n();
  if (sampleScreens.has(screen)) return <p className="oq-demo-banner" role="note" data-demo="sample"><strong>{t("db.label")}</strong> {t("db.sample")}</p>;
  if (mixedScreens.has(screen)) return <p className="oq-demo-banner oq-demo-banner-soft" role="note" data-demo="mixed"><strong>{t("db.label")}</strong> {t("db.mixed")}</p>;
  return null;
}
