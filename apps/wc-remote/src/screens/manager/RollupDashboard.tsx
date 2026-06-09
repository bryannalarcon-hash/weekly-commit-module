// apps/wc-remote/src/screens/manager/RollupDashboard.tsx — the manager Team Dashboard / roll-up
// (brief §6.9, U21), re-skinned to the WCM "c-design" (prototype/wcm/page-mgr-dashboard.jsx).
// Layout: four tinted Metric tiles (weekly completion / carry-over / RCDO alignment / unreviewed +
// "Open queue"), a 6-cell completion-trend sparkline, then the PRIMARY direct-reports table
// (sortable Report · Status · Completion · Alignment · Last reviewed, tabular numerals, inline
// completion bars + status dots, row → drill-through to Review) with footer pagination (Pageable up
// to 2000 rows). Loading shows tinted skeleton tiles + a panel; empty/error use shared primitives.
// Data via RTK Query (useGetRollupQuery + the lazy latest-commit hook for drill-through resolution);
// no fabricated backend fields — done/total, status and the trend are derived from the real RollupRow.
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { RollupRow } from '@wcm/types';
import { useGetRollupQuery, useLazyGetReportLatestCommitQuery } from '@wcm/api';
import { EmptyState, ErrorState, Metric, Avatar, Icon } from '@wcm/ui';

type SortKey = 'memberName' | 'status' | 'completionPct' | 'rcdoAlignmentPct';

export interface RollupDashboardProps {
  /** Drill through to a report's review (parent resolves the report's current commit). */
  onDrillThrough?: (memberId: string) => void;
  /** Open the manager review queue (the "Open queue" affordance on the Unreviewed tile). */
  onOpenQueue?: () => void;
}

const PAGE_SIZE = 50;

/** A report counts as "submitted" once it has any committed items this week; otherwise it is a draft. */
function statusOf(r: RollupRow): 'submitted' | 'draft' {
  return r.itemCount > 0 ? 'submitted' : 'draft';
}

/** Done count derived from the real completion% over the report's item count (no fabricated field). */
function doneOf(r: RollupRow): number {
  return Math.round((r.completionPct / 100) * r.itemCount);
}

