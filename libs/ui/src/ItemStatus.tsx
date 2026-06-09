// libs/ui/src/ItemStatus.tsx — the status pill for a commit item's reconciliation/read-only outcome
// (design components.jsx <ItemStatus>). One small token-mapped chip = icon + human-readable label +
// a status-tinted fill/border, NEVER color-only (the visible text always carries the meaning). The
// `status` prop is a presentational key (completed/incomplete/carried/added/pending) that the consuming
// screen maps from the contract's CommitItemStatus / ReconciliationFlag; an unknown key renders nothing.
import { getIcon } from './icons';

/** Presentational status keys this pill renders (mapped by the screen from the wire enums). */
export type ItemStatusKey =
  | 'completed'
  | 'incomplete'
  | 'carried'
  | 'added'
  | 'pending';

interface StatusVisual {
  label: string;
  /** Foreground/border color as a CSS-var reference. */
  color: string;
  /** Light tint fill as a CSS-var reference. */
  dim: string;
  /** Icon key from the design Icon map (resolved via getIcon; text label always present alongside it). */
  icon: string;
}

/** Label + tone + icon per status (mirrors components.jsx exactly; tokens own the resolved colors). */
const STATUS_VISUAL: Record<ItemStatusKey, StatusVisual> = {
  completed: { label: 'Completed', color: 'var(--signal)', dim: 'var(--signal-dim)', icon: 'checkCircle' },
  incomplete: { label: 'Incomplete', color: 'var(--red)', dim: 'var(--red-dim)', icon: 'x' },
  carried: { label: 'Carried forward', color: 'var(--violet)', dim: 'var(--violet-dim)', icon: 'carry' },
  added: { label: 'Added after lock', color: 'var(--amber)', dim: 'var(--amber-dim)', icon: 'plus' },
  pending: { label: 'In progress', color: 'var(--ink-low)', dim: 'var(--surface-2)', icon: 'clock' },
};

export interface ItemStatusProps {
  status: ItemStatusKey;
  className?: string;
}

/** Inline status pill. Returns null for an unknown status (defensive: bad data renders nothing). */
export function ItemStatus({ status, className }: ItemStatusProps): JSX.Element | null {
  const visual = STATUS_VISUAL[status];
  if (!visual) return null;
  const Glyph = getIcon(visual.icon);
  return (
    <span
      data-testid="item-status"
      data-status={status}
      className={`inline-flex items-center whitespace-nowrap ${className ?? ''}`.trim()}
      style={{
        gap: 5,
        fontSize: 11.5,
        fontWeight: 600,
        color: visual.color,
        background: visual.dim,
        padding: '3px 9px',
        borderRadius: 'var(--r-pill)',
        border: `1px solid color-mix(in oklch, ${visual.color} 28%, transparent)`,
      }}
    >
      {Glyph && <Glyph size={12} />} {visual.label}
    </span>
  );
}
