// libs/ui/src/tokens.ts — the typed design-system surface for the WCM re-skin (OKLCH + IBM Plex).
// Re-exports the OKLCH color literals from theme.colors.mjs (the single source shared with
// tailwind.config.js + global.css) and adds the typed maps runtime code consumes: LIFECYCLE_VISUAL
// (one consistent badge = CSS-var color + dim + icon + label per state), the chess tier
// label/order/weight/glyph/hint + CHESS_COLOR maps, and RCDO_LEVEL (level → CSS-var color) for the
// strategy tree. Components read the CSS-var strings here (e.g. 'var(--signal)') so the single
// global.css owns resolved values; the *.hex fields are for non-CSS surfaces (charts) only. A brand
// swap is one edit in theme.colors.mjs; this module stays framework-agnostic.
import type { ChessTier, LifecycleState } from '@wcm/types';
import {
  SURFACE,
  LINE,
  INK,
  SIGNAL,
  AMBER,
  RED,
  CYAN,
  VIOLET,
  SLATE,
  RADII,
  SHADOW,
  SEMANTIC,
  HEX,
  FONT_SANS,
  FONT_MONO,
  FONT_SERIF,
} from './theme.colors.mjs';

export {
  SURFACE,
  LINE,
  INK,
  SIGNAL,
  AMBER,
  RED,
  CYAN,
  VIOLET,
  SLATE,
  RADII,
  SHADOW,
  SEMANTIC,
  HEX,
  FONT_SANS,
  FONT_MONO,
  FONT_SERIF,
};

/** Flat color map — every brand/status family in one object (OKLCH values, by family). */
export const COLORS = {
  surface: SURFACE,
  line: LINE,
  ink: INK,
  signal: SIGNAL,
  amber: AMBER,
  red: RED,
  cyan: CYAN,
  violet: VIOLET,
  slate: SLATE,
} as const;

/** CSS custom-property names (without the `var()` wrapper) — the canonical token-name registry.
 * Reference 'var(--signal)' inline, or wrap a name with cssVar(). Kept as a const map so a typo in
 * a component is a compile error against the known token set, not a silent no-op. */
export const CSS_VARS = {
  // surfaces
  void: '--void',
  base: '--base',
  surface1: '--surface-1',
  surface2: '--surface-2',
  surface3: '--surface-3',
  // hairlines
  line: '--line',
  lineSoft: '--line-soft',
  lineBright: '--line-bright',
  // text
  ink: '--ink',
  inkMid: '--ink-mid',
  inkLow: '--ink-low',
  inkFaint: '--ink-faint',
  // brand / status
  signal: '--signal',
  signalDim: '--signal-dim',
  signalDeep: '--signal-deep',
  amber: '--amber',
  amberDim: '--amber-dim',
  red: '--red',
  redDim: '--red-dim',
  cyan: '--cyan',
  cyanDim: '--cyan-dim',
  violet: '--violet',
  violetDim: '--violet-dim',
  slate: '--slate',
  slateDim: '--slate-dim',
  // radii
  rXs: '--r-xs',
  rSm: '--r-sm',
  rMd: '--r-md',
  rLg: '--r-lg',
  rPill: '--r-pill',
  // elevation
  shadow1: '--shadow-1',
  shadow2: '--shadow-2',
  shadowPop: '--shadow-pop',
} as const;

/** Wrap a CSS custom-property name in `var()`. */
export function cssVar(name: string): string {
  return `var(${name})`;
}

/** Human-readable lifecycle labels — NEVER render the raw enum slug in viewer-facing copy. */
export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  DRAFT: 'Draft',
  LOCKED: 'Locked',
  RECONCILING: 'Reconciling',
  RECONCILED: 'Reconciled',
  CARRY_FORWARD: 'Carried forward',
};

/** Icon key (from libs/ui icons) each lifecycle state pairs with in the one consistent badge. */
export type LifecycleIcon = 'pencil' | 'lock' | 'reconcile' | 'checkCircle' | 'forward';

interface LifecycleVisual {
  /** Human-readable label. */
  label: string;
  /** Foreground color as a CSS-var reference (the lifecycle alias). */
  color: string;
  /** Light tint fill as a CSS-var reference. */
  dim: string;
  /** Icon key paired with the label (never icon-only — visible text always carries the meaning). */
  icon: LifecycleIcon;
  /** ~Hex swatch for non-CSS surfaces (charts). */
  hex: string;
}

