"use client";
import type { ReactNode } from "react";

// Layout only. These wrappers group the existing Check sections into a clear reading order (summary, score, risks, missing, questions, clauses, supporting
// information). They add no findings, scores or text of their own beyond the section titles.
export function CheckGroup({ id, step, title, hint, collapsible, children }: { id: string; step: number; title: string; hint?: string; collapsible?: boolean; children: ReactNode }) {
  const head = <>
    <span className="oq-ck-step" aria-hidden="true">{step}</span>
    <span className="oq-ck-titles"><h3 id={`${id}-h`}>{title}</h3>{hint && <span className="oq-ck-hint">{hint}</span>}</span>
  </>;
  if (collapsible) return <details className="oq-ck-group oq-ck-collapsible" id={id} open><summary>{head}</summary><div className="oq-ck-body">{children}</div></details>;
  return <section className="oq-ck-group" id={id} aria-labelledby={`${id}-h`}><header>{head}</header><div className="oq-ck-body">{children}</div></section>;
}

export function CheckJump({ label, items }: { label: string; items: readonly (readonly [string, string])[] }) {
  return <nav className="oq-ck-jump" aria-label={label}><ul>{items.map(([id, text]) => <li key={id}><a href={`#${id}`}>{text}</a></li>)}</ul></nav>;
}
