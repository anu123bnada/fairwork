"use client";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/use-i18n";

import { THEME_KEY } from "./theme-script";
const EVENT = "oryqen-appearance";
export type ThemePreference = "system" | "light" | "dark";

function read(): ThemePreference {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY) return;
    document.documentElement.dataset.theme = event.newValue === "light" || event.newValue === "dark" ? event.newValue : "system";
    callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(EVENT, callback); };
}
export function setTheme(value: ThemePreference) {
  document.documentElement.dataset.theme = value;
  try { if (value === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, value); } catch { /* The page still changes; the choice just is not remembered. */ }
  window.dispatchEvent(new Event(EVENT));
}
export function useTheme() {
  return useSyncExternalStore(subscribe, read, () => "system" as ThemePreference);
}

// Three real choices, one tap each. System follows the device until the person picks a side.
export function ThemeToggle() {
  const { t } = useI18n();
  const preference = useTheme();
  const options: [ThemePreference, string, string][] = [["system", "◐", t("theme.system")], ["light", "☀", t("theme.light")], ["dark", "☾", t("theme.dark")]];
  return <div className="oq-seg oq-theme-toggle" role="group" aria-label={t("theme.label")}>
    {options.map(([value, glyph, label]) => <button type="button" key={value} aria-pressed={preference === value} aria-label={label} title={label} onClick={() => setTheme(value)}><span aria-hidden>{glyph}</span></button>)}
  </div>;
}
