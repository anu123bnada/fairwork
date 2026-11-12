"use client";
import Link from "next/link";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import { openCommandPalette } from "./command-palette";
import "./first-steps.css";

// Screens that open with one plain sentence about what they are for, and three short steps. The text describes what the screen already does; it adds no feature and no claim.
const GUIDED = new Set(["add-offer", "check", "scan", "agreement-workflow", "work-record", "cases", "passport", "opportunities", "applications", "interviews", "cv", "cover-letter", "portfolio",
  "career-explorer", "career-assistant", "workroom", "salary", "applicants", "employers-demo", "guidance", "help", "demo"]);

export function ScreenIntro({ screen }: { screen: string }) {
  const { t } = useI18n();
  if (!GUIDED.has(screen)) return null;
  const key = (suffix: string) => `sg.${screen}.${suffix}` as MessageKey;
  return <div className="oq-intro" role="note" aria-label={t("sg.aria")}>
    <span className="oq-intro-mark" aria-hidden="true">i</span>
    <div>
      <p className="oq-intro-what">{t(key("what"))}</p>
      <details className="oq-intro-how"><summary>{t("sg.how")}</summary>
        <ol>{(["s1", "s2", "s3"] as const).map(step => <li key={step}>{t(key(step))}</li>)}</ol>
      </details>
    </div>
  </div>;
}

const PATHS = { offer: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6", jobs: "M4 8h16v11H4zM9 8V5h6v3M4 13h16", track: "M5 6h14M5 12h14M5 18h9M19 16l-2 2-1-1",
  cv: "M7 3h10v18H7zM10 8h4M10 12h4M10 16h2", work: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", ask: "M5 5h14v10H10l-5 4z" } as const;
const TILES = [["offer", "/app/add-offer"], ["jobs", "/app/opportunities"], ["track", "/app/applications"], ["cv", "/app/cv"], ["work", "/app/work-record"], ["ask", "/app/career-assistant"]] as const;

// The first thing on Home: six plain tasks, each a link to a screen that already exists.
export function StartHere() {
  const { t } = useI18n();
  return <section className="oq-start" aria-label={t("start.aria")}>
    <h3>{t("start.title")}</h3>
    <p className="oq-start-sub">{t("start.sub")}</p>
    <ul className="oq-start-grid">
      {TILES.map(([id, href]) => <li key={id}><Link className="oq-start-tile" href={href}>
        <span className="oq-start-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={PATHS[id]} /></svg></span>
        <span className="oq-start-text"><strong>{t(`start.${id}` as MessageKey)}</strong><small>{t(`start.${id}Body` as MessageKey)}</small></span>
        <span className="oq-start-go" aria-hidden="true">→</span>
      </Link></li>)}
    </ul>
    <button type="button" className="oq-start-search" onClick={openCommandPalette}>{t("start.search")}</button>
  </section>;
}
