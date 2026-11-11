"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { destinations, searchDestinations, type RankedDestination } from "@/features/navigation/destinations";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./motion.css";

const OPEN_EVENT = "oryqen:command-palette";
// Any button can open the palette without sharing state with it.
export function openCommandPalette() { window.dispatchEvent(new Event(OPEN_EVENT)); }

// Command palette: one keyboard shortcut (Ctrl or Cmd + K) to reach every feature. It only navigates to screens that already exist; each screen still enforces its own sign-in and
// permission rules, so the palette grants nothing. Fully keyboard operable: type to filter, arrow keys to move, Enter to go, Escape to close.
export function CommandPalette() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null), opener = useRef<Element | null>(null);
  const listId = useId();
  const all: RankedDestination[] = useMemo(() => destinations.map(item => ({ ...item, text: t(item.label) })), [t]);
  const results = useMemo(() => searchDestinations(all, query), [all, query]);
  const current = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    const show = () => { opener.current = document.activeElement; setQuery(""); setActive(0); setOpen(true); };
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); show(); } };
    window.addEventListener("keydown", onKey); window.addEventListener(OPEN_EVENT, show);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_EVENT, show); };
  }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  if (!open) return null;
  const close = () => { setOpen(false); if (opener.current instanceof HTMLElement) opener.current.focus(); };
  const go = (item: RankedDestination | undefined) => { if (!item) return; setOpen(false); router.push(item.href); };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setActive(results.length ? (current + 1) % results.length : 0); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(results.length ? (current - 1 + results.length) % results.length : 0); }
    else if (event.key === "Enter") { event.preventDefault(); go(results[current]); }
    else if (event.key === "Tab") { event.preventDefault(); }
  };
  return <div className="oq-palette-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="oq-palette" role="dialog" aria-modal="true" aria-label={t("cp.title")} onKeyDown={onKeyDown}>
      <label className="oq-palette-search">
        <span className="oq-palette-label">{t("cp.label")}</span>
        <input ref={input} type="text" role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={results[current] ? `${listId}-${current}` : undefined}
          placeholder={t("cp.placeholder")} value={query} maxLength={60} autoComplete="off" spellCheck={false} onChange={event => { setQuery(event.target.value); setActive(0); }} />
      </label>
      <ul id={listId} role="listbox" aria-label={t("cp.results")} className="oq-palette-list">
        {results.map((item, index) => <li key={item.href} id={`${listId}-${index}`} role="option" aria-selected={index === current} className={index === current ? "is-active" : undefined}
          onMouseEnter={() => setActive(index)} onMouseDown={event => { event.preventDefault(); go(item); }}>
          <span>{item.text}</span><small>{t(`cp.group.${item.group}` as MessageKey)}</small>
        </li>)}
      </ul>
      {results.length === 0 && <p className="oq-palette-empty" role="status">{t("cp.none")}</p>}
      <p className="oq-palette-hint">{t("cp.hint")}</p>
    </div>
  </div>;
}
