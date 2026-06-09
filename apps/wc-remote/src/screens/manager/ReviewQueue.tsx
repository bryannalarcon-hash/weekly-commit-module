// apps/wc-remote/src/screens/manager/ReviewQueue.tsx — the manager Review Queue (brief §6.7, U21).
// Lists the manager's direct reports for a selected week (WeekSelector → review-queue query) with each
// report's submission status (Locked / Draft / overdue), an at-a-glance completion count, and a
// "needs review only" quick-filter. Rows for a locked report open the review detail. Loading/empty/
// error use the shared primitives; the manager filter is server-side — these are scan affordances.
import { useMemo, useState } from 'react';
import { Button, Checkbox, Label } from 'flowbite-react';
import type { ReviewQueueRow } from '@wcm/types';
import { useGetReviewQueueQuery } from '@wcm/api';
import { EmptyState, ErrorState, LifecycleBadge, Skeleton } from '@wcm/ui';
import { WeekSelector, recentWeeks } from '../../components/WeekSelector';
import { formatProgress } from '../../lib/week';

export interface ReviewQueueProps {
  /** Open a report's weekly commit for review (only when the report has a commit). */
  onOpenReview: (commitId: string, weekStart: string) => void;
}

export function ReviewQueue({ onOpenReview }: ReviewQueueProps): JSX.Element {
  const weeks = recentWeeks();
  const [weekStart, setWeekStart] = useState<string>(weeks[0] ?? '');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const { data, isLoading, isError, refetch } = useGetReviewQueueQuery({ weekStart });

  const rows = useMemo<ReviewQueueRow[]>(() => {
    const all = data?.content ?? [];
    return needsReviewOnly
      ? all.filter((r) => r.lifecycleState === 'LOCKED' && r.reviewState !== 'REVIEWED')
      : all;
  }, [data, needsReviewOnly]);

  return (
    <section className="mx-auto max-w-4xl space-y-4 p-6" data-testid="review-queue">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary-900">Review queue</h1>
          <p className="text-sm text-slate-500">
            See who has submitted this week and open their commits to review.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WeekSelector value={weekStart} weeks={weeks} onChange={setWeekStart} />
          <Label className="flex items-center gap-2 text-sm text-slate-600">
            <Checkbox
              checked={needsReviewOnly}
              onChange={(e) => setNeedsReviewOnly(e.target.checked)}
              data-testid="needs-review-filter"
            />
            Needs review
          </Label>
        </div>
      </header>

      {isLoading && <Skeleton lines={6} />}
      {isError && <ErrorState title="Could not load the review queue" onRetry={() => void refetch()} />}
      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title={needsReviewOnly ? 'All caught up' : 'No reports'}
          description={
            needsReviewOnly
              ? 'Every submitted commit for this week has been reviewed.'
              : 'You have no direct reports with activity this week.'
          }
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <ul className="space-y-2" data-testid="queue-list">
          {rows.map((r) => {
            const canReview = Boolean(r.commitId) && r.lifecycleState === 'LOCKED';
            return (
              <li
                key={r.memberId}
                data-testid="queue-row"
                data-member-id={r.memberId}
                className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary-900">{r.memberName}</p>
                  <p className="text-xs text-slate-500">
                    {formatProgress(r.completedCount, r.itemCount)}
                    {r.overdue && (
                      <span className="ml-1 font-medium text-danger" data-testid="queue-overdue">
                        · Overdue
                      </span>
                    )}
                    {r.reviewState === 'REVIEWED' && (
                      <span className="ml-1 text-green-700">· Reviewed</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.lifecycleState ? (
                    <LifecycleBadge state={r.lifecycleState} />
                  ) : (
                    <span className="text-xs text-slate-400">Not started</span>
                  )}
                  <Button
                    size="xs"
                    color="blue"
                    disabled={!canReview}
                    data-testid="queue-open-review"
                    onClick={() => r.commitId && onOpenReview(r.commitId, weekStart)}
                  >
                    Review
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
