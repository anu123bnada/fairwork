"use client";
import type { ReactNode } from "react";

// Chart primitives for ORYQEN. Pure SVG, no dependency, driven only by the numbers passed in: nothing here estimates, smooths or invents a value.
// Every chart carries a text alternative (a visually hidden table) so the same facts reach keyboard and screen-reader users.
export type ChartTone = 1 | 2 | 3 | 4 | 5;

export type DonutSegment = { key: string; label: string; value: number; tone: ChartTone };

export function Donut({ segments, centerValue, centerLabel, ariaLabel }: { segments: DonutSegment[]; centerValue: ReactNode; centerLabel: string; ariaLabel: string }) {
  const shown = segments.filter(segment => segment.value > 0);
  const total = shown.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 44, circumference = 2 * Math.PI * radius, gap = shown.length > 1 ? 3 : 0;
  const starts = shown.map((_, index) => shown.slice(0, index).reduce((sum, item) => sum + item.value, 0));
  return <div className="oq-donut">
    <svg viewBox="0 0 120 120" role="img" aria-label={ariaLabel} className="oq-donut-svg">
      <circle cx="60" cy="60" r={radius} className="oq-donut-track" />
      {shown.map((segment, index) => {
        const length = Math.max(0, (segment.value / total) * circumference - gap);
        return <circle key={segment.key} cx="60" cy="60" r={radius} className={`oq-donut-seg tone-${segment.tone}`} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-(starts[index]! / total) * circumference} transform="rotate(-90 60 60)"><title>{`${segment.label}: ${segment.value}`}</title></circle>;
      })}
      <text x="60" y="58" textAnchor="middle" className="oq-donut-value">{centerValue}</text>
      <text x="60" y="76" textAnchor="middle" className="oq-donut-label">{centerLabel}</text>
    </svg>
    <ul className="oq-legend">
      {shown.map(segment => <li key={segment.key}><i className={`tone-${segment.tone}`} aria-hidden="true" /><span>{segment.label}</span><b>{segment.value}</b></li>)}
    </ul>
    <table className="oq-sr-only"><caption>{ariaLabel}</caption><tbody>{shown.map(segment => <tr key={segment.key}><th scope="row">{segment.label}</th><td>{segment.value}</td></tr>)}</tbody></table>
  </div>;
}

export type Bar = { key: string; label: string; primary: number; secondary: number; title: string };

// Stacked columns: `primary` (solid) and `secondary` (outlined). The scale always starts at zero and ends at a rounded value at or above the largest column.
export function StackedBars({ bars, unit, primaryName, secondaryName, ariaLabel }: { bars: Bar[]; unit: string; primaryName: string; secondaryName: string; ariaLabel: string }) {
  const peak = Math.max(1, ...bars.map(bar => bar.primary + bar.secondary));
  const step = niceStep(peak / 3), top = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const width = 560, height = 220, left = 40, right = 8, base = 186, plot = base - 14;
  const slot = (width - left - right) / Math.max(1, bars.length), barWidth = Math.min(44, slot * 0.56);
  const y = (value: number) => base - (value / top) * plot;
  return <div className="oq-bars-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="oq-bars-svg" preserveAspectRatio="xMidYMid meet">
      {ticks.map(tick => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "oq-axis" : "oq-grid"} /><text x={left - 8} y={y(tick) + 4} textAnchor="end" className="oq-tick">{tick}</text></g>)}
      {bars.map((bar, index) => {
        const cx = left + slot * index + slot / 2, x = cx - barWidth / 2;
        const primaryHeight = (bar.primary / top) * plot, secondaryHeight = (bar.secondary / top) * plot;
        return <g key={bar.key} className="oq-bar">
          <title>{bar.title}</title>
          {bar.secondary > 0 && <rect x={x} y={y(bar.primary + bar.secondary)} width={barWidth} height={secondaryHeight} rx="6" className="oq-bar-secondary" />}
          {bar.primary > 0 && <rect x={x} y={y(bar.primary)} width={barWidth} height={primaryHeight} rx="6" className="oq-bar-primary" />}
          <text x={cx} y={base + 18} textAnchor="middle" className="oq-tick">{bar.label}</text>
        </g>;
      })}
    </svg>
    <ul className="oq-legend oq-legend-inline"><li><i className="tone-1" aria-hidden="true" /><span>{primaryName}</span></li><li><i className="tone-outline" aria-hidden="true" /><span>{secondaryName}</span></li><li className="oq-unit">{unit}</li></ul>
    <table className="oq-sr-only"><caption>{ariaLabel}</caption><thead><tr><th scope="col">{ariaLabel}</th><th scope="col">{primaryName}</th><th scope="col">{secondaryName}</th></tr></thead>
      <tbody>{bars.map(bar => <tr key={bar.key}><th scope="row">{bar.label}</th><td>{bar.primary}</td><td>{bar.secondary}</td></tr>)}</tbody></table>
  </div>;
}

function niceStep(raw: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const normalized = raw / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
}

// A single completion ring: `value` out of `total`. Used only for ratios that exist in the person's own records.
export function Ring({ value, total, label, ariaLabel }: { value: number; total: number; label: string; ariaLabel: string }) {
  const radius = 40, circumference = 2 * Math.PI * radius, share = total > 0 ? Math.min(1, value / total) : 0;
  return <svg viewBox="0 0 100 100" role="img" aria-label={ariaLabel} className="oq-ring">
    <circle cx="50" cy="50" r={radius} className="oq-donut-track" />
    <circle cx="50" cy="50" r={radius} className="oq-ring-fill" strokeDasharray={`${share * circumference} ${circumference}`} transform="rotate(-90 50 50)" />
    <text x="50" y="52" textAnchor="middle" className="oq-donut-value">{value}/{total}</text>
    <text x="50" y="68" textAnchor="middle" className="oq-donut-label">{label}</text>
  </svg>;
}
