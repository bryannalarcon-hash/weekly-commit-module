// apps/wc-remote/src/components/ChessTierSelect.tsx — the chess-tier priority controls (brief §6.3.2).
// ChessTierBadge renders a tier as a restrained, weight-scaled badge (higher tier = heavier ring, never
// a loud color explosion); ChessTierSelect is a compact labelled <select> used per item in EditCommit.
// Labels/order come from @wcm/ui tokens so the scheme stays swappable. Pure/presentational.
import { Label, Select } from 'flowbite-react';
import type { ChessTier } from '@wcm/types';
import { CHESS_LABEL, CHESS_ORDER, CHESS_WEIGHT } from '@wcm/ui';

/** Tailwind ring/weight classes by tier; higher tiers read heavier but stay quiet (brief §6.3.2). */
function badgeClasses(tier: ChessTier): string {
  const w = CHESS_WEIGHT[tier];
  if (w >= 5) return 'bg-primary-100 text-primary-800 ring-primary-300 font-semibold';
  if (w >= 3) return 'bg-slate-100 text-slate-700 ring-slate-300 font-medium';
  return 'bg-slate-50 text-slate-500 ring-slate-200';
}

export interface ChessTierBadgeProps {
  tier: ChessTier;
  className?: string;
}

/** Display-only tier badge (used in read-only rows and the composer). */
export function ChessTierBadge({ tier, className }: ChessTierBadgeProps): JSX.Element {
  return (
    <span
      data-testid="chess-tier-badge"
      data-tier={tier}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] uppercase tracking-wide ring-1 ring-inset ${badgeClasses(tier)} ${className ?? ''}`.trim()}
    >
      {CHESS_LABEL[tier]}
    </span>
  );
}

export interface ChessTierSelectProps {
  value: ChessTier | null;
  onChange: (tier: ChessTier) => void;
  /** Accessible label; rendered visually hidden by default to keep the row compact. */
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/** Compact tier selector — a labelled native select (keyboard + AT friendly). */
export function ChessTierSelect({
  value,
  onChange,
  label = 'Priority tier',
  id,
  disabled,
  className,
}: ChessTierSelectProps): JSX.Element {
  const selectId = id ?? 'chess-tier';
  return (
    <div className={className}>
      <Label htmlFor={selectId} className="sr-only">
        {label}
      </Label>
      <Select
        id={selectId}
        sizing="sm"
        value={value ?? ''}
        disabled={disabled}
        data-testid="chess-tier-select"
        aria-label={label}
        onChange={(e) => onChange(e.target.value as ChessTier)}
      >
        <option value="" disabled>
          Set priority…
        </option>
        {CHESS_ORDER.map((tier) => (
          <option key={tier} value={tier}>
            {CHESS_LABEL[tier]}
          </option>
        ))}
      </Select>
    </div>
  );
}
