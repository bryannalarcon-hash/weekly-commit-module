// libs/ui/src/ChessSelector.test.tsx — proves the tier selector is a radiogroup with one radio per tier,
// marks the current value aria-checked, fires onChange with the chosen tier, and keeps data-testid=chess-tier-select.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChessSelector } from './ChessSelector';
import { CHESS_LABEL, CHESS_ORDER } from './tokens';

describe('ChessSelector', () => {
  it('renders a radiogroup with one option per tier', () => {
    render(<ChessSelector value="ROOK" onChange={() => undefined} />);
    expect(screen.getByTestId('chess-tier-select')).toHaveAttribute('role', 'radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(CHESS_ORDER.length);
  });

  it('marks the current value as checked', () => {
    render(<ChessSelector value="QUEEN" onChange={() => undefined} />);
    const queen = screen.getByRole('radio', { name: CHESS_LABEL.QUEEN });
    expect(queen).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onChange with the picked tier', async () => {
    const onChange = vi.fn();
    render(<ChessSelector value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: CHESS_LABEL.KING }));
    expect(onChange).toHaveBeenCalledWith('KING');
  });
});
