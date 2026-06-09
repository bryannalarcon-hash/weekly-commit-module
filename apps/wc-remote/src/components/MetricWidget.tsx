// apps/wc-remote/src/components/MetricWidget.tsx — a supporting metric widget for the manager Rollup
// dashboard (brief §7). A label + a big tabular-numeral value + optional sublabel. These are SUPPORTING
// (the per-report table is the primary surface, brief §6.9) — restrained, not equal-weight hero cards.
// Pure/presentational.
export interface MetricWidgetProps {
  label: string;
  /** The headline value, already formatted (e.g. "72%" or "1,840"). */
  value: string;
  /** Optional secondary context line. */
  sublabel?: string;
  className?: string;
}

export function MetricWidget({ label, value, sublabel, className }: MetricWidgetProps): JSX.Element {
  return (
    <div
      data-testid="metric-widget"
      className={`rounded border border-slate-200 bg-white px-4 py-3 ${className ?? ''}`.trim()}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-primary-900" data-testid="metric-value">
        {value}
      </p>
      {sublabel && <p className="mt-0.5 text-xs text-slate-500">{sublabel}</p>}
    </div>
  );
}
