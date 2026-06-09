// apps/wc-remote/src/screens/Reconciliation.tsx — the planned-vs-actual reconciliation view (brief
// §6.6, U20). Two columns: PLANNED (the immutable snapshot frozen at lock — text/tier) vs ACTUAL (the
// live per-item status the user sets while RECONCILING), each row carrying a lifecycle flag badge
// (completed / incomplete / carried forward / added after lock). States: loading, NOT-YET-LOCKED guard
// (a Draft commit cannot be reconciled — guide back), in-progress (RECONCILING — status editable),
// reconciled (read-only), error. The carry-forward action (confirm + optimistic mutation) moves
// incomplete items into next week. All data + mutations via RTK Query.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Select } from 'flowbite-react';
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
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LifecycleBadge,
  Skeleton,
} from '@wcm/ui';
import { ChessTierBadge } from '../components/ChessTierSelect';

/** Human-readable flag label + tone (text, never color-only). */
const FLAG_META: Record<ReconciliationFlag, { label: string; cls: string }> = {
  COMPLETED: { label: 'Completed', cls: 'bg-green-100 text-green-800' },
  INCOMPLETE: { label: 'Incomplete', cls: 'bg-amber-100 text-amber-800' },
  CARRIED: { label: 'Carried forward', cls: 'bg-indigo-100 text-indigo-800' },
  ADDED_AFTER_LOCK: { label: 'Added after lock', cls: 'bg-slate-200 text-slate-700' },
};

const STATUS_OPTIONS: { value: CommitItemStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'COMPLETE', label: 'Completed' },
  { value: 'INCOMPLETE', label: 'Incomplete' },
  { value: 'CARRIED_FORWARD', label: 'Carried forward' },
];

export interface ReconciliationProps {
  commitId: string;
  /** Route back to My Week (used by the not-yet-locked guard). */
  onBackToWeek: () => void;
}

