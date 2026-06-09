// apps/wc-remote/src/screens/CommitHistory.tsx — the commit history / archive (brief §6.4, U19).
// Lists the acting member's past weeks (getMyWeeks) newest-first with a lifecycle badge, completion
// summary ("4 of 5 done"), and carried-forward lineage, with a state filter. Clicking a row opens the
// read-only PastCommitDetail. Loading/empty/error use the shared primitives; data via RTK Query.
import { useMemo, useState } from 'react';
import { Badge, Select } from 'flowbite-react';
import type { LifecycleState, WeekSummary } from '@wcm/types';
import { useGetMyWeeksQuery } from '@wcm/api';
import { EmptyState, ErrorState, LifecycleBadge, Skeleton } from '@wcm/ui';
import { formatProgress, formatWeekRange } from '../lib/week';

const STATE_FILTERS: { value: 'ALL' | LifecycleState; label: string }[] = [
  { value: 'ALL', label: 'All weeks' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'RECONCILING', label: 'Reconciling' },
  { value: 'RECONCILED', label: 'Reconciled' },
  { value: 'CARRY_FORWARD', label: 'Carried forward' },
];

export interface CommitHistoryProps {
  /** Open a past week's read-only detail. */
  onOpen: (commitId: string) => void;
}

export function CommitHistory({ onOpen }: CommitHistoryProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetMyWeeksQuery();
  const [filter, setFilter] = useState<'ALL' | LifecycleState>('ALL');

  const weeks = useMemo<WeekSummary[]>(() => {
    const all = data ?? [];
    return filter === 'ALL' ? all : all.filter((w) => w.lifecycleState === filter);
  }, [data, filter]);

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-6" data-testid="commit-history">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary-900">History</h1>
          <p className="text-sm text-slate-500">Browse and reopen your past weeks.</p>
        </div>
        <Select
          sizing="sm"
          value={filter}
          aria-label="Filter by status"
          data-testid="history-filter"
          onChange={(e) => setFilter(e.target.value as 'ALL' | LifecycleState)}
        >
          {STATE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </header>

      {isLoading && <Skeleton lines={6} />}
      {isError && (
        <ErrorState title="Could not load your history" onRetry={() => void refetch()} />
      )}
      {!isLoading && !isError && weeks.length === 0 && (
        <EmptyState
          title={filter === 'ALL' ? 'No past weeks yet' : 'No weeks match this filter'}
          description={
            filter === 'ALL'
              ? 'Once you lock a week, it will appear here.'
              : 'Try a different status filter.'
          }
        />
      )}

      {!isLoading && !isError && weeks.length > 0 && (
        <ul className="space-y-2" data-testid="history-list">
          {weeks.map((w) => (
            <li key={w.commitId}>
              <button
                type="button"
                onClick={() => onOpen(w.commitId)}
                data-testid="history-row"
                data-commit-id={w.commitId}
                className="flex w-full items-center justify-between gap-3 rounded border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary-900">
                    {formatWeekRange(w.weekStart)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatProgress(w.completedCount, w.itemCount)}
                    {w.carriedInCount > 0 && (
                      <span className="ml-1 text-accent-600">
                        · {w.carriedInCount} carried in
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {w.carriedInCount > 0 && (
                    <Badge color="indigo" size="xs">
                      Carry-over
                    </Badge>
                  )}
                  <LifecycleBadge state={w.lifecycleState} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
