// libs/ui/src/ChessBadge.test.tsx — proves the chess-tier badge renders the human-readable label + glyph
// for every tier, carries data-testid=chess-tier-badge + data-tier, and supports a glyph-only mode.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChessTier } from '@wcm/types';
import { ChessBadge } from './ChessBadge';
import { CHESS_LABEL, CHESS_ORDER } from './tokens';

describe('ChessBadge', () => {
  it.each(CHESS_ORDER)('renders %s with its label + data-tier', (tier: ChessTier) => {
    render(<ChessBadge tier={tier} />);
    const el = screen.getByTestId('chess-tier-badge');
    expect(el).toHaveTextContent(CHESS_LABEL[tier]);
    expect(el).toHaveAttribute('data-tier', tier);
  });

  it('hides the text label in glyph-only mode but keeps the badge addressable', () => {
    render(<ChessBadge tier="KING" showLabel={false} />);
    const el = screen.getByTestId('chess-tier-badge');
    expect(el).not.toHaveTextContent(CHESS_LABEL.KING);
    expect(el).toHaveAttribute('data-tier', 'KING');
  });
});
