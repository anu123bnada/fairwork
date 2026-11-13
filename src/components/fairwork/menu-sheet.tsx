"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";

// Full-screen navigation sheet for phones. The desktop sidebar already lists every screen under "More"; on a phone that group is not shown, so this sheet
// carries the same grouped links. It only navigates: every destination still enforces its own sign-in and permission rules.
const OPEN_EVENT = "oryqen:open-menu";
export function openNavMenu() { window.dispatchEvent(new Event(OPEN_EVENT)); }

export type MenuGroup = readonly [MessageKey, readonly (readonly [string, string])[]];

export function NavMenuSheet({ groups }: { groups: readonly MenuGroup[] }) {
  const { t } = useI18n();
  // The sheet is open only for the page it was opened on, so any navigation closes it without resetting state in an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const pathname = usePathname() ?? "";
  const open = openedOn !== null && openedOn === pathname;
  const current = pathname.split("/").pop() ?? "";
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  const close = useCallback(() => { setOpenedOn(null); (opener.current as HTMLElement | null)?.focus?.(); }, []);
  useEffect(() => { const onOpen = () => { opener.current = document.activeElement; setOpenedOn(window.location.pathname); }; window.addEventListener(OPEN_EVENT, onOpen); return () => window.removeEventListener(OPEN_EVENT, onOpen); }, []);
  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("oq-sheet-open");
    panel.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = [...panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      if (focusable.length === 0) return;
      const first = focusable[0]!, last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.documentElement.classList.remove("oq-sheet-open"); };
  }, [open, close]);

  if (!open) return null;
  return <div className="oq-sheet-layer">
    <button type="button" className="oq-sheet-scrim" aria-label={t("v2.menuClose")} tabIndex={-1} onClick={close} />
    <div ref={panel} className="oq-sheet" role="dialog" aria-modal="true" aria-label={t("v2.menu")}>
      <header><h2>{t("v2.menu")}</h2><button type="button" className="oq-sheet-close" onClick={close} aria-label={t("v2.menuClose")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button></header>
      <nav aria-label={t("v2.menu")}>
        {groups.map(([group, links]) => <section key={group} aria-label={t(group)}>
          <h3>{t(group)}</h3>
          <ul>{links.map(([route, label]) => <li key={route}><Link href={`/app/${route}`} aria-current={current === route ? "page" : undefined} className={current === route ? "is-current" : undefined}>{label}</Link></li>)}</ul>
        </section>)}
      </nav>
    </div>
  </div>;
}
