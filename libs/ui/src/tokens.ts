// libs/ui/src/tokens.ts — the typed design-system surface for the WCM (design brief §3/§4).
// Re-exports the color literals from theme.colors.mjs (the single source shared with tailwind.config.js)
// and adds the typed lifecycle + chess-tier maps that runtime code consumes (LifecycleBadge, chess
// display/sort). A brand swap is one edit in theme.colors.mjs; this stays framework-agnostic.
import type { ChessTier, LifecycleState } from '@wcm/types';
import { PRIMARY, ACCENT, NEUTRAL, SEMANTIC, FONT_SANS } from './theme.colors.mjs';

export { PRIMARY, ACCENT, NEUTRAL, SEMANTIC, FONT_SANS };

/** Flat color map (kept for callers that want the whole palette object). */
export const COLORS = {
  primary: PRIMARY,
  accent: ACCENT,
  neutral: NEUTRAL,
  success: SEMANTIC.success,
  warning: SEMANTIC.warning,
  danger: SEMANTIC.danger,
  info: SEMANTIC.info,
} as const;

/** Human-readable lifecycle labels (brief §4.1) — NEVER render the raw enum in viewer-facing copy. */
export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  DRAFT: 'Draft',
  LOCKED: 'Locked',
  RECONCILING: 'Reconciling',
  RECONCILED: 'Reconciled',
  CARRY_FORWARD: 'Carried forward',
};

/** The semantic intent each lifecycle state maps to. */
export type SemanticIntent = 'draft' | 'info' | 'warning' | 'success' | 'accent';

interface LifecycleVisual {
  /** Human-readable label. */
  label: string;
  /** Semantic intent (drives the design color and the Flowbite color prop). */
  intent: SemanticIntent;
  /** Flowbite Badge `color` token. */
  flowbiteColor: 'gray' | 'info' | 'warning' | 'success' | 'indigo';
  /** Hex swatch from the token palette (for charts / non-Flowbite surfaces). */
  hex: string;
}

/** The one consistent lifecycle status treatment reused everywhere (brief §4.1). */
export const LIFECYCLE_VISUAL: Record<LifecycleState, LifecycleVisual> = {
  DRAFT: { label: 'Draft', intent: 'draft', flowbiteColor: 'gray', hex: SEMANTIC.draft },
  LOCKED: { label: 'Locked', intent: 'info', flowbiteColor: 'info', hex: SEMANTIC.info },
  RECONCILING: { label: 'Reconciling', intent: 'warning', flowbiteColor: 'warning', hex: SEMANTIC.warning },
  RECONCILED: { label: 'Reconciled', intent: 'success', flowbiteColor: 'success', hex: SEMANTIC.success },
  CARRY_FORWARD: { label: 'Carried forward', intent: 'accent', flowbiteColor: 'indigo', hex: ACCENT[500] },
};

/** Ordered chess tiers, KING highest → PAWN lowest (mirrors contract ChessTier ordering). */
export const CHESS_ORDER: ChessTier[] = ['KING', 'QUEEN', 'ROOK', 'BISHOP', 'KNIGHT', 'PAWN'];

/** Human-readable chess-tier labels (swappable scheme per brief §6.3.2). */
export const CHESS_LABEL: Record<ChessTier, string> = {
  KING: 'King',
  QUEEN: 'Queen',
  ROOK: 'Rook',
  BISHOP: 'Bishop',
  KNIGHT: 'Knight',
  PAWN: 'Pawn',
};

/** Numeric weight for sorting/emphasis (higher = more strategic weight). */
export const CHESS_WEIGHT: Record<ChessTier, number> = {
  KING: 6,
  QUEEN: 5,
  ROOK: 4,
  BISHOP: 3,
  KNIGHT: 2,
  PAWN: 1,
};
