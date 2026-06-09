// libs/ui/src/CarriedForwardCard.test.tsx — verifies the carried-forward card shows the item text,
// its lineage label, the chess tier (human-readable), and renders action controls.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CarriedForwardCard } from './CarriedForwardCard';

describe('CarriedForwardCard', () => {
  it('shows the item text and default lineage', () => {
    render(<CarriedForwardCard text="Finish the migration plan" />);
    const card = screen.getByTestId('carried-block');
    expect(card).toHaveTextContent('Finish the migration plan');
    expect(card).toHaveTextContent(/carried from last week/i);
  });

  it('renders a human-readable chess tier (not the raw enum)', () => {
    render(<CarriedForwardCard text="X" chessTier="QUEEN" />);
    const card = screen.getByTestId('carried-block');
    expect(card).toHaveTextContent('Queen');
    expect(card.textContent).not.toContain('QUEEN');
  });

  it('renders provided action controls', () => {
    render(
      <CarriedForwardCard
        text="X"
        actions={<button type="button">Carry forward</button>}
      />,
    );
    expect(screen.getByRole('button', { name: /carry forward/i })).toBeInTheDocument();
  });
});
