"use client";
import type { ReactNode } from "react";

// Small presentational pieces for result screens. They hold no analysis logic: callers pass in text that the engines already produced.
export function StatTile({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "neutral" | "attention" | "ok" }) {
  return <li className="oq-stat" data-tone={tone}>
    <span className="oq-stat-label">{label}</span>
    <strong className="oq-stat-value">{value}</strong>
    {hint ? <span className="oq-stat-hint">{hint}</span> : null}
  </li>;
}

export function ResultSection({ id, letter, title, count, intro, children, empty, hideCount = false }: { id: string; letter: string; title: string; count: number; intro?: string; children?: ReactNode; empty?: string; hideCount?: boolean }) {
  return <section className="oq-result-section" id={id} aria-labelledby={`${id}-h`}>
    <header>
      <span className="oq-result-letter" aria-hidden="true">{letter}</span>
      <h3 id={`${id}-h`}>{title}</h3>
      {hideCount ? null : <span className="oq-result-count" aria-label={`${count}`}>{count}</span>}
    </header>
    {intro ? <p className="oq-result-intro">{intro}</p> : null}
    {count === 0 && empty ? <p className="oq-result-empty">{empty}</p> : null}
    {children}
  </section>;
}

// One finding. The title and one-line explanation are always visible; the quoted text, why it matters and what to do sit in a collapsible so a first-time reader is not faced with a wall of text.
export function Finding({ title, badge, severity, summary, quote, why, todo, whyLabel, todoLabel, quoteLabel }: {
  title: string; badge?: string; severity?: "high" | "medium" | "low" | "info"; summary: string; quote?: string; why?: string; todo?: string; whyLabel: string; todoLabel: string; quoteLabel: string;
}) {
  return <article className="oq-finding" data-severity={severity ?? "info"}>
    <div className="oq-finding-head"><strong>{title}</strong>{badge ? <span className="oq-badge" data-severity={severity ?? "info"}>{badge}</span> : null}</div>
    <p className="oq-finding-summary">{summary}</p>
    {quote ? <blockquote className="oq-finding-quote"><span className="oq-quote-label">{quoteLabel}</span> {quote}</blockquote> : null}
    {why || todo ? <details className="oq-finding-more">
      <summary>{why && todo ? `${whyLabel} / ${todoLabel}` : why ? whyLabel : todoLabel}</summary>
      {why ? <p><strong>{whyLabel}:</strong> {why}</p> : null}
      {todo ? <p><strong>{todoLabel}:</strong> {todo}</p> : null}
    </details> : null}
  </article>;
}
