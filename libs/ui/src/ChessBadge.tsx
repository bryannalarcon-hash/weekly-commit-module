// libs/ui/src/ChessBadge.tsx — the read-only chess-tier priority badge (brief §6.3.2), re-skinned to
// the WCM design (prototype/wcm/ui.jsx ChessBadge): a restrained chip whose WEIGHT (border brightness,
// label boldness, glyph opacity) scales with the tier — higher reads weightier but never a loud color
// explosion (this is a finance tool, emphasis is tone/line, not hue). Tier label/order/weight/glyph/hint
// come from tokens.ts so the scheme stays swappable. Preserves data-testid=chess-tier-badge + data-tier.
import type { ChessTier } from '@wcm/types';
import { CHESS_GLYPH, CHESS_HINT, CHESS_LABEL, CHESS_WEIGHT } from './tokens';

export interface ChessBadgeProps {
  tier: ChessTier;
  /** Show the text label beside the glyph (default true). When false, a glyph-only chip. */
  showLabel?: boolean;
  className?: string;
}

export function ChessBadge({
  tier,
  showLabel = true,
  className,
}: ChessBadgeProps): JSX.Element {
  const weight = CHESS_WEIGHT[tier];
  // Brief uses a 1..4-ish weight band for visual emphasis; map the 1..6 tier weight onto it.
  const emphasis = weight >= 5 ? 4 : weight >= 4 ? 3 : weight >= 3 ? 2 : 1;
  const strong = emphasis >= 3;
  return (
    <span
      data-testid="chess-tier-badge"
      data-tier={tier}
      title={`${CHESS_LABEL[tier]} · ${CHESS_HINT[tier]}`}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: showLabel ? '3px 9px 3px 7px' : 3,
        borderRadius: 'var(--r-sm)',
        background: strong ? 'var(--surface-2)' : 'transparent',
        border: `1px solid ${emphasis === 4 ? 'var(--line-bright)' : 'var(--line-soft)'}`,
        color: strong ? 'var(--ink)' : 'var(--ink-low)',
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1, opacity: 0.55 + emphasis * 0.11 }} aria-hidden>
        {CHESS_GLYPH[tier]}
      </span>
      {showLabel && (
        <span style={{ fontSize: 11.5, fontWeight: strong ? 700 : 600 }}>{CHESS_LABEL[tier]}</span>
      )}
    </span>
  );
}
