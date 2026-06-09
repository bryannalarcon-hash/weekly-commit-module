// libs/ui/src/ValidationSummary.tsx — the pre-lock blocker banner (design components.jsx
// <ValidationSummary>): an amber, non-color-only notice ("N items need a Supporting Outcome") that
// explains WHY Submit is disabled and offers a "Review" jump to fix them. role=status so AT announces
// the count politely as it changes. Pluralizes correctly; renders nothing when count <= 0.
import { Icon } from './icons';

export interface ValidationSummaryProps {
  /** How many items still need a Supporting Outcome before the week can lock. */
  count: number;
  /** Optional "Review"/"jump to fix" handler — when present, a button is shown. */
  onFix?: () => void;
  className?: string;
}

export function ValidationSummary({
  count,
  onFix,
  className,
}: ValidationSummaryProps): JSX.Element | null {
  if (count <= 0) return null;
  const plural = count !== 1;
  return (
    <div
      role="status"
      data-testid="validation-summary"
      className={`flex items-center ${className ?? ''}`.trim()}
      style={{
        gap: 11,
        padding: '12px 16px',
        borderRadius: 'var(--r-md)',
        background: 'var(--amber-dim)',
        border: '1px solid color-mix(in oklch, var(--amber) 32%, transparent)',
      }}
    >
      <span style={{ color: 'var(--amber)', flex: 'none' }}>
        <Icon.alert size={18} />
      </span>
      <div style={{ flex: 1, fontSize: 13.5, color: 'var(--ink-mid)' }}>
        <strong style={{ color: 'var(--ink)' }}>
          {count} item{plural ? 's' : ''} need{plural ? '' : 's'} a Supporting Outcome
        </strong>{' '}
        before you can lock. Every commit must link to strategy.
      </div>
      {onFix && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          data-testid="validation-review"
          onClick={onFix}
        >
          Review
        </button>
      )}
    </div>
  );
}
