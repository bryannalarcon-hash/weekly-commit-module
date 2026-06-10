// apps/wc-remote/src/screens/manager/ReviewQueue.tsx — the manager Review Queue (brief §6.7, U21),
// re-skinned to the WCM design handoff (prototype/wcm/page-mgr-queue.jsx + screenshots/desktop/
// 06-mgr-review-queue.png). Lists the manager's direct reports for a selected week (WeekSelector +
// week-stepper → review-queue query) as a single panel of rows — Avatar, name, last-reviewed line,
// done/total count, alignment slot, and a submission badge (Ready / Submitted / Draft / Overdue /
// Reviewed). A row is REVIEWABLE only once the IC has RECONCILED it (the backend 409s an earlier
// review) — RECONCILED-unreviewed rows read as "Ready to review" and drive the Needs-review count.
// A filter-chip bar (All / Needs review / Submitted / Draft / Overdue) with live counts narrows the
// view client-side; reconciled (reviewable) rows open the review detail (onOpenReview). Loading shimmer,
// the "All caught up" empty state, and the retryable error use the shared @wcm/ui primitives. Data is
// RTK Query ONLY (useGetReviewQueueQuery, unchanged). Preserves the manager-queue testids the Cypress
// suite depends on (review-queue, queue-list, queue-row, queue-open-review, queue-overdue,
// needs-review-filter, week-selector) and adds the design's chip/stepper/badge testids.
import { useMemo, useState } from 'react';
import type { ReviewQueueRow } from '@wcm/types';
import { useGetReviewQueueQuery } from '@wcm/api';
import { Avatar, EmptyState, ErrorState, Icon, Skeleton } from '@wcm/ui';
import { recentWeeks } from '../../components/WeekSelector';
import { formatWeekRange } from '../../lib/week';

export interface ReviewQueueProps {
  /** Open a report's weekly commit for review (only when the report has a commit). */
  onOpenReview: (commitId: string, weekStart: string) => void;
}

/** The design's submission-status vocabulary for a queue row (distinct from the lifecycle badge).
 *  'ready' = RECONCILED-but-unreviewed: the IC has reconciled, so the manager can now review it. */
type SubmissionStatus = 'submitted' | 'draft' | 'overdue' | 'reviewed' | 'ready';

/** Filter chip ids — `all` plus one per submission status (mirrors the design chip bar). */
type FilterId = 'all' | 'needs' | SubmissionStatus;

/**
 * Collapse a row's lifecycle/review/overdue truth into the design's single submission status.
 * Reviewed wins (terminal); then a RECONCILED-but-unreviewed week is 'ready' (the IC has reconciled,
 * so the manager can now act); then a still-pre-reconciliation overdue report; then a submission still
 * awaiting reconciliation (LOCKED or RECONCILING) is 'submitted'; else it is a draft (covers DRAFT and
 * the not-started/null lifecycle the API can return).
 */
function submissionOf(r: ReviewQueueRow): SubmissionStatus {
  if (r.reviewState === 'REVIEWED') return 'reviewed';
  if (r.lifecycleState === 'RECONCILED') return 'ready';
  // Overdue only reads as overdue while still pre-reconciliation AND not yet submitted; once the
  // report is LOCKED/RECONCILING it is "submitted — awaiting reconciliation" instead.
  if (r.overdue && r.lifecycleState !== 'LOCKED' && r.lifecycleState !== 'RECONCILING') return 'overdue';
  if (r.lifecycleState === 'LOCKED' || r.lifecycleState === 'RECONCILING') return 'submitted';
  return 'draft';
}

/** A row is reviewable only once the IC has RECONCILED the week (the backend 409s a pre-reconcile review). */
function canReviewRow(r: ReviewQueueRow): boolean {
  return Boolean(r.commitId) && r.lifecycleState === 'RECONCILED';
}

/** A row "needs review" when it is RECONCILED and still awaiting the manager's verdict. */
function needsReview(r: ReviewQueueRow): boolean {
  return r.lifecycleState === 'RECONCILED' && r.reviewState !== 'REVIEWED';
}

/**
 * Item-completion ("X/Y done") is only meaningful once a week is reconciled — that is when actuals
 * are recorded. A DRAFT or LOCKED (submitted, not-yet-reconciled) week has 0 completed items by
 * definition, so showing "0/Y done" reads as failure when the worker has simply planned Y items and
 * the week isn't over. For those, show the planned item count instead.
 */
