// apps/wc-remote/src/screens/manager/ReviewDetail.tsx — the manager's per-report review screen (brief
// §6.8, U21), re-skinned to the WCM design (prototype/wcm/page-mgr-queue.jsx "Review a Commit" +
// screenshots/07-mgr-review-commit). Layout: a queue/back + Planned-vs-actual/Next-report nav row; a
// report header panel (Avatar, name, week range, Locked badge, the CB-1 "Schedule 1:1" ghost button
// that opens ScheduleDialog for this report + a "Scheduled ✓" note after success, "Mark reviewed", and
// the member's Pulse rating+comment); an amber notice when any item is unlinked from strategy; and
// per-item review cards (chess glyph, title, done check, RCDO link / unlinked chip,
// Comment/Flag/Mark-reviewed actions with an inline comment textarea). "Mark reviewed" opens a
// ConfirmDialog before posting. Renders the REPORT-NOT-LOCKED empty state for a Draft commit. Data +
// the review mutation go through RTK Query (useGetCommitQuery / useReviewCommitMutation); the member's
// Pulse is read via useGetPulseQuery.
import { useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import type { CommitItemDto, ReviewState } from '@wcm/types';
import { useGetCommitQuery, useGetPulseQuery, useReviewCommitMutation } from '@wcm/api';
import {
  Avatar,
  ChessBadge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  LifecycleBadge,
  RcdoChip,
  Skeleton,
} from '@wcm/ui';
import { completedCount, formatProgress, formatWeekRange } from '../../lib/week';
import { ScheduleDialog } from './ScheduleDialog';

export interface ReviewDetailProps {
  commitId: string;
  /** Display name of the report whose week this is; falls back to a generic label when omitted. */
  memberName?: string;
  /** Back to the review queue. */
  onBack: () => void;
  /** Open the planned-vs-actual (reconciliation) view for this report (undefined hides the control). */
  onReconcile?: () => void;
  /** Navigate to the previous / next report in the queue (undefined disables the control). */
  onPrev?: () => void;
  onNext?: () => void;
}

/** Left-rail tone for an item card: red when flagged, signal when linked, amber when unlinked. */
function itemBorder(item: CommitItemDto, flagged: boolean): string {
  if (flagged) return 'var(--red)';
  return item.supportingOutcomeId ? 'var(--signal)' : 'var(--amber)';
}

/** Toggle an id in/out of a Set held in state. */
function toggleId(setter: Dispatch<SetStateAction<ReadonlySet<string>>>, id: string): void {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

export function ReviewDetail({
  commitId,
  memberName,
  onBack,
  onReconcile,
  onPrev,
  onNext,
}: ReviewDetailProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetCommitQuery(commitId);
  const { data: pulse } = useGetPulseQuery(commitId);
  const [reviewCommit, reviewState] = useReviewCommitMutation();
  // Per-item local review affordances (manager scratch state, not yet persisted per-item).
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(new Set());
  const [itemReviewed, setItemReviewed] = useState<ReadonlySet<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  // CB-1 Schedule-1:1 affordance: dialog visibility + the scheduled-✓ note after a success.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduled, setScheduled] = useState(false);

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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        data-testid="review-back"
        className="btn btn-quiet btn-sm -ml-2"
        style={{ color: 'var(--ink-low)' }}
      >
        <Icon.chevL size={15} aria-hidden /> Review Queue
      </button>
      <div className="flex items-center gap-2">
        {onReconcile && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onReconcile}
            data-testid="review-reconcile"
          >
            <Icon.scale size={14} aria-hidden /> Planned vs actual
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!onPrev}
          onClick={onPrev}
          data-testid="review-prev"
        >
          <Icon.chevL size={14} aria-hidden /> Previous
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!onNext}
          onClick={onNext}
          data-testid="review-next"
        >
          Next report <Icon.chevR size={14} aria-hidden />
        </button>
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

  const name = memberName ?? `Report ${data.memberId}`;
  const unlinked = data.items.filter((i) => !i.supportingOutcomeId).length;

  const submitReview = (state: ReviewState): void => {
    void reviewCommit({ commitId, body: { state, comment: null } })
      .unwrap()
      .then(() => {
        if (state === 'REVIEWED') setReviewed(true);
      });
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-6" data-testid="review-detail">
      {NavBar}

      {/* Report header panel */}
      <header className="panel" style={{ padding: '18px 20px' }} data-testid="review-header">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={name} size={46} ring />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-low)' }}>
                  {formatWeekRange(data.weekStart)}
                </span>
                <LifecycleBadge state={data.lifecycleState} size="sm" />
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                  {formatProgress(completedCount(data.items), data.items.length)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scheduled && (
              <span
                data-testid="schedule-success"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--signal)',
                }}
              >
                <Icon.checkCircle size={14} aria-hidden /> Scheduled ✓
              </span>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setScheduleOpen(true)}
              data-testid="schedule-open"
            >
              <Icon.week size={15} aria-hidden /> Schedule 1:1
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={reviewState.isLoading || reviewed}
              onClick={() => setConfirmOpen(true)}
              data-testid="mark-reviewed"
            >
              {reviewed ? (
                <>
                  <Icon.checkCircle size={15} aria-hidden /> Reviewed
                </>
              ) : (
                <>
                  <Icon.check size={15} aria-hidden /> Mark reviewed
                </>
              )}
            </button>
          </div>
        </div>

        {pulse && pulse.rating !== null && (
          <div
            data-testid="review-pulse"
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid var(--line-soft)',
              display: 'flex',
              gap: 18,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span className="tnum" style={{ fontSize: 13, color: 'var(--ink-mid)' }}>
              Pulse{' '}
              <strong style={{ fontSize: 16 }} data-testid="review-pulse-rating">
                {pulse.rating}/5
              </strong>
            </span>
            {pulse.comment && (
              <span style={{ fontSize: 13, color: 'var(--ink-mid)', fontStyle: 'italic' }}>
                “{pulse.comment}”
              </span>
            )}
          </div>
        )}
      </header>

      {/* Amber notice: items not linked to strategy */}
      {unlinked > 0 && (
        <div
          data-testid="review-unlinked-notice"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 15px',
            background: 'var(--amber-dim)',
            borderRadius: 'var(--r-md)',
            border: '1px solid color-mix(in oklch, var(--amber) 30%, transparent)',
            fontSize: 13,
          }}
        >
          <Icon.alert size={16} style={{ color: 'var(--amber)', flex: 'none' }} aria-hidden />
          <span>
            <strong>
              {unlinked} item{unlinked === 1 ? '' : 's'}
            </strong>{' '}
            {unlinked === 1 ? "isn't" : "aren't"} linked to strategy — worth a comment.
          </span>
        </div>
      )}

      {/* Per-item review cards */}
      <ul className="space-y-2" data-testid="review-items">
        {data.items.map((item) => {
          const isFlagged = flagged.has(item.id);
          const isItemReviewed = itemReviewed.has(item.id);
          const commentOpen = openComment === item.id;
          return (
            <li
              key={item.id}
              data-testid="review-item"
              data-item-id={item.id}
              className="panel"
              style={{
                padding: '13px 15px',
                borderLeft: `3px solid ${itemBorder(item, isFlagged)}`,
              }}
            >
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{ marginTop: 1, flex: 'none' }}>
                  {item.chessTier && <ChessBadge tier={item.chessTier} showLabel={false} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{item.text}</span>
                    {item.status === 'COMPLETE' && (
                      <Icon.checkCircle
                        size={15}
                        style={{ color: 'var(--signal)', flex: 'none' }}
                        aria-label="Done"
                      />
                    )}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <RcdoChip title={item.supportingOutcomeId ? 'Linked outcome' : null} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
                  <ItemActionButton
                    icon="comment"
                    title="Comment"
                    active={commentOpen}
                    activeColor="var(--cyan)"
                    testid={`review-item-comment-${item.id}`}
                    onClick={() => setOpenComment(commentOpen ? null : item.id)}
                  />
                  <ItemActionButton
                    icon="flag"
                    title="Flag"
                    active={isFlagged}
                    activeColor="var(--red)"
                    testid={`review-item-flag-${item.id}`}
                    onClick={() => toggleId(setFlagged, item.id)}
                  />
                  <ItemActionButton
                    icon="check"
                    title="Mark reviewed"
                    active={isItemReviewed}
                    activeColor="var(--signal)"
                    testid={`review-item-reviewed-${item.id}`}
                    onClick={() => toggleId(setItemReviewed, item.id)}
                  />
                </div>
              </div>
              {commentOpen && (
                <div style={{ marginTop: 11 }}>
                  <textarea
                    className="input"
                    rows={2}
                    autoFocus
                    placeholder={`Comment for ${name}…`}
                    data-testid={`review-item-comment-input-${item.id}`}
                    style={{ resize: 'vertical', fontFamily: 'var(--sans)' }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => setOpenComment(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setOpenComment(null)}
                    >
                      Comment
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {scheduleOpen && (
        <ScheduleDialog
          reportMemberId={data.memberId}
          reportName={name}
          onClose={() => setScheduleOpen(false)}
          onScheduled={() => {
            setScheduled(true);
            setScheduleOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        icon="check"
        title={`Mark ${name}’s week reviewed?`}
        confirmLabel="Mark reviewed"
        busy={reviewState.isLoading}
        onConfirm={() => {
          submitReview('REVIEWED');
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      >
        They’ll be notified that you’ve reviewed their weekly commit. You can still add comments
        afterward.
      </ConfirmDialog>
    </section>
  );
}

/** A small quiet icon action on an item row (Comment / Flag / Mark-reviewed). */
function ItemActionButton({
  icon,
  title,
  active,
  activeColor,
  testid,
  onClick,
}: {
  icon: 'comment' | 'flag' | 'check';
  title: string;
  active: boolean;
  activeColor: string;
  testid: string;
  onClick: () => void;
}): JSX.Element {
  const Glyph = Icon[icon];
  const style: CSSProperties = {
    padding: 7,
    color: active ? activeColor : 'var(--ink-faint)',
  };
  return (
    <button
      type="button"
      className="btn btn-quiet btn-sm"
      title={title}
      aria-label={title}
      aria-pressed={active}
      data-testid={testid}
      onClick={onClick}
      style={style}
    >
      <Glyph size={16} aria-hidden />
    </button>
  );
}
