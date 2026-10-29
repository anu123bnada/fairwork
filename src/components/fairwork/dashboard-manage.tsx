"use client";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./dashboard-manage.css";

const TABS = [["offers", "dash.manageOffers"], ["records", "dash.manageRecords"], ["research", "dash.manageResearch"]] as const;
type Tab = (typeof TABS)[number][0];

// One work area instead of three stacked cards. Every panel stays mounted (hidden when inactive), so a search, a half-typed query or a
// loaded list is never lost by switching tabs. Arrow keys, Home and End move between tabs as in a native tab set.
export function DashboardManage({ offers, records, research }: { offers: ReactNode; records: ReactNode; research: ReactNode }) {
  const { t } = useI18n();
  const [active, setActive] = useState<Tab>("offers");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panels: Record<Tab, ReactNode> = { offers, records, research };
  function onKey(event: KeyboardEvent, index: number) {
    const last = TABS.length - 1;
    const next = event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    const [id] = TABS[next]!;
    setActive(id);
    refs.current[id]?.focus();
  }
  return <section className="oq-manage" aria-label={t("dash.manage")}>
    <div className="oq-manage-tabs" role="tablist" aria-label={t("dash.manage")}>
      {TABS.map(([id, label], index) => <button key={id} type="button" role="tab" id={`oq-tab-${id}`} aria-selected={active === id} aria-controls={`oq-panel-${id}`} tabIndex={active === id ? 0 : -1}
        ref={node => { refs.current[id] = node; }} onClick={() => setActive(id)} onKeyDown={event => onKey(event, index)}>{t(label as MessageKey)}</button>)}
    </div>
    {TABS.map(([id]) => <div key={id} role="tabpanel" id={`oq-panel-${id}`} aria-labelledby={`oq-tab-${id}`} hidden={active !== id}>{panels[id]}</div>)}
  </section>;
}