function progressLabel(r: ReviewQueueRow): string {
  if (!r.itemCount) return '—';
  const reconciled =
    r.lifecycleState === 'RECONCILED' || r.lifecycleState === 'RECONCILING';
  if (reconciled) return `${r.completedCount}/${r.itemCount} done`;
  return `${r.itemCount} ${r.itemCount === 1 ? 'item' : 'items'}`;
}

const SUB_VISUAL: Record<SubmissionStatus, { label: string; color: string; dim: string; icon: string }> = {
  ready: { label: 'Ready to review', color: 'var(--signal)', dim: 'var(--signal-dim)', icon: 'checkCircle' },
  submitted: { label: 'Submitted — awaiting reconciliation', color: 'var(--cyan)', dim: 'var(--cyan-dim)', icon: 'lock' },
  draft: { label: 'Draft', color: 'var(--slate)', dim: 'var(--slate-dim)', icon: 'pencil' },
  overdue: { label: 'Overdue', color: 'var(--red)', dim: 'var(--red-dim)', icon: 'alert' },
  reviewed: { label: 'Reviewed', color: 'var(--signal)', dim: 'var(--signal-dim)', icon: 'checkCircle' },
};

/** The design's submission pill: token-tinted, icon + label (state never conveyed by color alone). */
function SubmissionBadge({ status }: { status: SubmissionStatus }): JSX.Element {
  const v = SUB_VISUAL[status];
  const Glyph = (Icon as Record<string, (p: { size?: number }) => JSX.Element>)[v.icon];
  return (
    <span
      data-testid="queue-status-badge"
      data-status={status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11.5,
        fontWeight: 600,
        color: v.color,
        background: v.dim,
        padding: '3px 9px',
        borderRadius: 'var(--r-pill)',
        border: `1px solid color-mix(in oklch, ${v.color} 28%, transparent)`,
        whiteSpace: 'nowrap',
      }}
    >
      {Glyph?.({ size: 12 })} {v.label}
    </span>
  );
}

