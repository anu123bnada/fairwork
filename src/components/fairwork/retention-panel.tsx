"use client";
import { retentionClasses } from "@/features/privacy/retention";
import { useI18n } from "@/i18n/use-i18n";

// A plain statement of how long each kind of data is kept and who can erase it. It describes behaviour that exists in the product; it changes nothing.
export function RetentionPanel() {
  const { t } = useI18n();
  return <section aria-label={t("rt.title")}>
    <p>{t("rt.intro")}</p>
    <ul>{retentionClasses.map(item => <li key={item.id}>{t(item.key)}</li>)}</ul>
    <p>{t("rt.request")}</p>
  </section>;
}