export function Reconciliation({ commitId, onBackToWeek }: ReconciliationProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetReconciliationQuery(commitId);
  const [patchStatus] = usePatchItemStatusMutation();
  const [markReconciled, reconciledState] = useMarkReconciledMutation();
  const [carryForward, carryState] = useCarryForwardMutation();
  const [carryOpen, setCarryOpen] = useState(false);
  // Local optimistic status per item so the Select reflects the user's choice immediately while the
  // debounced PATCH + refetch is in flight (otherwise the controlled value snaps back to the server's).
  const [localStatus, setLocalStatus] = useState<Record<string, CommitItemStatus>>({});

  // Deferred-fix: debounce the per-item status PATCH so a fast toggle through the Select options
  // coalesces into a single request, avoiding the flicker / fast-toggle race (each PATCH invalidates
  // the reconciliation cache → refetch). Timers are keyed by itemId and cleared on unmount.
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

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6" data-testid="reconciliation">
        <Skeleton lines={8} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl p-6" data-testid="reconciliation">
        <ErrorState title="Could not load reconciliation" onRetry={() => void refetch()} />
      </div>
    );
  }

  // Not-yet-locked guard: a Draft commit has no frozen plan to compare against (brief §6.6).
  if (data.lifecycleState === 'DRAFT') {
    return (
      <section className="mx-auto max-w-2xl p-6" data-testid="reconciliation">
        <EmptyState
          title="This week isn’t locked yet"
          description="Lock your week first to freeze the plan, then come back to compare what actually happened."
          action={
            <Button color="blue" onClick={onBackToWeek} data-testid="recon-back-to-week">
              Back to my week
            </Button>
          }
        />
      </section>
    );
  }

  const editable = data.lifecycleState === 'RECONCILING';
  const reconciled = data.lifecycleState === 'RECONCILED';
  const incompleteCount = data.rows.filter((r) => r.flag === 'INCOMPLETE').length;
  const completedCount = data.rows.filter((r) => r.flag === 'COMPLETED').length;
  const carryCount = data.rows.filter((r) => r.flag === 'CARRIED').length;

  return (
    <section className="mx-auto max-w-4xl space-y-4 p-6" data-testid="reconciliation">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary-900">Reconciliation</h1>
          <p className="text-sm text-slate-500">
            Compare what you planned at lock against what actually happened.
          </p>
        </div>
        <LifecycleBadge state={data.lifecycleState} />
      </header>

      <dl className="flex flex-wrap gap-4 text-sm" data-testid="recon-summary">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Completed</dt>
          <dd className="text-lg font-semibold tabular-nums text-green-700">{completedCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Incomplete</dt>
          <dd className="text-lg font-semibold tabular-nums text-amber-700">{incompleteCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Carried</dt>
          <dd className="text-lg font-semibold tabular-nums text-indigo-700">{carryCount}</dd>
        </div>
      </dl>

      {/* Two-column header (collapses to stacked on narrow widths). */}
      <div className="hidden grid-cols-2 gap-4 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
        <span>Planned (locked)</span>
        <span>Actual</span>
      </div>

      <ul className="space-y-2" data-testid="recon-rows">
        {data.rows.map((row) => (
          <ReconRow
            key={row.commitItemId}
            row={row}
            editable={editable}
            statusValue={localStatus[row.commitItemId] ?? row.actualStatus ?? 'OPEN'}
            onStatusChange={(status) => queueStatusChange(row.commitItemId, status)}
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        {editable && (
          <Button
            color="blue"
            onClick={() => void markReconciled(commitId)}
            disabled={reconciledState.isLoading}
            data-testid="mark-reconciled"
          >
            Mark week reconciled
          </Button>
        )}
        {(editable || reconciled) && incompleteCount > 0 && (
          <Button
            color="light"
            onClick={() => setCarryOpen(true)}
            data-testid="carry-forward"
          >
            Carry {incompleteCount} forward to next week
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={carryOpen}
        title="Carry incomplete items forward?"
        confirmLabel="Carry forward"
        busy={carryState.isLoading}
        onConfirm={() =>
          void carryForward(commitId)
            .unwrap()
            .finally(() => setCarryOpen(false))
        }
        onCancel={() => setCarryOpen(false)}
      >
        This copies the {incompleteCount} incomplete{' '}
        {incompleteCount === 1 ? 'item' : 'items'} into next week’s draft, keeping their lineage so
        you can see where they came from. The original week stays unchanged.
      </ConfirmDialog>
    </section>
  );
}

interface ReconRowProps {
  row: ReconciliationRow;
  editable: boolean;
  /** The Select's controlled value (local optimistic choice, else the server's actual). */
  statusValue: CommitItemStatus;
  onStatusChange: (status: CommitItemStatus) => void;
}

/** One planned-vs-actual comparison row. */
function ReconRow({ row, editable, statusValue, onStatusChange }: ReconRowProps): JSX.Element {
  const flag = FLAG_META[row.flag];
  return (
    <li
      data-testid="recon-row"
      data-flag={row.flag}
      className="grid grid-cols-1 gap-3 rounded border border-slate-200 bg-white px-4 py-3 md:grid-cols-2"
    >
      {/* Planned (snapshot). For items added after lock there is no planned side. */}
      <div className="min-w-0">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400 md:hidden">
          Planned
        </span>
        {row.plannedText ? (
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 break-words text-sm text-slate-800">{row.plannedText}</p>
            {row.plannedTier && <ChessTierBadge tier={row.plannedTier} />}
          </div>
        ) : (
          <p className="text-sm italic text-slate-400">Not in the locked plan</p>
        )}
      </div>

      {/* Actual (live status + the flag). */}
      <div className="min-w-0">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400 md:hidden">
          Actual
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="recon-flag"
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${flag.cls}`}
          >
            {flag.label}
          </span>
          {editable && (
            <Select
              sizing="sm"
              value={statusValue}
              aria-label="Set actual status"
              data-testid="recon-status-select"
              onChange={(e) => onStatusChange(e.target.value as CommitItemStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>
    </li>
  );
}