/** The one consistent lifecycle status treatment reused everywhere (color + dim + icon + label). */
export const LIFECYCLE_VISUAL: Record<LifecycleState, LifecycleVisual> = {
  DRAFT: {
    label: 'Draft',
    color: 'var(--lc-draft)',
    dim: 'var(--lc-draft-dim)',
    icon: 'pencil',
    hex: HEX.slate,
  },
  LOCKED: {
    label: 'Locked',
    color: 'var(--lc-locked)',
    dim: 'var(--lc-locked-dim)',
    icon: 'lock',
    hex: HEX.cyan,
  },
  RECONCILING: {
    label: 'Reconciling',
    color: 'var(--lc-reconciling)',
    dim: 'var(--lc-reconciling-dim)',
    icon: 'reconcile',
    hex: HEX.amber,
  },
  RECONCILED: {
    label: 'Reconciled',
    color: 'var(--lc-reconciled)',
    dim: 'var(--lc-reconciled-dim)',
    icon: 'checkCircle',
    hex: HEX.signal,
  },
  CARRY_FORWARD: {
    label: 'Carried forward',
    color: 'var(--lc-carry)',
    dim: 'var(--lc-carry-dim)',
    icon: 'forward',
    hex: HEX.violet,
  },
};

/** Ordered chess tiers, KING highest → PAWN lowest (mirrors contract ChessTier ordering). */
export const CHESS_ORDER: ChessTier[] = ['KING', 'QUEEN', 'ROOK', 'BISHOP', 'KNIGHT', 'PAWN'];

/** Human-readable chess-tier labels (swappable scheme — keep data-driven). */
export const CHESS_LABEL: Record<ChessTier, string> = {
  KING: 'King',
  QUEEN: 'Queen',
  ROOK: 'Rook',
  BISHOP: 'Bishop',
  KNIGHT: 'Knight',
  PAWN: 'Pawn',
};

/** Numeric weight for sorting/emphasis (higher = more strategic weight; KING heaviest). */
export const CHESS_WEIGHT: Record<ChessTier, number> = {
  KING: 6,
  QUEEN: 5,
  ROOK: 4,
  BISHOP: 3,
  KNIGHT: 2,
  PAWN: 1,
};

/** Unicode chess glyph per tier (read-only badge; higher reads weightier but stays restrained). */
export const CHESS_GLYPH: Record<ChessTier, string> = {
  KING: '♚', // black king ♚
  QUEEN: '♛', // black queen ♛
  ROOK: '♜', // black rook ♜
  BISHOP: '♝', // black bishop ♝
  KNIGHT: '♞', // black knight ♞
  PAWN: '♟', // black pawn ♟
};

/** One-line priority hint per tier (tooltip / a11y title). */
export const CHESS_HINT: Record<ChessTier, string> = {
  KING: 'Top strategic weight',
  QUEEN: 'High priority',
  ROOK: 'Standard priority',
  BISHOP: 'Moderate priority',
  KNIGHT: 'Lower priority',
  PAWN: 'Supporting / small',
};

/** Border-emphasis color per tier as a CSS-var reference — heavier tiers get the brighter hairline.
 * Restrained on purpose (finance tool, not a game): emphasis is line weight/tone, not hue. */
export const CHESS_COLOR: Record<ChessTier, string> = {
  KING: 'var(--line-bright)',
  QUEEN: 'var(--line-bright)',
  ROOK: 'var(--line-soft)',
  BISHOP: 'var(--line-soft)',
  KNIGHT: 'var(--line-soft)',
  PAWN: 'var(--line-soft)',
};

/** RCDO strategy-tree level (4 levels). Items link to the leaf (Supporting Outcome). */
export type RcdoLevel = 'RALLY_CRY' | 'DEFINING_OBJECTIVE' | 'OUTCOME' | 'SUPPORTING_OUTCOME';

interface RcdoLevelVisual {
  /** Human-readable level label. */
  label: string;
  /** Level rail/dot color as a CSS-var reference. */
  color: string;
  /** Light tint fill as a CSS-var reference. */
  dim: string;
}

/** Level colors per the brief: Rally Cry violet, Defining Objective cyan, Outcome amber,
 * Supporting Outcome signal-green (the linkable leaf). */
export const RCDO_LEVEL: Record<RcdoLevel, RcdoLevelVisual> = {
  RALLY_CRY: { label: 'Rally Cry', color: 'var(--violet)', dim: 'var(--violet-dim)' },
  DEFINING_OBJECTIVE: {
    label: 'Defining Objective',
    color: 'var(--cyan)',
    dim: 'var(--cyan-dim)',
  },
  OUTCOME: { label: 'Outcome', color: 'var(--amber)', dim: 'var(--amber-dim)' },
  SUPPORTING_OUTCOME: {
    label: 'Supporting Outcome',
    color: 'var(--signal)',
    dim: 'var(--signal-dim)',
  },
};