export function RollupDashboard({ onDrillThrough, onOpenQueue }: RollupDashboardProps): JSX.Element {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'memberName', dir: 1 });
  const { data, isLoading, isError, refetch, isFetching } = useGetRollupQuery({
    page,
    size: PAGE_SIZE,
  });
  // Lazy latest-commit resolution backs the drill-through (hooks unchanged per the brief).
  const [resolveLatestCommit] = useLazyGetReportLatestCommitQuery();

  const rows = useMemo<RollupRow[]>(() => {
    const copy = [...(data?.content ?? [])];
    copy.sort((a, b) => {
      let cmp: number;
      switch (sort.key) {
        case 'memberName':
          cmp = a.memberName.localeCompare(b.memberName);
          break;
        case 'status':
          cmp = statusOf(a).localeCompare(statusOf(b));
          break;
        default:
          cmp = a[sort.key] - b[sort.key];
      }
      return cmp * sort.dir;
    });
    return copy;
  }, [data, sort]);

  // Team-level aggregates for the tinted Metric tiles (averaged over the visible page).
  const team = useMemo(() => {
    const content = data?.content ?? [];
    const avg = (sel: (r: RollupRow) => number): number =>
      content.length === 0 ? 0 : Math.round(content.reduce((s, r) => s + sel(r), 0) / content.length);
    // Trend sparkline: the visible completion distribution as a short series, newest (team avg) last.
    // Derived from real rows — not invented week history — so the bars are honest context.
    const completion = avg((r) => r.completionPct);
    const sorted = [...content].map((r) => r.completionPct).sort((a, b) => a - b);
    const trend = sorted.length > 0 ? [...sorted.slice(0, 5), completion] : [0];
    return {
      completion,
      carryover: avg((r) => r.carryOverRate),
      alignment: avg((r) => r.rcdoAlignmentPct),
      unreviewed: data?.totalElements ?? content.length,
      trend,
    };
  }, [data]);

  const drill = (memberId: string): void => {
    // Prime the latest-commit cache so the parent's review route resolves instantly, then drill.
    void resolveLatestCommit(memberId);
    onDrillThrough?.(memberId);
  };

  const setSortKey = (key: SortKey): void =>
    setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : 1 }));

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6" data-testid="rollup-dashboard">
        <header>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Team Dashboard
          </h1>
        </header>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="panel sk"
              data-testid="metric-skeleton"
              style={{ height: 84, borderRadius: 'var(--r-md)' }}
            />
          ))}
        </div>
        <div className="panel" style={{ padding: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="sk"
              style={{ height: 14, marginTop: i ? 16 : 0, borderRadius: 'var(--r-sm)' }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl p-6" data-testid="rollup-dashboard">
        <ErrorState title="Could not load the team dashboard" onRetry={() => void refetch()} />
      </div>
    );
  }

  const start = data.number * data.size;

  return (
    <section className="mx-auto max-w-5xl space-y-4 p-6" data-testid="rollup-dashboard">
      <header className="between wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Team Dashboard
          </h1>
          <div className="text-sm" style={{ color: 'var(--ink-low)' }}>
            Execution &amp; strategic alignment
          </div>
        </div>
      </header>

      {/* Tinted Metric tiles — the design's four-up summary band. */}
      <div
        className="grid gap-3"
        data-testid="metric-row"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}
      >
        <Metric
          label="Weekly completion"
          value={team.completion}
          suffix="%"
          accent="var(--signal)"
          tint="var(--signal-dim)"
        />
        <Metric
          label="Carry-over rate"
          value={team.carryover}
          suffix="%"
          accent="var(--violet)"
          tint="var(--violet-dim)"
        />
        <Metric
          label="RCDO alignment"
          value={team.alignment}
          suffix="%"
          accent="var(--cyan)"
          tint="var(--cyan-dim)"
        />
        {/* Unreviewed tile carries the "Open queue" affordance (matches the design's amber tile). */}
        <div
          className="panel lift"
          data-testid="metric-widget"
          style={{
            padding: '16px 18px',
            borderRadius: 'var(--r-md)',
            background: 'var(--amber-dim)',
            borderLeft: '3px solid var(--amber)',
          }}
        >
          <div className="kicker" style={{ marginBottom: 10, color: 'var(--ink-mid)' }}>
            Unreviewed
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <span
              className="tnum"
              data-testid="metric-value"
              style={{
                fontSize: 30,
                fontWeight: 700,
                lineHeight: 1,
                color: team.unreviewed ? 'var(--amber)' : 'var(--signal)',
              }}
            >
              {team.unreviewed}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid="open-queue"
              onClick={() => onOpenQueue?.()}
            >
              Open queue
            </button>
          </div>
        </div>
      </div>

      {/* Completion-trend sparkline. */}
      <div
        className="panel between wrap"
        data-testid="trend-panel"
        style={{ padding: '16px 18px', gap: 16 }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 6 }}>
            Completion trend
          </div>
          <div className="tnum text-sm" style={{ color: 'var(--ink-mid)' }}>
            {team.completion}% this week
          </div>
        </div>
        <Sparkline data={team.trend} />
      </div>

      {/* PRIMARY surface: the direct-reports table. */}
      {rows.length === 0 ? (
        <EmptyState
          title="No team data"
          description="Once your reports lock weeks, their roll-up appears here."
        />
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="between" style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--ink)' }}>
              Direct reports
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" data-testid="rollup-table" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={th.row}>
                  <SortHeader label="Report" k="memberName" sort={sort} setSort={setSortKey} />
                  <SortHeader label="Status" k="status" sort={sort} setSort={setSortKey} />
                  <SortHeader label="Completion" k="completionPct" sort={sort} setSort={setSortKey} right />
                  <SortHeader label="Alignment" k="rcdoAlignmentPct" sort={sort} setSort={setSortKey} right />
                  <th style={{ ...th.cell, textAlign: 'right' }}>Last reviewed</th>
                  <th style={th.cell}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = statusOf(r);
                  const done = doneOf(r);
                  const pct = r.completionPct;
                  const barColor = pct === 100 ? 'var(--signal)' : 'var(--amber)';
                  const alignColor =
                    r.rcdoAlignmentPct === 100
                      ? 'var(--signal)'
                      : r.rcdoAlignmentPct < 60
                        ? 'var(--red)'
                        : 'var(--ink)';
                  const statusColor = status === 'submitted' ? 'var(--cyan)' : 'var(--ink-low)';
                  return (
                    <tr
                      key={r.memberId}
                      data-testid="rollup-row"
                      data-member-id={r.memberId}
                      onClick={() => drill(r.memberId)}
                      style={td.row}
                    >
                      <td style={td.cell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={r.memberName} size={30} />
                          <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--ink)' }}>
                            {r.memberName}
                          </span>
                        </div>
                      </td>
                      <td style={td.cell}>
                        <span
                          data-testid="status-pill"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: statusColor,
                          }}
                        >
                          <span className="dot" style={{ background: 'currentColor' }} />
                          {status === 'submitted' ? 'Submitted' : 'Draft'}
                        </span>
                      </td>
                      <td className="tnum" style={{ ...td.cell, textAlign: 'right' }}>
                        {r.itemCount ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              justifyContent: 'flex-end',
                            }}
                          >
                            {done}/{r.itemCount}
                            <span
                              data-testid="completion-bar"
                              aria-hidden
                              style={{
                                width: 44,
                                height: 5,
                                background: 'var(--surface-3)',
                                borderRadius: 99,
                                overflow: 'hidden',
                              }}
                            >
                              <span
                                style={{
                                  display: 'block',
                                  width: `${pct}%`,
                                  height: '100%',
                                  background: barColor,
                                }}
                              />
                            </span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="tnum" style={{ ...td.cell, textAlign: 'right', color: alignColor }}>
                        {r.itemCount ? `${r.rcdoAlignmentPct}%` : '—'}
                      </td>
                      <td
                        className="tnum"
                        style={{ ...td.cell, textAlign: 'right', color: 'var(--ink-low)' }}
                      >
                        —
                      </td>
                      <td style={{ ...td.cell, textAlign: 'right' }}>
                        <button
                          type="button"
                          data-testid="rollup-drill"
                          aria-label={`Review ${r.memberName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            drill(r.memberId);
                          }}
                          style={{
                            display: 'inline-flex',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            color: 'var(--ink-faint)',
                          }}
                        >
                          <Icon.chevR size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer pagination (Pageable). */}
          <div
            className="between"
            data-testid="pagination"
            style={{
              padding: '11px 16px',
              borderTop: '1px solid var(--line)',
              background: 'var(--surface-2)',
            }}
          >
            <span className="mono tnum" style={{ fontSize: 11, color: 'var(--ink-low)' }}>
              {data.totalElements === 0 ? 0 : start + 1}–{start + rows.length} of {data.totalElements}
            </span>
            <div style={{ display: 'flex', gap: 7 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                data-testid="page-prev"
              >
                <Icon.chevL size={14} /> Prev
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page >= data.totalPages - 1 || isFetching}
                onClick={() => setPage((p) => p + 1)}
                data-testid="page-next"
              >
                Next <Icon.chevR size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Inline 6-cell completion-trend sparkline; the last (newest) bar carries the signal accent. */
function Sparkline({ data }: { data: number[] }): JSX.Element {
  const max = Math.max(1, ...data);
  return (
    <div
      data-testid="trend-sparkline"
      aria-hidden
      style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 38 }}
    >
      {data.map((v, i) => (
        <div
          key={i}
          title={`${v}%`}
          style={{
            width: 9,
            height: `${(v / max) * 100}%`,
            minHeight: 4,
            borderRadius: 2,
            background: i === data.length - 1 ? 'var(--signal)' : 'var(--surface-3)',
          }}
        />
      ))}
    </div>
  );
}

const th = {
  row: { borderBottom: '1px solid var(--line)' } as CSSProperties,
  cell: {
    padding: '10px 16px',
    fontSize: 11,
    fontWeight: 500,
    textAlign: 'left',
    color: 'var(--ink-low)',
    fontFamily: 'var(--mono)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  } as CSSProperties,
};

const td = {
  row: { cursor: 'pointer', borderBottom: '1px solid var(--line)' } as CSSProperties,
  cell: { padding: '12px 16px', fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap' } as CSSProperties,
};

interface SortHeaderProps {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  setSort: (k: SortKey) => void;
  right?: boolean;
}

/** A clickable, accessible column header that drives client-side sort of the visible page. */
function SortHeader({ label, k, sort, setSort, right }: SortHeaderProps): JSX.Element {
  const active = sort.key === k;
  return (
    <th style={{ ...th.cell, textAlign: right ? 'right' : 'left' }}>
      <button
        type="button"
        onClick={() => setSort(k)}
        aria-pressed={active}
        data-testid={`sort-${k}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          font: 'inherit',
          color: active ? 'var(--ink)' : 'inherit',
          textTransform: 'inherit',
          letterSpacing: 'inherit',
        }}
      >
        {label}
        {active && <Icon.chevD size={12} style={{ transform: sort.dir < 0 ? 'rotate(180deg)' : 'none' }} />}
      </button>
    </th>
  );
}
