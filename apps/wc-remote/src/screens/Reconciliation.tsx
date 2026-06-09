// apps/wc-remote/src/screens/Reconciliation.tsx — the planned-vs-actual reconciliation view (brief
// §6.6, U20), re-skinned to the WCM c-design (design/.../page-reconcile.jsx). A header (kicker +
// title + Reconciling LifecycleBadge + a primary "Carry forward & reconcile" action), three tinted
// Metric tiles (Completion %, Completed n/total, Carrying over), the two-column PLANNED (frozen,
// locked-tint, ChessBadge) vs ACTUAL (ItemStatus: completed/incomplete/added-after-lock; incomplete →
// "Will carry forward"; an unplanned/added item renders a "NOT PLANNED" placeholder opposite an amber
// added card). Collapses to a single column on mobile. The ConfirmDialog → POST carry-forward +
// markReconciled drives the "Week reconciled" success banner. States: loading skeleton, NOT-YET-LOCKED
// guard (Draft → back to My Week), in-progress (RECONCILING — per-row status editable), reconciled
// (read-only success), error. All data + mutations via RTK Query (hooks unchanged); the per-item status
// PATCH stays debounced (coalesces fast toggles). Preserves the reconciliation data-testids.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommitItemStatus,
  ReconciliationFlag,
  ReconciliationRow,
} from '@wcm/types';
import {
  useCarryForwardMutation,
  useGetReconciliationQuery,
  useMarkReconciledMutation,
  usePatchItemStatusMutation,
} from '@wcm/api';
import {
  ChessBadge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  ItemStatus,
  LifecycleBadge,
  Metric,
  Skeleton,
  type ItemStatusKey,
} from '@wcm/ui';

/** Map a per-row reconciliation flag onto the ItemStatus pill's presentational key. */
const FLAG_TO_STATUS: Record<ReconciliationFlag, ItemStatusKey> = {
  COMPLETED: 'completed',
  INCOMPLETE: 'incomplete',
  CARRIED: 'carried',
  ADDED_AFTER_LOCK: 'added',
};

/** Selectable actual statuses while RECONCILING (drives the per-row status control). */
const STATUS_OPTIONS: { value: CommitItemStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'COMPLETE', label: 'Completed' },
  { value: 'INCOMPLETE', label: 'Incomplete' },
  { value: 'CARRIED_FORWARD', label: 'Carried forward' },
];

export interface ReconciliationProps {
  commitId: string;
  /** Route back to My Week (used by the not-yet-locked guard + the header back-link). */
  onBackToWeek: () => void;
}

