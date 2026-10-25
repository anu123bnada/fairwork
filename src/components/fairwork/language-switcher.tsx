"use client";
import { coverage, isLocale, LOCALES } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const stats = coverage(locale);
  return <section className="fw-list-card">
    <label className="fw-field">{t("settings.language")}
      <select value={locale} onChange={event => { if (isLocale(event.target.value)) setLocale(event.target.value); }}>
        {LOCALES.map(item => <option key={item.code} value={item.code} lang={item.code}>{item.native}{item.native !== item.english ? ` (${item.english})` : ""}{item.status === "preview" ? " — preview" : ""}</option>)}
      </select>
    </label>
    <p>{t("settings.languageHelp")}</p>
    {locale !== "en" && <p role="note">{t("language.reviewNote")} {t("language.coverageNote", { count: stats.translated })}</p>}
  </section>;
}
