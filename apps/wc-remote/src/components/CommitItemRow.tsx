// apps/wc-remote/src/components/CommitItemRow.tsx — the read-only commit-item row (brief §7), used on
// the Locked My-Week view, Past-commit detail, and the manager Review detail. Shows the item text, its
// chess-tier badge, the linked Supporting Outcome chip (or the visible "needs a Supporting Outcome"
// affordance), and an actual-status pill. The editable composer variant lives in SortableCommitItem.tsx.
import type { CommitItemDto } from '@wcm/types';
import { RcdoChip } from '@wcm/ui';
import { ChessTierBadge } from './ChessTierSelect';

/** Human-readable label + tone for a live item status (text, never color-only). */
const STATUS_META: Record<
  CommitItemDto['status'],
  { label: string; cls: string }
> = {
  OPEN: { label: 'Open', cls: 'bg-slate-100 text-slate-600' },
  COMPLETE: { label: 'Completed', cls: 'bg-green-100 text-green-800' },
  INCOMPLETE: { label: 'Incomplete', cls: 'bg-amber-100 text-amber-800' },
  CARRIED_FORWARD: { label: 'Carried forward', cls: 'bg-indigo-100 text-indigo-800' },
};

export interface CommitItemRowProps {
  item: CommitItemDto;
  /** Title of the linked Supporting Outcome, resolved by the parent (null when unlinked). */
  outcomeTitle?: string | null;
  /** Show the actual-status pill (Reconciliation / past detail); hidden on a fresh draft view. */
  showStatus?: boolean;
  className?: string;
}

export function CommitItemRow({
  item,
  outcomeTitle,
  showStatus = true,
  className,
}: CommitItemRowProps): JSX.Element {
  const status = STATUS_META[item.status];
  return (
    <li
      data-testid="commit-item-row"
      data-item-id={item.id}
      className={`flex flex-col gap-2 rounded border border-slate-200 bg-white px-4 py-3 ${className ?? ''}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 break-words text-sm text-slate-800">{item.text}</p>
        <div className="flex shrink-0 items-center gap-2">
          {item.chessTier && <ChessTierBadge tier={item.chessTier} />}
          {showStatus && (
            <span
              data-testid="item-status"
              data-status={item.status}
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${status.cls}`}
            >
              {status.label}
            </span>
          )}
        </div>
      </div>
      <RcdoChip title={item.supportingOutcomeId ? (outcomeTitle ?? 'Linked outcome') : null} />
    </li>
  );
}