export function Reconciliation({ commitId, onBackToWeek }: ReconciliationProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetReconciliationQuery(commitId);
  const [patchStatus] = usePatchItemStatusMutation();
  const [markReconciled, reconciledState] = useMarkReconciledMutation();
  const [carryForward, carryState] = useCarryForwardMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCarryOpen, setConfirmCarryOpen] = useState(false);
  // Local optimistic status per item so the control reflects the user's choice immediately while the
  // debounced PATCH + refetch is in flight (otherwise the controlled value snaps back to the server's).
  const [localStatus, setLocalStatus] = useState<Record<string, CommitItemStatus>>({});

  // Deferred-fix: debounce the per-item status PATCH so a fast toggle through the options coalesces
  // into a single request, avoiding the flicker / fast-toggle race (each PATCH invalidates the
  // reconciliation cache → refetch). Timers are keyed by itemId and cleared on unmount.
  const statusTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = statusTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const queueStatusChange = useCallback(
    (itemId: string, status: CommitItemStatus) => {
      setLocalStatus((prev) => ({ ...prev, [itemId]: status }));
      const timers = statusTimers.current;
      const existing = timers.get(itemId);
      if (existing) clearTimeout(existing);
      timers.set(
        itemId,
        setTimeout(() => {
          timers.delete(itemId);
          void patchStatus({ commitId, itemId, body: { status } });
        }, 300),
      );
    },
    [commitId, patchStatus],
  );

  // Split rows into planned (have a frozen plan) vs added-after-lock (no planned side), matching the
  // design's two sections of the comparison grid.
  const { plannedRows, addedRows } = useMemo(() => {
    const planned: ReconciliationRow[] = [];
    const added: ReconciliationRow[] = [];
    for (const r of data?.rows ?? []) {
      if (r.flag === 'ADDED_AFTER_LOCK' || r.plannedText == null) added.push(r);
      else planned.push(r);
    }
    return { plannedRows: planned, addedRows: added };
  }, [data?.rows]);

  if (isLoading) {
    return (
      <div className="page mx-auto max-w-4xl p-6" data-testid="reconciliation">
        <div className="panel" style={{ padding: 20, marginBottom: 16 }}>
          <Skeleton lines={1} lineHeight={18} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="panel" style={{ padding: 16 }}>
              <Skeleton lines={2} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="page mx-auto max-w-4xl p-6" data-testid="reconciliation">
        <ErrorState title="Could not load reconciliation" onRetry={() => void refetch()} />
      </div>
    );
  }

  // Not-yet-locked guard: a Draft commit has no frozen plan to compare against (brief §6.6).
  if (data.lifecycleState === 'DRAFT') {
    return (
      <section className="page mx-auto max-w-2xl p-6" data-testid="reconciliation">
        <EmptyState
          icon="lock"
          title="This week isn’t locked yet"
          description="Lock your week first to freeze the plan, then come back to compare what actually happened."
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={onBackToWeek}
              data-testid="recon-back-to-week"
            >
              Back to my week
            </button>
          }
        />
      </section>
    );
  }

  const editable = data.lifecycleState === 'RECONCILING';
  const reconciled = data.lifecycleState === 'RECONCILED';
  const total = plannedRows.length;
  const completedCount = plannedRows.filter((r) => r.flag === 'COMPLETED').length;
  const incompleteCount = plannedRows.filter((r) => r.flag === 'INCOMPLETE').length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const carriedCount = data.rows.filter((r) => r.flag === 'CARRIED').length;
  const carryingOver = incompleteCount + carriedCount;

  return (
    <section className="page mx-auto max-w-4xl p-6" data-testid="reconciliation">
      <button
        type="button"
        className="btn btn-quiet btn-sm"
        onClick={onBackToWeek}
        style={{ marginLeft: -8, marginBottom: 10, color: 'var(--ink-low)' }}
        data-testid="recon-back-to-week"
      >
        <Icon.chevL size={15} /> My Week
      </button>

      {/* Header — success banner when reconciled, else the live reconciling header + action. */}
      {reconciled ? (
        <div
          className="panel"
          data-testid="recon-success"
          style={{
            padding: '18px 20px',
            marginBottom: 18,
            borderLeft: '3px solid var(--signal)',
            background: 'var(--signal-dim)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Icon.checkCircle size={22} style={{ color: 'var(--signal-deep)' }} />
            <div style={{ flex: 1 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
              >
                <div style={{ fontWeight: 700, fontSize: 15 }}>Week reconciled</div>
                {/* The lifecycle badge appears everywhere the week's state does (design §lifecycle);
                    a reconciled week shows its RECONCILED badge here too. */}
                <LifecycleBadge state={data.lifecycleState} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-mid)' }}>
                {incompleteCount > 0
                  ? `${incompleteCount} unfinished ${incompleteCount === 1 ? 'item' : 'items'} can carry forward into next week.`
                  : carriedCount > 0
                    ? `${carriedCount} ${carriedCount === 1 ? 'item' : 'items'} carried forward into next week.`
                    : 'Nothing carried over — every commitment landed.'}
              </div>
            </div>
            {/* Carry-forward is a distinct owner action available once the week is reconciled (the
                FSM/backend keep it separate from the manager's reconcile). Offer it while there are
                still-unfinished items to move into next week. */}
            {incompleteCount > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setConfirmCarryOpen(true)}
                data-testid="carry-forward"
              >
                <Icon.carry size={15} /> Carry forward
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: '18px 20px', marginBottom: 18 }}>
          <div className="between wrap">
            <div>
              <div className="kicker" style={{ marginBottom: 6 }}>
                Reconciliation
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>This week</h1>
                <LifecycleBadge state={data.lifecycleState} />
              </div>
            </div>
            {editable && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setConfirmOpen(true)}
                data-testid="carry-forward"
              >
                <Icon.carry size={15} /> Carry forward &amp; reconcile
              </button>
            )}
          </div>
        </div>
      )}

      {/* Three tinted metric tiles. */}
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        style={{ marginBottom: 20 }}
        data-testid="recon-summary"
      >
        <Metric
          label="Completion"
          value={pct}
          suffix="%"
          accent={pct >= 80 ? 'var(--signal)' : 'var(--amber)'}
          tint={pct >= 80 ? 'var(--signal-dim)' : 'var(--amber-dim)'}
        />
        <Metric
          label="Completed"
          value={`${completedCount}/${total}`}
          accent="var(--ink)"
          tint="var(--cyan-dim)"
        />
        <Metric
          label="Carrying over"
          value={carryingOver}
          accent={carryingOver ? 'var(--violet)' : 'var(--ink)'}
          tint="var(--violet-dim)"
        />
      </div>

      {/* Planned (frozen) vs Actual — two columns on desktop, single column on mobile. */}
      <div
        className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2"
        data-testid="recon-rows"
      >
        <div
          className="kicker"
          style={{ display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <Icon.lock size={13} /> Planned{' '}
          <span style={{ color: 'var(--ink-faint)' }}>· frozen at lock</span>
        </div>
        <div
          className="kicker hidden md:flex"
          style={{ alignItems: 'center', gap: 7 }}
        >
          <Icon.checkCircle size={13} /> Actual
        </div>

        {plannedRows.map((row) => (
          <ReconRow
            key={row.commitItemId}
            row={row}
            editable={editable}
            statusValue={localStatus[row.commitItemId] ?? row.actualStatus ?? 'OPEN'}
            onStatusChange={(status) => queueStatusChange(row.commitItemId, status)}
          />
        ))}

        {addedRows.map((row) => (
          <AddedRow
            key={row.commitItemId}
            row={row}
            editable={editable}
            statusValue={localStatus[row.commitItemId] ?? row.actualStatus ?? 'OPEN'}
            onStatusChange={(status) => queueStatusChange(row.commitItemId, status)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        icon="scale"
        title="Reconcile this week?"
        confirmLabel="Reconcile week"
        busy={carryState.isLoading || reconciledState.isLoading}
        onConfirm={() => {
          void (async () => {
            try {
              if (incompleteCount > 0) await carryForward(commitId).unwrap();
              await markReconciled(commitId).unwrap();
            } finally {
              setConfirmOpen(false);
            }
          })();
        }}
        onCancel={() => setConfirmOpen(false)}
      >
        This closes the week as reconciled.{' '}
        {incompleteCount > 0
          ? `The ${incompleteCount} incomplete ${incompleteCount === 1 ? 'item' : 'items'} will be carried forward into next week’s commit, keeping their lineage.`
          : 'Every commitment landed — nothing carries forward.'}
      </ConfirmDialog>

      {/* Post-reconcile carry-forward (the owner's action once the week is RECONCILED): carries the
          still-unfinished items into next week's draft — no re-reconcile. */}
      <ConfirmDialog
        open={confirmCarryOpen}
        icon="carry"
        title="Carry unfinished work forward?"
        confirmLabel="Carry forward"
        busy={carryState.isLoading}
        onConfirm={() => {
          void (async () => {
            try {
              await carryForward(commitId).unwrap();
            } finally {
              setConfirmCarryOpen(false);
            }
          })();
        }}
        onCancel={() => setConfirmCarryOpen(false)}
      >
        {`The ${incompleteCount} unfinished ${incompleteCount === 1 ? 'item' : 'items'} will be copied into next week’s draft commit, keeping their lineage.`}
      </ConfirmDialog>
    </section>
  );
}

interface ReconRowProps {
  row: ReconciliationRow;
  editable: boolean;
  /** The status control's controlled value (local optimistic choice, else the server's actual). */
  statusValue: CommitItemStatus;
  onStatusChange: (status: CommitItemStatus) => void;
}

/** One planned-vs-actual comparison pair: a frozen PLANNED cell + the live ACTUAL cell. */
function ReconRow({ row, editable, statusValue, onStatusChange }: ReconRowProps): JSX.Element {
  const status = FLAG_TO_STATUS[row.flag];
  const incomplete = row.flag === 'INCOMPLETE';
  const actualBg = incomplete ? 'var(--red-dim)' : 'var(--surface-1)';
  const actualAccent =
    row.flag === 'COMPLETED'
      ? 'var(--signal)'
      : incomplete
        ? 'var(--red)'
        : row.flag === 'CARRIED'
          ? 'var(--violet)'
          : 'var(--line-bright)';
  return (
    <>
      {/* PLANNED (frozen snapshot) — locked-tint left bar. */}
      <div
        className="panel"
        style={{ padding: '13px 15px', height: '100%', borderLeft: '3px solid var(--lc-locked)' }}
      >
        <span className="kicker mb-2 block md:hidden">Planned</span>
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          {row.plannedTier && (
            <span style={{ marginTop: 1 }}>
              <ChessBadge tier={row.plannedTier} showLabel={false} />
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{row.plannedText}</div>
          </div>
        </div>
      </div>

      {/* ACTUAL — status-tinted left bar + the ItemStatus pill + the editable control. */}
      <div
        data-testid="recon-row"
        data-flag={row.flag}
        className="panel"
        style={{
          padding: '13px 15px',
          height: '100%',
          borderLeft: `3px solid ${actualAccent}`,
          background: actualBg,
        }}
      >
        <span className="kicker mb-2 block md:hidden">Actual</span>
        <div className="between" style={{ alignItems: 'flex-start', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, minWidth: 0 }}>
            {row.plannedText}
          </div>
          <span data-testid="recon-flag">
            <ItemStatus status={status} />
          </span>
        </div>
        {incomplete && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--ink-mid)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon.carry size={13} style={{ color: 'var(--violet)' }} /> Will carry forward to next
            week
          </div>
        )}
        {editable && (
          <div style={{ marginTop: 10 }}>
            <StatusSelect value={statusValue} onChange={onStatusChange} />
          </div>
        )}
      </div>
    </>
  );
}

/** An added-after-lock item: a "NOT PLANNED" placeholder opposite the amber added ACTUAL card. */
function AddedRow({ row, editable, statusValue, onStatusChange }: ReconRowProps): JSX.Element {
  return (
    <>
      <div
        className="mono"
        style={{
          display: 'grid',
          placeItems: 'center',
          border: '1px dashed var(--line)',
          borderRadius: 'var(--r-md)',
          color: 'var(--ink-faint)',
          fontSize: 12,
          padding: 12,
        }}
      >
        NOT PLANNED
      </div>
      <div
        data-testid="recon-row"
        data-flag={row.flag}
        className="panel"
        style={{
          padding: '13px 15px',
          height: '100%',
          borderLeft: '3px solid var(--amber)',
          background: 'var(--amber-dim)',
        }}
      >
        <span className="kicker mb-2 block md:hidden">Actual</span>
        <div className="between" style={{ alignItems: 'flex-start', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, minWidth: 0 }}>
            {row.plannedText ?? <span style={{ color: 'var(--ink-faint)' }}>Not in the locked plan</span>}
          </div>
          <span data-testid="recon-flag">
            <ItemStatus status="added" />
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-mid)' }}>
          Added after the week was locked
        </div>
        {editable && (
          <div style={{ marginTop: 10 }}>
            <StatusSelect value={statusValue} onChange={onStatusChange} />
          </div>
        )}
      </div>
    </>
  );
}

interface StatusSelectProps {
  value: CommitItemStatus;
  onChange: (status: CommitItemStatus) => void;
}

/** The per-row actual-status control (native select styled by the global .input class). */
function StatusSelect({ value, onChange }: StatusSelectProps): JSX.Element {
  return (
    <select
      className="input"
      value={value}
      aria-label="Set actual status"
      data-testid="recon-status-select"
      style={{ fontSize: 12.5, padding: '6px 9px', width: 'auto' }}
      onChange={(e) => onChange(e.target.value as CommitItemStatus)}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
