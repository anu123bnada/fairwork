"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, isLocale, translate, type LocaleCode, type MessageKey } from "./index";

// Device-local language preference. Server-side persistence needs a reviewed migration because the
// profile `locale` column and identity RPCs currently accept only "en".
const STORAGE_KEY = "oryqen.locale";
const listeners = new Set<() => void>();
let memory: LocaleCode | null = null; // survives blocked or private storage for the session

function read(): LocaleCode {
  try { const stored = window.localStorage.getItem(STORAGE_KEY); if (isLocale(stored)) return stored; } catch { /* storage unavailable */ }
  return memory ?? DEFAULT_LOCALE;
}
export function setStoredLocale(locale: LocaleCode) {
  memory = locale;
  try { window.localStorage.setItem(STORAGE_KEY, locale); } catch { /* keep the in-memory choice */ }
  listeners.forEach(listener => listener());
}
function subscribe(callback: () => void) {
  listeners.add(callback); window.addEventListener("storage", callback);
  return () => { listeners.delete(callback); window.removeEventListener("storage", callback); };
}

export function useLocale(): LocaleCode {
  const locale = useSyncExternalStore(subscribe, read, () => DEFAULT_LOCALE);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return locale;
}
export function useI18n() {
  const locale = useLocale();
  // Stable per locale, so effects and callbacks that list `t` as a dependency do not re-run on every render.
  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
  return { locale, setLocale: setStoredLocale, t };
}
