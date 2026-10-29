import type { ReactNode } from "react";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "violet";

// A status is always words plus a dot: colour is never the only signal.
export function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className="oq-badge" data-tone={tone}>{children}</span>;
}

// An empty state names what is missing and offers the next real action.
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <section className="oq-empty"><h3>{title}</h3>{children && <p>{children}</p>}{action}</section>;
}

export function Skeleton({ width = "100%", height = 14, label }: { width?: number | string; height?: number | string; label?: string }) {
  return <span className="oq-skel" style={{ width, height }} role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

// Real ratio only: the caller passes counts it actually has. The centre shows the same numbers as text.
export function ProgressRing({ value, max, label, size = 88 }: { value: number; max: number; label: string; size?: number }) {
  const stroke = 9, radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const gradientId = `oq-ring-${size}`;
  return <span className="oq-ring" role="img" aria-label={`${label}: ${value} / ${max}`} style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2667ff" /><stop offset="1" stopColor="#6d45f5" /></linearGradient></defs>
      <circle className="oq-ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
      <circle className="oq-ring-fill" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} stroke={`url(#${gradientId})`} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ratio)} />
    </svg>
    <span className="oq-ring-label" aria-hidden>{value}<small>/ {max}</small></span>
  </span>;
}
