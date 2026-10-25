import { de, en, si, ta, type MessageKey, type Messages } from "./messages";

export const LOCALES = [
  { code: "en", english: "English", native: "English", bcp47: "en", status: "complete" },
  { code: "si", english: "Sinhala", native: "සිංහල", bcp47: "si-LK", status: "partial" },
  { code: "ta", english: "Tamil", native: "தமிழ்", bcp47: "ta-LK", status: "partial" },
  { code: "de", english: "German", native: "Deutsch", bcp47: "de-DE", status: "preview" },
] as const;
export type LocaleCode = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: LocaleCode = "en";
export const isLocale = (value: unknown): value is LocaleCode => LOCALES.some(locale => locale.code === value);

const CATALOG: Record<LocaleCode, Partial<Messages>> = { en, si, ta, de };

// Translation with a visible, predictable fallback: a missing key never shows the key itself.
export function translate(locale: LocaleCode, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = CATALOG[locale][key] ?? en[key];
  return vars ? template.replace(/\{(\w+)\}/g, (match, name: string) => name in vars ? String(vars[name]) : match) : template;
}

// How much of the English catalog a locale actually covers. Shown to users and checked in tests,
// so coverage is never claimed beyond what exists.
export function coverage(locale: LocaleCode): { translated: number; total: number; percent: number } {
  const keys = Object.keys(en) as MessageKey[];
  const translated = locale === "en" ? keys.length : keys.filter(key => typeof CATALOG[locale][key] === "string" && CATALOG[locale][key]!.length > 0).length;
  return { translated, total: keys.length, percent: Math.round((translated / keys.length) * 100) };
}
export function untranslatedKeys(locale: LocaleCode): MessageKey[] {
  return (Object.keys(en) as MessageKey[]).filter(key => !CATALOG[locale][key]);
}
export function bcp47(locale: LocaleCode): string { return LOCALES.find(item => item.code === locale)!.bcp47; }
export type { MessageKey };
