// libs/ui/src/Metric.tsx — the tinted metric tile for the manager dashboard (brief §7), re-skinned to
// the WCM design (prototype/wcm/ui.jsx Metric): an uppercase kicker label, a large tabular-numeral value
// with an optional suffix, and an optional delta chip (▲ green / ▼ red / no-arrow neutral). When `tint`
// is set the tile fills with the family tint + a left accent bar; otherwise it's a plain surface card.
// `.panel .lift` give it elevation + the hover-raise. Pure/presentational. data-testid=metric +
// metric-value (the delta carries data-testid=metric-delta).
import type { ReactNode } from 'react';

export interface MetricProps {
  label: string;
  /** Headline value (formatted by the caller, e.g. "78" or "1,840"). */
  value: ReactNode;
  /** Small trailing unit shown inside the value (e.g. "%"). */
  suffix?: string;
  /** Signed change vs. the prior period; sign chooses the arrow + color. Omit for no delta chip. */
  delta?: number | null;
  /** Delta unit label (default "pts"). */
  deltaUnit?: string;
  /** Accent color (CSS-var string) for the value + the left bar when tinted. Default --ink. */
  accent?: string;
  /** Family tint fill (CSS-var string, e.g. var(--signal-dim)); enables the left accent bar. */
  tint?: string;
  className?: string;
}

export function Metric({
  label,
  value,
  suffix,
  delta,
  deltaUnit = 'pts',
  accent = 'var(--ink)',
  tint,
  className,
}: MetricProps): JSX.Element {
  const hasDelta = delta !== undefined && delta !== null;
  const deltaColor =
    hasDelta && delta > 0
      ? 'var(--signal)'
      : hasDelta && delta < 0
        ? 'var(--red)'
        : 'var(--ink-low)';
  return (
    <div
      data-testid="metric"
      className={`panel lift ${className ?? ''}`.trim()}
      style={{
        padding: '16px 18px',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--r-md)',
        background: tint ?? 'var(--surface-1)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-1)',
        borderLeft: tint ? `3px solid ${accent}` : undefined,
      }}
    >
      <div className="kicker" style={{ marginBottom: 10, color: tint ? 'var(--ink-mid)' : 'var(--ink-low)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          className="tnum"
          data-testid="metric-value"
          style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: accent, lineHeight: 1 }}
        >
          {value}
          {suffix && <span style={{ fontSize: 16, color: 'var(--ink-low)' }}>{suffix}</span>}
        </span>
        {hasDelta && (
          <span
            className="mono tnum"
            data-testid="metric-delta"
            style={{ fontSize: 11, fontWeight: 600, color: deltaColor }}
          >
            {delta > 0 ? '▲' : delta < 0 ? '▼' : ''} {Math.abs(delta)}
            {deltaUnit}
          </span>
        )}
      </div>
    </div>
  );
}
