// apps/wc-remote/src/screens/manager/ReviewDetail.tsx — the manager's per-report review screen (brief
// §6.8, U21). Reads the report's weekly commit (read-only CommitItemRow list with RCDO links + actual
// statuses), provides an overall review action (comment + mark reviewed via reviewCommit), shows the
// REPORT-NOT-LOCKED state (a draft commit has nothing to review yet — guide back), and prev/next
// navigation through the queue. All data + the review mutation go through RTK Query.
import { useState } from 'react';
import { Button, Textarea } from 'flowbite-react';
import type { ReviewState } from '@wcm/types';
import { useGetCommitQuery, useReviewCommitMutation } from '@wcm/api';
import { EmptyState, ErrorState, LifecycleBadge, Skeleton } from '@wcm/ui';
import { CommitItemRow } from '../../components/CommitItemRow';
import { completedCount, formatProgress, formatWeekRange } from '../../lib/week';

export interface ReviewDetailProps {
  commitId: string;
  /** Back to the review queue. */
  onBack: () => void;
  /** Navigate to the previous / next report in the queue (undefined disables the control). */
  onPrev?: () => void;
  onNext?: () => void;
}

export function ReviewDetail({
  commitId,
  onBack,
  onPrev,
  onNext,
}: ReviewDetailProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetCommitQuery(commitId);
  const [reviewCommit, reviewState] = useReviewCommitMutation();
  const [comment, setComment] = useState('');
  const [reviewed, setReviewed] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6" data-testid="review-detail">
        <Skeleton lines={6} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6" data-testid="review-detail">
        <ErrorState title="Could not load this report" onRetry={() => void refetch()} />
      </div>
    );
  }

  const NavBar = (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        data-testid="review-back"
        className="text-sm text-accent-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      >
        ← Back to queue
      </button>
      <div className="flex items-center gap-2">
        <Button size="xs" color="light" disabled={!onPrev} onClick={onPrev} data-testid="review-prev">
          Previous
        </Button>
        <Button size="xs" color="light" disabled={!onNext} onClick={onNext} data-testid="review-next">
          Next
        </Button>
      </div>
    </div>
  );

  // Report-not-locked: a Draft commit isn't submitted, so there is nothing to review yet.
  if (data.lifecycleState === 'DRAFT') {
    return (
      <section className="mx-auto max-w-3xl space-y-4 p-6" data-testid="review-detail">
        {NavBar}
        <EmptyState
          title="Nothing to review yet"
          description="This report hasn’t locked their week. You’ll be able to review once they submit."
        />
      </section>
    );
  }

  const submitReview = (state: ReviewState): void => {
    void reviewCommit({ commitId, body: { state, comment: comment || null } })
      .unwrap()
      .then(() => {
        if (state === 'REVIEWED') setReviewed(true);
      });
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-6" data-testid="review-detail">
      {NavBar}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary-900">
            {formatWeekRange(data.weekStart)}
          </h1>
          <p className="text-sm text-slate-500">
            {formatProgress(completedCount(data.items), data.items.length)}
          </p>
        </div>
        <LifecycleBadge state={data.lifecycleState} />
      </header>

      <ul className="space-y-2" data-testid="review-items">
        {data.items.map((item) => (
          <CommitItemRow key={item.id} item={item} />
        ))}
      </ul>

      <div className="space-y-2 rounded border border-slate-200 p-4">
        <label htmlFor="review-comment" className="text-sm font-medium text-slate-700">
          Review note (optional)
        </label>
        <Textarea
          id="review-comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a note for this report…"
          data-testid="review-comment"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            color="blue"
            disabled={reviewState.isLoading || reviewed}
            onClick={() => submitReview('REVIEWED')}
            data-testid="mark-reviewed"
          >
            {reviewed ? 'Reviewed' : 'Mark reviewed'}
          </Button>
          <Button
            color="light"
            disabled={reviewState.isLoading}
            onClick={() => submitReview('INCOMPLETE')}
            data-testid="flag-incomplete"
          >
            Flag as incomplete
          </Button>
        </div>
      </div>
    </section>
  );
}
