// apps/wc-remote/src/screens/CommitHistory.tsx — the commit history / archive (brief §6.4, U19),
// re-skinned to the WCM design handoff (prototype/wcm/page-history.jsx History). Lists the acting
// member's past weeks (getMyWeeks) newest-first as panel rows: week range, LifecycleBadge, a mono
// metric row (done/total + carried) and a right-aligned completion % with a mini progress bar +
// chevron. A pill-chip filter (All / Reconciled / Reconciling) narrows by lifecycle. Clicking a row
// opens the read-only PastCommitDetail. Loading skeleton / empty / error use the shared primitives;
// data via RTK Query (useGetMyWeeksQuery). Preserves data-testid: commit-history, history-filter,
// history-row, history-list, plus the lifecycle-badge/skeleton/empty-state/error-state primitives.
import { useMemo, useState } from 'react';
import type { LifecycleState, WeekSummary } from '@wcm/types';
import { useGetMyWeeksQuery } from '@wcm/api';
import { EmptyState, ErrorState, Icon, LifecycleBadge, Skeleton } from '@wcm/ui';
import { formatWeekRange } from '../lib/week';

/** Filter chips (design: All / Reconciled / Reconciling). Each value maps to a lifecycle predicate. */
type HistoryFilter = 'ALL' | 'RECONCILED' | 'RECONCILING';
const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'RECONCILED', label: 'Reconciled' },
  { value: 'RECONCILING', label: 'Reconciling' },
];

/** Does a week pass the chip filter? "Reconciled" includes the carry-forward terminal state. */
function matchesFilter(state: LifecycleState, filter: HistoryFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'RECONCILED') return state === 'RECONCILED' || state === 'CARRY_FORWARD';
  return state === 'RECONCILING';
}

export interface CommitHistoryProps {
  /** Open a past week's read-only detail. */
  onOpen: (commitId: string) => void;
}

export function CommitHistory({ onOpen }: CommitHistoryProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetMyWeeksQuery();
  const [filter, setFilter] = useState<HistoryFilter>('ALL');

  const weeks = useMemo<WeekSummary[]>(() => {
    const all = data ?? [];
    return all.filter((w) => matchesFilter(w.lifecycleState, filter));
  }, [data, filter]);

  return (
    <div className="page" data-testid="commit-history">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Commit history
        </h1>
        <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--ink-low)' }}>
          Past weeks, their outcomes, and carry-forward lineage.
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter by status"
        data-testid="history-filter"
        style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              data-testid={`history-filter-${f.value.toLowerCase()}`}
              data-active={active}
              aria-pressed={active}
              onClick={() => setFilter(f.value)}
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                padding: '7px 13px',
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
                border: `1px solid ${active ? 'var(--line-bright)' : 'var(--line)'}`,
                background: active ? 'var(--surface-1)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-low)',
                boxShadow: active ? 'var(--shadow-1)' : 'none',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="stack" style={{ gap: 10 }} data-testid="history-loading">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="panel" style={{ padding: 18 }}>
              <Skeleton lines={2} />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <ErrorState title="Could not load your history" onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && weeks.length === 0 && (
        <EmptyState
          icon="history"
          title={filter === 'ALL' ? 'No past weeks yet' : 'No weeks match this filter'}
          description={
            filter === 'ALL'
              ? 'Once you lock and reconcile a week, it will appear here with its completion summary.'
              : 'Try a different status filter.'
          }
        />
      )}

      {!isLoading && !isError && weeks.length > 0 && (
        <div className="stack" style={{ gap: 10 }} data-testid="history-list">
          {weeks.map((w) => (
            <HistoryRow key={w.commitId} week={w} onOpen={onOpen} />
          ))}
          <div className="between" style={{ marginTop: 6, padding: '0 4px' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-low)' }}>
              Showing {weeks.length} of {weeks.length} weeks
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface HistoryRowProps {
  week: WeekSummary;
  onOpen: (commitId: string) => void;
}

/** One past-week panel row: range + lifecycle, done/total + carried metrics, completion % + bar. */
function HistoryRow({ week, onOpen }: HistoryRowProps): JSX.Element {
  const pct = week.itemCount ? Math.round((week.completedCount / week.itemCount) * 100) : 0;
  const complete = pct === 100;
  return (
    <button
      type="button"
      data-testid="history-row"
      data-commit-id={week.commitId}
      onClick={() => onOpen(week.commitId)}
      className="panel lift"
      style={{
        padding: '16px 18px',
        textAlign: 'left',
        cursor: 'pointer',
        border: '1px solid var(--line)',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15.5, fontWeight: 700 }}>{formatWeekRange(week.weekStart)}</span>
          <LifecycleBadge state={week.lifecycleState} size="sm" />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginTop: 10,
            flexWrap: 'wrap',
          }}
        >
          <span
            className="mono tnum"
            style={{
              fontSize: 12,
              color: 'var(--ink-mid)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon.checkCircle size={13} style={{ color: 'var(--signal)' }} /> {week.completedCount}/
            {week.itemCount} done
          </span>
          {week.carriedInCount > 0 && (
            <span
              className="mono tnum"
              style={{
                fontSize: 12,
                color: 'var(--violet)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon.carry size={13} /> {week.carriedInCount} carried
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 64, textAlign: 'right' }}>
          <div
            className="tnum"
            data-testid="history-completion"
            style={{ fontSize: 19, fontWeight: 700, color: complete ? 'var(--signal)' : 'var(--ink)' }}
          >
            {pct}%
          </div>
          <div
            style={{
              height: 5,
              background: 'var(--surface-3)',
              borderRadius: 99,
              marginTop: 5,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: complete ? 'var(--signal)' : 'var(--amber)',
              }}
            />
          </div>
        </div>
        <Icon.chevR size={18} style={{ color: 'var(--ink-faint)' }} />
      </div>
    </button>
  );
}
