// apps/wc-remote/src/screens/MyWeeklyCommit.tsx — the My Weekly Commit home / current period (brief
// §6.2, U19; the default landing), re-skinned to the WCM c-design (prototype/wcm/page-myweek.jsx).
// Drives every state off getCurrentWeek: LOADING (skeleton panel + cards), EMPTY ("Start your week"
// EmptyState → createCommit → routes to the composer), DRAFT (WeekHeader with Continue editing + Lock
// week[disabled until all items linked → confirm], autosave + "N items · X/Y linked", PastDueBanner,
// ValidationSummary, CarriedForwardCard section, read-mode CommitItemRow list, thin read-only Pulse),
// LOCKED/RECONCILING/RECONCILED (frozen read-only list + Start/Open reconciliation), ERROR (retry).
// Data via RTK Query ONLY (useGetCurrentWeekQuery/useCreateCommitMutation/useGetPulseQuery +
// useGetRcdoTreeQuery, flattened to id→title so each item card shows its real Supporting-Outcome name);
// the Lock confirm routes to the composer, which owns the actual lock mutation + autosave flush.
// Preserves testids: my-week, start-week, edit-continue, open-reconcile, past-due-banner, carried-block,
// lifecycle-badge (+ adds lock-week / lock-confirm via the shared primitives' own testids).
import { useMemo, useState } from 'react';
import type { CommitDto, CommitItemDto, PulseDto } from '@wcm/types';
import {
  useCreateCommitMutation,
  useGetCurrentWeekQuery,
  useGetPulseQuery,
  useGetRcdoTreeQuery,
} from '@wcm/api';
import {
  CarriedForwardCard,
  CommitItemRow,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  type ItemStatusKey,
  ItemStatus,
  Pulse,
  SectionTitle,
  Skeleton,
  ValidationSummary,
  WeekHeader,
  PastDueBanner,
  AutosaveIndicator,
} from '@wcm/ui';
import { formatWeekRange, isPastDue, parseIsoDate } from '../lib/week';
import { outcomeTitleById } from '../lib/rcdo';

