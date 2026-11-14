import { translate, type MessageKey } from "@/i18n";
import { readStoredLocale } from "@/i18n/use-i18n";

// People should read a sentence, not a validation dump. A reply that does not match the expected contract throws a schema error whose message is raw JSON; this turns
// that case into a plain sentence, keeps the technical detail in the browser console for support, and passes every other message through unchanged.
// It never hides a failure: the screen still shows that the action did not work.
const FALLBACK = "ORYQEN received a reply it could not read, so nothing was changed on your side. Try again. If it keeps happening, tell support.";
const unreadable = () => { const key = "v2.err.unreadable" as MessageKey; const shown = translate(readStoredLocale(), key); return shown && shown !== key ? shown : FALLBACK; };

export function isTechnicalError(caught: unknown): boolean {
  if (!(caught instanceof Error)) return false;
  const issues = (caught as { issues?: unknown }).issues;
  if (Array.isArray(issues)) return true;
  if (caught.name === "ZodError" || caught.name === "$ZodError") return true;
  // Raw JSON or a stack-like dump pasted into a message.
  return /^\s*[[{]/.test(caught.message) || /\bat\s+\S+\s+\(.+:\d+:\d+\)/.test(caught.message);
}

export function userMessage(caught: unknown, fallback?: string): string {
  if (isTechnicalError(caught)) {
    if (typeof console !== "undefined") console.warn("[oryqen] unreadable reply", (caught as { issues?: unknown }).issues ?? (caught as Error).message);
    return unreadable();
  }
  if (caught instanceof Error && caught.message.trim()) return caught.message;
  return fallback ?? unreadable();
}
