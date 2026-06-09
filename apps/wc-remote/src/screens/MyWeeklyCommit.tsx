// apps/wc-remote/src/screens/MyWeeklyCommit.tsx — the My Weekly Commit home / current period (brief
// §6.2, U19; the default landing). Drives every state off getCurrentWeek: EMPTY ("Start your week",
// which createCommit → routes to the composer), DRAFT (summary + Edit/Continue + autosave hint +
// past-due banner), LOCKED (frozen read-only item list), RECONCILING/RECONCILED (read-only + a button
// into the reconciliation view). Carried-forward items surface with lineage. Loading/error use shared
// primitives. All data via RTK Query; mutations optimistic where the contract allows.
import { Button, Card } from 'flowbite-react';
import type { CommitDto } from '@wcm/types';
import {
  useCreateCommitMutation,
  useGetCurrentWeekQuery,
  useGetPulseQuery,
} from '@wcm/api';
import {
  CarriedForwardCard,
  EmptyState,
  ErrorState,
  LifecycleBadge,
  PastDueBanner,
  Skeleton,
} from '@wcm/ui';
import { CommitItemRow } from '../components/CommitItemRow';
import { PulseInput } from '../components/PulseInput';
import {
  completedCount,
  formatDueLabel,
  formatProgress,
  formatWeekRange,
  isPastDue,
  parseIsoDate,
} from '../lib/week';

export interface MyWeeklyCommitProps {
  /** Route to the composer for a (draft) commit. */
  onEdit: (commitId: string) => void;
  /** Route to the reconciliation view for a commit. */
  onReconcile: (commitId: string) => void;
}

/** ISO Monday of the current week — the week-start a brand-new commit is created for. */
function currentMonday(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function MyWeeklyCommit({ onEdit, onReconcile }: MyWeeklyCommitProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetCurrentWeekQuery();
  const [createCommit, createState] = useCreateCommitMutation();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6" data-testid="my-week">
        <Skeleton lines={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl p-6" data-testid="my-week">
        <ErrorState title="Could not load your week" onRetry={() => void refetch()} />
      </div>
    );
  }

  // Empty: no commit yet this week → "Start your week" creates one and opens the composer.
  if (!data) {
    return (
      <section className="mx-auto max-w-3xl p-6" data-testid="my-week">
        <EmptyState
          title="Start your week"
          description="Plan a small set of priorities and link each to a Supporting Outcome."
          action={
            <Button
              color="blue"
              data-testid="start-week"
              disabled={createState.isLoading}
              onClick={() =>
                void createCommit({ weekStart: currentMonday() })
                  .unwrap()
                  .then((c: CommitDto) => onEdit(c.id))
              }
            >
              Start your week
            </Button>
          }
        />
      </section>
    );
  }

  return <WeekSummaryView commit={data} onEdit={onEdit} onReconcile={onReconcile} />;
}

interface WeekSummaryViewProps {
  commit: CommitDto;
  onEdit: (commitId: string) => void;
  onReconcile: (commitId: string) => void;
}

/** The populated view, switched by lifecycle state. */
function WeekSummaryView({ commit, onEdit, onReconcile }: WeekSummaryViewProps): JSX.Element {
  const { data: pulse } = useGetPulseQuery(commit.id);
  const state = commit.lifecycleState;
  const isDraft = state === 'DRAFT';
  const inReconciliation = state === 'RECONCILING' || state === 'RECONCILED';
  const done = completedCount(commit.items);
  const carried = commit.items.filter((i) => i.carriedFromItemId);
  const pastDue = isPastDue(
    { weekStart: commit.weekStart, lifecycleState: state },
  );

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-6" data-testid="my-week">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary-900">
            {formatWeekRange(commit.weekStart)}
          </h1>
          <p className="text-sm text-slate-500">
            {isDraft
              ? formatDueLabel(commit.weekStart)
              : formatProgress(done, commit.items.length)}
          </p>
        </div>
        <LifecycleBadge state={state} />
      </header>

      {pastDue && (
        <PastDueBanner
          dueLabel={formatDueLabel(commit.weekStart)}
          action={
            <Button color="warning" size="sm" onClick={() => onEdit(commit.id)} data-testid="past-due-edit">
              Finish &amp; submit
            </Button>
          }
        />
      )}

      {carried.length > 0 && (
        <div className="space-y-2" data-testid="carried-block">
          {carried.map((i) => (
            <CarriedForwardCard
              key={i.id}
              text={i.text}
              chessTier={i.chessTier}
              lineageLabel="Carried from last week"
            />
          ))}
        </div>
      )}

      {commit.items.length === 0 ? (
        <EmptyState
          title="No items yet"
          description="Add your first commit item to get started."
          action={
            <Button color="blue" onClick={() => onEdit(commit.id)} data-testid="add-first-item">
              Edit this week
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2" data-testid="my-week-items">
          {commit.items.map((item) => (
            <CommitItemRow key={item.id} item={item} showStatus={!isDraft} />
          ))}
        </ul>
      )}

      {pulse && (pulse.rating || !isDraft) && (
        <PulseInput value={pulse} onChange={() => undefined} readOnly />
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {isDraft
              ? 'This week is a draft — keep editing until you lock it.'
              : inReconciliation
                ? 'This week is locked. Compare what you planned against what happened.'
                : 'This week is locked and read-only.'}
          </p>
          {isDraft ? (
            <Button color="blue" onClick={() => onEdit(commit.id)} data-testid="edit-continue">
              Edit / Continue
            </Button>
          ) : (
            <Button
              color="blue"
              onClick={() => onReconcile(commit.id)}
              data-testid="open-reconcile"
            >
              {inReconciliation ? 'Open reconciliation' : 'Review'}
            </Button>
          )}
        </div>
      </Card>

      <p className="text-xs text-slate-400">
        Week starting {parseIsoDate(commit.weekStart).toLocaleDateString()}.
      </p>
    </section>
  );
}
