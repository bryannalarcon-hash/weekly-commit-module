// apps/wc-remote/src/screens/PastCommitDetail.tsx — read-only detail of a historical week (brief
// §6.4.1, U19). Shows the week's commit items with their links + final actual statuses (read-only
// CommitItemRow), the recorded Pulse, and — when the week has been locked or beyond — a link into that
// week's reconciliation view. No mutations. Loading/error via shared primitives; data via RTK Query.
import { Button } from 'flowbite-react';
import { useGetCommitQuery, useGetPulseQuery } from '@wcm/api';
import { ErrorState, LifecycleBadge, Skeleton } from '@wcm/ui';
import { CommitItemRow } from '../components/CommitItemRow';
import { PulseInput } from '../components/PulseInput';
import { completedCount, formatProgress, formatWeekRange } from '../lib/week';

export interface PastCommitDetailProps {
  commitId: string;
  /** Back to the history list. */
  onBack: () => void;
  /** Open this week's reconciliation view. */
  onReconcile: (commitId: string) => void;
}

export function PastCommitDetail({
  commitId,
  onBack,
  onReconcile,
}: PastCommitDetailProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetCommitQuery(commitId);
  const { data: pulse } = useGetPulseQuery(commitId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6" data-testid="past-commit-detail">
        <Skeleton lines={6} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6" data-testid="past-commit-detail">
        <ErrorState title="Could not load this week" onRetry={() => void refetch()} />
      </div>
    );
  }

  const reconcilable = data.lifecycleState !== 'DRAFT';

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-6" data-testid="past-commit-detail">
      <button
        type="button"
        onClick={onBack}
        data-testid="past-back"
        className="text-sm text-accent-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      >
        ← Back to history
      </button>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary-900">
            {formatWeekRange(data.weekStart)}
          </h1>
          <p className="text-sm text-slate-500">
            {formatProgress(completedCount(data.items), data.items.length)} · read-only
          </p>
        </div>
        <LifecycleBadge state={data.lifecycleState} />
      </header>

      <ul className="space-y-2" data-testid="past-items">
        {data.items.map((item) => (
          <CommitItemRow key={item.id} item={item} />
        ))}
      </ul>

      {pulse && pulse.rating !== null && (
        <PulseInput value={pulse} onChange={() => undefined} readOnly />
      )}

      {reconcilable && (
        <Button
          color="light"
          onClick={() => onReconcile(commitId)}
          data-testid="past-open-reconcile"
        >
          View reconciliation
        </Button>
      )}
    </section>
  );
}
