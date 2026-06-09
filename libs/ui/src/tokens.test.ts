// libs/ui/src/tokens.test.ts — guards the design-system token contract (design brief §3/§4).
// Asserts every lifecycle/chess enum has a human-readable label + visual, and that chess ordering
// is strictly descending by weight, so a token swap can't silently drop a state or break sorting.
import { describe, expect, it } from 'vitest';
import type { ChessTier, LifecycleState } from '@wcm/types';
import {
  CHESS_LABEL,
  CHESS_ORDER,
  CHESS_WEIGHT,
  COLORS,
  LIFECYCLE_LABEL,
  LIFECYCLE_VISUAL,
} from './tokens';

const ALL_STATES: LifecycleState[] = [
  'DRAFT',
  'LOCKED',
  'RECONCILING',
  'RECONCILED',
  'CARRY_FORWARD',
];

describe('design tokens', () => {
  it('maps every lifecycle state to a human-readable label and a visual', () => {
    for (const state of ALL_STATES) {
      expect(LIFECYCLE_LABEL[state]).toMatch(/\S/);
      expect(LIFECYCLE_VISUAL[state].label).toBe(LIFECYCLE_LABEL[state]);
      expect(LIFECYCLE_VISUAL[state].hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('never surfaces a raw enum slug as a viewer-facing label', () => {
    for (const state of ALL_STATES) {
      expect(LIFECYCLE_LABEL[state]).not.toContain('_');
      expect(LIFECYCLE_LABEL[state]).not.toBe(state);
    }
  });

  it('orders chess tiers strictly descending by weight (KING highest)', () => {
    expect(CHESS_ORDER[0]).toBe('KING');
    expect(CHESS_ORDER[CHESS_ORDER.length - 1]).toBe('PAWN');
    for (let i = 1; i < CHESS_ORDER.length; i += 1) {
      const prev = CHESS_ORDER[i - 1] as ChessTier;
      const cur = CHESS_ORDER[i] as ChessTier;
      expect(CHESS_WEIGHT[prev]).toBeGreaterThan(CHESS_WEIGHT[cur]);
    }
  });

  it('gives every chess tier a label', () => {
    for (const tier of CHESS_ORDER) {
      expect(CHESS_LABEL[tier]).toMatch(/\S/);
    }
  });

  it('exposes the navy primary and professional-blue accent in the palette', () => {
    expect(COLORS.primary[900]).toBe('#0b2a4a');
    expect(COLORS.accent[500]).toBe('#2563eb');
  });
});
