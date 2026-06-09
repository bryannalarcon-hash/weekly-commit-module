// libs/ui/src/ChessSelector.tsx — the chess-tier picker (brief §6.3.2), re-skinned to the WCM design
// (prototype/wcm/ui.jsx ChessSelector): a segmented radiogroup of tier buttons in an inset track; the
// selected tier lifts onto surface-1 with a subtle shadow. Keyboard + AT friendly (role=radiogroup /
// role=radio + aria-checked). Tier order/labels/glyphs/hints come from tokens.ts (swappable scheme).
// Preserves data-testid=chess-tier-select on the group; each option carries data-tier.
import type { ChessTier } from '@wcm/types';
import { CHESS_GLYPH, CHESS_HINT, CHESS_LABEL, CHESS_ORDER } from './tokens';

export interface ChessSelectorProps {
  value: ChessTier | null;
  onChange: (tier: ChessTier) => void;
  /** Accessible group label. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function ChessSelector({
  value,
  onChange,
  label = 'Priority tier',
  disabled = false,
  className,
}: ChessSelectorProps): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid="chess-tier-select"
      className={className}
      style={{
        display: 'inline-flex',
        gap: 4,
        background: 'var(--surface-2)',
        padding: 3,
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--line)',
      }}
    >
      {CHESS_ORDER.map((tier) => {
        const on = value === tier;
        return (
          <button
            key={tier}
            type="button"
            role="radio"
            aria-checked={on}
            data-tier={tier}
            disabled={disabled}
            title={CHESS_HINT[tier]}
            onClick={() => onChange(tier)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 9px',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              borderRadius: 'var(--r-xs)',
              background: on ? 'var(--surface-1)' : 'transparent',
              boxShadow: on ? 'var(--shadow-1)' : 'none',
              color: on ? 'var(--ink)' : 'var(--ink-low)',
              fontWeight: on ? 700 : 600,
              fontSize: 12,
              fontFamily: 'var(--sans)',
            }}
          >
            <span style={{ fontSize: 14, opacity: 0.85 }} aria-hidden>
              {CHESS_GLYPH[tier]}
            </span>
            {CHESS_LABEL[tier]}
          </button>
        );
      })}
    </div>
  );
}