export interface MyWeeklyCommitProps {
  /** Route to the composer for a (draft) commit. */
  onEdit: (commitId: string) => void;
  /** Route to the reconciliation view for a commit. */
  onReconcile: (commitId: string) => void;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** ISO Monday of the current week — the week-start a brand-new commit is created for. */
function currentMonday(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Short Friday due phrasing for a Mon-start week, e.g. "Fri Jun 12" (WeekHeader prepends "Due "). */
function shortDue(weekStartIso: string): string {
  const friday = parseIsoDate(weekStartIso);
  friday.setDate(friday.getDate() + 4);
  const wd = WEEKDAYS[friday.getDay()] ?? '';
  const mo = MONTHS[friday.getMonth()] ?? '';
  return `${wd} ${mo} ${friday.getDate()}`;
}

/** Map the wire item status to the read-only ItemStatus pill key. */
function statusKey(status: CommitItemDto['status']): ItemStatusKey {
  switch (status) {
    case 'COMPLETE':
      return 'completed';
    case 'INCOMPLETE':
      return 'incomplete';
    case 'CARRIED_FORWARD':
      return 'carried';
    case 'OPEN':
    default:
      return 'pending';
  }
}

export function MyWeeklyCommit({ onEdit, onReconcile }: MyWeeklyCommitProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetCurrentWeekQuery();
  const [createCommit, createState] = useCreateCommitMutation();

  if (isLoading) {
    return (
      <div className="page" data-testid="my-week">
        <div className="panel" style={{ padding: 20, marginBottom: 18 }}>
          <Skeleton lines={3} />
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="panel" style={{ padding: 16 }}>
              <Skeleton lines={2} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page" data-testid="my-week">
        <ErrorState title="Could not load your week" onRetry={() => void refetch()} />
      </div>
    );
  }

  // Empty: no commit yet this week → "Start your week" creates one and opens the composer.
  if (!data || data.items.length === 0) {
    return (
      <section className="page" data-testid="my-week">
        <EmptyState
          icon="week"
          title="Start your week"
          description="You haven't written a Weekly Commit for this week yet. Add a few priorities and link each to your team's strategy."
          action={
            <button
              type="button"
              className="btn btn-primary"
              data-testid="start-week"
              disabled={createState.isLoading}
              onClick={() =>
                void createCommit({ weekStart: data?.weekStart ?? currentMonday() })
                  .unwrap()
                  .then((c: CommitDto) => onEdit(c.id))
              }
            >
              <Icon.plus size={15} /> Start this week
            </button>
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
  // The RCDO tree lets each linked item's chip show its real Supporting-Outcome name (not a generic
  // placeholder); flatten it to id → title once per tree change.
  const { data: rcdoTree } = useGetRcdoTreeQuery();
  const titleById = useMemo(() => outcomeTitleById(rcdoTree), [rcdoTree]);
  const [confirmLock, setConfirmLock] = useState(false);

  const state = commit.lifecycleState;
  const isDraft = state === 'DRAFT';
  const isLocked = state === 'LOCKED';

  const total = commit.items.length;
  const linkedCount = commit.items.filter((i) => i.supportingOutcomeId).length;
  const unlinked = total - linkedCount;
  const carried = commit.items.filter((i) => i.carriedFromItemId);
  const thisWeek = commit.items.filter((i) => !i.carriedFromItemId);
  const pastDue = isPastDue({ weekStart: commit.weekStart, lifecycleState: state });

  // Read-only pulse value (My Week shows the recorded reading; editing happens in the composer flow).
  const pulseValue: PulseDto = pulse ?? { rating: null, comment: null, privateToManager: false };
  const showPulse = Boolean(pulse) && (pulse?.rating != null || !isDraft);

  const actions = isDraft ? (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        data-testid="edit-continue"
        onClick={() => onEdit(commit.id)}
      >
        <Icon.pencil size={15} /> Continue editing
      </button>
      <button
        type="button"
        className="btn btn-primary"
        data-testid="lock-week"
        disabled={unlinked > 0}
        title={unlinked > 0 ? 'Link every item first' : 'Lock your plan'}
        onClick={() => setConfirmLock(true)}
      >
        <Icon.lock size={15} /> Lock week
      </button>
    </>
  ) : (
    <button
      type="button"
      className="btn btn-primary"
      data-testid="open-reconcile"
      onClick={() => onReconcile(commit.id)}
    >
      <Icon.scale size={15} /> {isLocked ? 'Start reconciliation' : 'Open reconciliation'}
    </button>
  );

  return (
    <section className="page" data-testid="my-week">
      <WeekHeader
        range={formatWeekRange(commit.weekStart)}
        state={state}
        year={parseIsoDate(commit.weekStart).getFullYear()}
        due={shortDue(commit.weekStart)}
        overdue={pastDue}
        actions={actions}
      >
        {isDraft && (
          <div
            className="between wrap"
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid var(--line-soft)',
              gap: 12,
            }}
          >
            <AutosaveIndicator status="saved" savedLabel="just now" />
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-low)' }}>
              {total} items · {linkedCount}/{total} linked
            </span>
          </div>
        )}
        {isLocked && (
          <div
            className="inline-flex items-center"
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid var(--line-soft)',
              gap: 7,
              fontSize: 12.5,
              color: 'var(--ink-low)',
            }}
          >
            <Icon.lock size={14} /> Your plan is frozen for the week. Edits reopen at reconciliation.
          </div>
        )}
      </WeekHeader>

      {pastDue && (
        <PastDueBanner
          dueLabel={`due ${shortDue(commit.weekStart)}`}
          action={
            <button
              type="button"
              className="btn btn-primary btn-sm"
              data-testid="past-due-edit"
              onClick={() => onEdit(commit.id)}
            >
              Finish &amp; submit
            </button>
          }
        />
      )}

      {isDraft && unlinked > 0 && (
        <div style={{ marginBottom: 16 }}>
          <ValidationSummary count={unlinked} onFix={() => onEdit(commit.id)} />
        </div>
      )}

      {carried.length > 0 && (
        <div style={{ marginBottom: 16 }} data-testid="carried-section">
          <SectionTitle title="Carried from last week" />
          <div className="stack" style={{ gap: 10 }}>
            {carried.map((i) => (
              <CarriedForwardCard
                key={i.id}
                text={i.text}
                chessTier={i.chessTier}
                lineageLabel="Carried from last week"
              />
            ))}
          </div>
        </div>
      )}

      <SectionTitle
        title="This week's commit"
        right={
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-low)' }}>
            {total} items
          </span>
        }
      />
      <ul className="stack" data-testid="my-week-items" style={{ gap: 10, marginBottom: 22 }}>
        {thisWeek.map((item) => (
          <CommitItemRow
            key={item.id}
            id={item.id}
            text={item.text}
            tier={item.chessTier}
            outcomeTitle={
              item.supportingOutcomeId
                ? (titleById.get(item.supportingOutcomeId) ?? 'Linked outcome')
                : null
            }
            right={!isDraft ? <ItemStatus status={statusKey(item.status)} /> : null}
          />
        ))}
      </ul>

      {showPulse && (
        <div className="panel" style={{ padding: 18, marginBottom: 18 }}>
          <SectionTitle
            title="Weekly pulse"
            right={
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                OPTIONAL
              </span>
            }
          />
          <Pulse value={pulseValue} onChange={() => undefined} readOnly />
        </div>
      )}

      <ConfirmDialog
        open={confirmLock}
        icon="lock"
        title="Lock this week?"
        confirmLabel="Lock week"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmLock(false);
          onEdit(commit.id);
        }}
        onCancel={() => setConfirmLock(false)}
      >
        Locking freezes your plan for the week. You won&apos;t be able to add or change items until
        reconciliation. Your manager will be notified.
      </ConfirmDialog>
    </section>
  );
}