export function ReviewQueue({ onOpenReview }: ReviewQueueProps): JSX.Element {
  const weeks = recentWeeks();
  const [weekIndex, setWeekIndex] = useState(0);
  const weekStart = weeks[weekIndex] ?? weeks[0] ?? '';
  const [filter, setFilter] = useState<FilterId>('all');
  const { data, isLoading, isError, refetch } = useGetReviewQueueQuery({ weekStart });

  const all = useMemo<ReviewQueueRow[]>(() => data?.content ?? [], [data]);

  // Live chip counts over the unfiltered set.
  const counts = useMemo(() => {
    const c: Record<FilterId, number> = { all: all.length, needs: 0, ready: 0, submitted: 0, draft: 0, overdue: 0, reviewed: 0 };
    for (const r of all) {
      if (needsReview(r)) c.needs += 1;
      c[submissionOf(r)] += 1;
    }
    return c;
  }, [all]);

  const rows = useMemo<ReviewQueueRow[]>(() => {
    if (filter === 'all') return all;
    if (filter === 'needs') return all.filter(needsReview);
    return all.filter((r) => submissionOf(r) === filter);
  }, [all, filter]);

  const FILTERS: { id: FilterId; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'needs', label: 'Needs review' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'draft', label: 'Draft' },
    { id: 'overdue', label: 'Overdue' },
  ];

  // The "needs review" chip is the re-skin of the legacy needs-review checkbox; keep its testid.
  const filterTestId = (id: FilterId): string => (id === 'needs' ? 'needs-review-filter' : `queue-filter-${id}`);

  const canStepNewer = weekIndex > 0;
  const canStepOlder = weekIndex < weeks.length - 1;

  return (
    <section className="page mx-auto max-w-4xl" data-testid="review-queue">
      <header
        className="ptitle"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>Review Queue</h1>
          <div className="sub" style={{ fontSize: 13, color: 'var(--ink-low)', marginTop: 2 }}>
            Direct reports · {formatWeekRange(weekStart).replace('Week of ', '')}
          </div>
        </div>
        {/* Week stepper — newer/older around the human-readable range; drives the query week. */}
        <div style={{ display: 'flex', gap: 9, alignItems: 'center' }} data-testid="week-stepper">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Newer week"
            disabled={!canStepNewer}
            data-testid="week-newer"
            onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
          >
            <Icon.chevL size={14} />
          </button>
          {/* Hidden native select preserves the week-selector testid + keyboard/AT access. */}
          <label className="sr-only" htmlFor="week-selector">
            Select a week
          </label>
          <select
            id="week-selector"
            data-testid="week-selector"
            aria-label="Select a week"
            value={weekStart}
            onChange={(e) => setWeekIndex(Math.max(0, weeks.indexOf(e.target.value)))}
            className="tnum"
            style={{
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--mono)',
              color: 'var(--ink)',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              padding: '5px 8px',
            }}
          >
            {weeks.map((w) => (
              <option key={w} value={w}>
                {formatWeekRange(w).replace('Week of ', '')}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Older week"
            disabled={!canStepOlder}
            data-testid="week-older"
            onClick={() => setWeekIndex((i) => Math.min(weeks.length - 1, i + 1))}
          >
            <Icon.chevR size={14} />
          </button>
        </div>
      </header>

      {/* Filter chips with live counts. */}
      <div
        style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}
        role="tablist"
        aria-label="Filter reports"
        data-testid="queue-filters"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={filterTestId(f.id)}
              onClick={() => setFilter(f.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12.5,
                fontWeight: 600,
                padding: '7px 12px',
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                border: `1px solid ${active ? 'var(--line-bright)' : 'var(--line)'}`,
                background: active ? 'var(--surface-1)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-low)',
                boxShadow: active ? 'var(--shadow-1)' : 'none',
              }}
            >
              {f.label}{' '}
              <span
                className="mono tnum"
                data-testid={`queue-count-${f.id}`}
                style={{
                  fontSize: 10,
                  color: active ? 'var(--signal)' : 'var(--ink-faint)',
                  background: 'var(--surface-2)',
                  padding: '1px 6px',
                  borderRadius: 99,
                }}
              >
                {counts[f.id]}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="queue-loading">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="panel"
              style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}
            >
              <div className="sk" style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)' }} />
              <div style={{ flex: 1 }}>
                <Skeleton lines={2} />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && <ErrorState title="Could not load the review queue" onRetry={() => void refetch()} />}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          icon="checkCircle"
          title="All caught up"
          description="No reports match this filter. Everyone in this view is handled."
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="panel" style={{ overflow: 'hidden', padding: 0 }} data-testid="queue-list">
          {rows.map((r, idx) => {
            const status = submissionOf(r);
            const canReview = canReviewRow(r);
            const open = (): void => {
              if (canReview && r.commitId) onOpenReview(r.commitId, weekStart);
            };
            return (
              <div
                key={r.memberId}
                data-testid="queue-row"
                data-member-id={r.memberId}
                data-status={status}
                role={canReview ? 'button' : undefined}
                tabIndex={canReview ? 0 : undefined}
                aria-disabled={canReview ? undefined : true}
                onClick={open}
                onKeyDown={(e) => {
                  if (canReview && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    open();
                  }
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderTop: idx ? '1px solid var(--line-soft)' : 'none',
                  cursor: canReview ? 'pointer' : 'default',
                  transition: 'background .12s',
                }}
                onMouseEnter={(e) => {
                  if (canReview) e.currentTarget.style.background = 'var(--surface-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar name={r.memberName} size={38} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{r.memberName}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                      Last reviewed —
                      {r.overdue && (
                        <span data-testid="queue-overdue" style={{ marginLeft: 6, color: 'var(--red)', fontWeight: 600 }}>
                          · Overdue
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <span
                    className="hide-xs tnum mono"
                    data-testid="queue-progress"
                    style={{ fontSize: 12, color: 'var(--ink-mid)', width: 96, textAlign: 'right' }}
                  >
                    {progressLabel(r)}
                  </span>
                  <span
                    className="hide-xs tnum mono"
                    data-testid="queue-alignment"
                    aria-label="Strategic alignment (not yet available)"
                    style={{ fontSize: 12, color: 'var(--ink-faint)', width: 70, textAlign: 'right' }}
                  >
                    — aln
                  </span>
                  <SubmissionBadge status={status} />
                  <button
                    type="button"
                    data-testid="queue-open-review"
                    aria-label={`Review ${r.memberName}`}
                    disabled={!canReview}
                    onClick={(e) => {
                      e.stopPropagation();
                      open();
                    }}
                    className="btn btn-quiet btn-sm"
                    style={{ padding: 4, color: canReview ? 'var(--ink-faint)' : 'var(--line-bright)' }}
                  >
                    <Icon.chevR size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="between" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: '0 4px' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-low)' }} data-testid="queue-count-summary">
            {rows.length} of {all.length} reports
          </span>
        </div>
      )}
    </section>
  );
}
