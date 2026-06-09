// apps/wc-remote/src/screens/PastCommitDetail.tsx — read-only detail of a historical week (brief
// §6.4.1, U19), re-skinned to the WCM design handoff (prototype/wcm/page-history.jsx PastDetail).
// A summary panel (read-only kicker, week range + LifecycleBadge, "View reconciliation" ghost button,
// and a metric strip: completed count + recorded Pulse), then a "Commit items" section where each
// item is a signal-edged panel row carrying its ChessBadge (priority), text, RcdoBreadcrumb (the
// strategy ladder resolved from the RCDO tree by supportingOutcomeId), and an ItemStatus pill mapped
// from the item's final actual status. No mutations. Loading skeleton / error via shared primitives;
// data via RTK Query (useGetCommitQuery + useGetPulseQuery + useGetRcdoTreeQuery). Preserves data-testid:
// past-commit-detail, past-back, past-items, past-open-reconcile, plus the shared primitives' testids.
import { useMemo } from 'react';
import type { CommitItemStatus } from '@wcm/types';
import { useGetCommitQuery, useGetPulseQuery, useGetRcdoTreeQuery } from '@wcm/api';
import {
  ChessBadge,
  ErrorState,
  Icon,
  ItemStatus,
  type ItemStatusKey,
  LifecycleBadge,
  type RcdoPath,
  RcdoBreadcrumb,
  SectionTitle,
  Skeleton,
} from '@wcm/ui';
import { completedCount, formatWeekRange } from '../lib/week';

/** Map the wire item status onto the presentational ItemStatus pill key. */
function statusKey(status: CommitItemStatus): ItemStatusKey {
  switch (status) {
    case 'COMPLETE':
      return 'completed';
    case 'INCOMPLETE':
      return 'incomplete';
    case 'CARRIED_FORWARD':
      return 'carried';
    default:
      return 'pending';
  }
}

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
  // The RCDO tree resolves each linked item's Supporting Outcome into its full strategy ladder so the
  // breadcrumb reads as human titles, not an opaque id (read-only detail has no picker to hydrate it).
  const { data: rcdoTree } = useGetRcdoTreeQuery();

  // Flatten the tree to supportingOutcomeId → full RcdoPath (root → leaf), once per tree change.
  const pathById = useMemo<Record<string, RcdoPath>>(() => {
    const map: Record<string, RcdoPath> = {};
    for (const rally of rcdoTree ?? []) {
      for (const dobj of rally.definingObjectives) {
        for (const outcome of dobj.outcomes) {
          for (const so of outcome.supportingOutcomes) {
            map[so.id] = {
              rallyCry: rally.title,
              definingObjective: dobj.title,
              outcome: outcome.title,
              supportingOutcome: so.title,
            };
          }
        }
      }
    }
    return map;
  }, [rcdoTree]);

  if (isLoading) {
    return (
      <div className="page" data-testid="past-commit-detail">
        <div className="panel" style={{ padding: 20 }}>
          <Skeleton lines={4} />
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="page" data-testid="past-commit-detail">
        <ErrorState title="Could not load this week" onRetry={() => void refetch()} />
      </div>
    );
  }

  const done = completedCount(data.items);
  const reconcilable = data.lifecycleState !== 'DRAFT';
  const stateLabel =
    data.lifecycleState === 'RECONCILED' || data.lifecycleState === 'CARRY_FORWARD'
      ? 'reconciled'
      : data.lifecycleState.toLowerCase();

  return (
    <div className="page" data-testid="past-commit-detail">
      <button
        type="button"
        onClick={onBack}
        data-testid="past-back"
        className="btn btn-quiet btn-sm"
        style={{ marginLeft: -8, marginBottom: 10, color: 'var(--ink-low)' }}
      >
        <Icon.chevL size={15} /> History
      </button>

      <div className="panel" style={{ padding: '18px 20px', marginBottom: 18 }}>
        <div className="between wrap">
          <div>
            <div className="kicker" style={{ marginBottom: 6 }}>
              Read-only · {stateLabel}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                {formatWeekRange(data.weekStart)}
              </h1>
              <LifecycleBadge state={data.lifecycleState} />
            </div>
          </div>
          {reconcilable && (
            <button
              type="button"
              className="btn btn-ghost"
              data-testid="past-open-reconcile"
              onClick={() => onReconcile(commitId)}
            >
              <Icon.scale size={15} /> View reconciliation
            </button>
          )}
        </div>
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid var(--line-soft)',
            display: 'flex',
            gap: 22,
            flexWrap: 'wrap',
          }}
        >
          <span className="tnum" style={{ fontSize: 13, color: 'var(--ink-mid)' }}>
            <strong style={{ color: 'var(--signal)', fontSize: 16 }}>
              {done}/{data.items.length}
            </strong>{' '}
            completed
          </span>
          {pulse && pulse.rating !== null && (
            <span
              className="tnum"
              data-testid="past-pulse"
              style={{ fontSize: 13, color: 'var(--ink-mid)' }}
            >
              Pulse <strong style={{ fontSize: 16 }}>{pulse.rating}/5</strong>
            </span>
          )}
        </div>
      </div>

      <SectionTitle title="Commit items" />
      <div className="stack" style={{ gap: 10 }} data-testid="past-items">
        {data.items.map((item) => {
          const path = item.supportingOutcomeId ? pathById[item.supportingOutcomeId] : undefined;
          return (
            <div
              key={item.id}
              data-testid="past-item"
              className="panel"
              style={{
                padding: '13px 15px',
                borderLeft: '3px solid var(--signal)',
                display: 'flex',
                gap: 11,
                alignItems: 'flex-start',
              }}
            >
              {item.chessTier && (
                <span style={{ marginTop: 1 }}>
                  <ChessBadge tier={item.chessTier} showLabel={false} />
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{item.text}</div>
                {path && (
                  <div style={{ marginTop: 8 }}>
                    <RcdoBreadcrumb path={path} compact />
                  </div>
                )}
              </div>
              <ItemStatus status={statusKey(item.status)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
