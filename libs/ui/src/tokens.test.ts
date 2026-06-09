// libs/ui/src/tokens.test.ts — guards the OKLCH design-token contract (re-skin source of truth).
// Asserts: every lifecycle/chess enum has a human-readable label; each lifecycle visual carries a
// CSS-var color + dim, an icon key, and a real hex swatch; chess ordering is strictly descending by
// weight (KING highest); RCDO levels map to the briefed colors (Rally Cry violet, DO cyan, Outcome
// amber, SO signal); and no raw enum slug leaks as a viewer-facing label. A token swap then cannot
// silently drop a state, break sorting, or surface an internal slug.
import { describe, expect, it } from 'vitest';
import type { ChessTier, LifecycleState } from '@wcm/types';
import {
  CHESS_COLOR,
  CHESS_GLYPH,
  CHESS_HINT,
  CHESS_LABEL,
  CHESS_ORDER,
  CHESS_WEIGHT,
  COLORS,
  CSS_VARS,
  LIFECYCLE_LABEL,
  LIFECYCLE_VISUAL,
  RCDO_LEVEL,
  SIGNAL,
  cssVar,
} from './tokens';

const ALL_STATES: LifecycleState[] = [
  'DRAFT',
  'LOCKED',
  'RECONCILING',
  'RECONCILED',
  'CARRY_FORWARD',
];

describe('design tokens', () => {
  it('maps every lifecycle state to a label, CSS-var color + dim, icon, and hex swatch', () => {
    for (const state of ALL_STATES) {
      const v = LIFECYCLE_VISUAL[state];
      expect(LIFECYCLE_LABEL[state]).toMatch(/\S/);
      expect(v.label).toBe(LIFECYCLE_LABEL[state]);
      expect(v.color).toMatch(/^var\(--lc-[a-z]+\)$/);
      expect(v.dim).toMatch(/^var\(--lc-[a-z]+-dim\)$/);
      expect(v.icon).toMatch(/\S/);
      expect(v.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('never surfaces a raw enum slug as a viewer-facing label', () => {
    for (const state of ALL_STATES) {
      expect(LIFECYCLE_LABEL[state]).not.toContain('_');
      expect(LIFECYCLE_LABEL[state]).not.toBe(state);
    }
  });

  it('orders chess tiers strictly descending by weight (KING highest, PAWN lowest)', () => {
    expect(CHESS_ORDER[0]).toBe('KING');
    expect(CHESS_ORDER[CHESS_ORDER.length - 1]).toBe('PAWN');
    for (let i = 1; i < CHESS_ORDER.length; i += 1) {
      const prev = CHESS_ORDER[i - 1] as ChessTier;
      const cur = CHESS_ORDER[i] as ChessTier;
      expect(CHESS_WEIGHT[prev]).toBeGreaterThan(CHESS_WEIGHT[cur]);
    }
  });

  it('gives every chess tier a label, glyph, hint, and CSS-var border color', () => {
    for (const tier of CHESS_ORDER) {
      expect(CHESS_LABEL[tier]).toMatch(/\S/);
      expect(CHESS_GLYPH[tier]).toMatch(/\S/);
      expect(CHESS_HINT[tier]).toMatch(/\S/);
      expect(CHESS_COLOR[tier]).toMatch(/^var\(--line/);
    }
  });

  it('colors the four RCDO levels per the brief (RC violet, DO cyan, Outcome amber, SO signal)', () => {
    expect(RCDO_LEVEL.RALLY_CRY.color).toBe('var(--violet)');
    expect(RCDO_LEVEL.DEFINING_OBJECTIVE.color).toBe('var(--cyan)');
    expect(RCDO_LEVEL.OUTCOME.color).toBe('var(--amber)');
    expect(RCDO_LEVEL.SUPPORTING_OUTCOME.color).toBe('var(--signal)');
  });

  it('exposes the OKLCH brand palette and the value-creation green primary', () => {
    // OKLCH source of truth (not hex): the signal family is the primary green.
    expect(SIGNAL.base).toBe('oklch(0.548 0.132 165)');
    expect(COLORS.signal.base).toBe(SIGNAL.base);
    expect(COLORS.surface.s1).toMatch(/^oklch\(/);
  });

  it('registers token names and wraps them with cssVar()', () => {
    expect(CSS_VARS.signal).toBe('--signal');
    expect(cssVar(CSS_VARS.signal)).toBe('var(--signal)');
    expect(cssVar('--r-md')).toBe('var(--r-md)');
  });
});
