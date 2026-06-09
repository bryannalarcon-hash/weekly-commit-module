// libs/ui/src/Pulse.test.tsx — proves the Pulse renders the 1–5 radiogroup, fires onChange for a rating,
// the comment, and the privacy switch, and renders the recorded reading read-only. Keeps the Cypress
// testids (pulse-input, pulse-rating-{n}, pulse-comment).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PulseDto } from '@wcm/types';
import { Pulse } from './Pulse';

const EMPTY: PulseDto = { rating: null, comment: null, privateToManager: false };

describe('Pulse', () => {
  it('fires onChange with the picked rating', async () => {
    const onChange = vi.fn();
    render(<Pulse value={EMPTY} onChange={onChange} />);
    await userEvent.click(screen.getByTestId('pulse-rating-4'));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY, rating: 4 });
  });

  it('fires onChange with the typed comment', async () => {
    const onChange = vi.fn();
    render(<Pulse value={EMPTY} onChange={onChange} />);
    await userEvent.type(screen.getByTestId('pulse-comment'), 'x');
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY, comment: 'x' });
  });

  it('flips the manager-private switch via the Toggle', async () => {
    const onChange = vi.fn();
    render(<Pulse value={EMPTY} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: /visible to your manager only/i }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY, privateToManager: true });
  });

  it('renders the recorded reading read-only', () => {
    render(
      <Pulse value={{ rating: 5, comment: 'great', privateToManager: false }} onChange={() => undefined} readOnly />,
    );
    expect(screen.getByTestId('pulse-readonly-rating')).toHaveTextContent('5 of 5 — Great');
    expect(screen.queryByTestId('pulse-rating-1')).not.toBeInTheDocument();
  });
});
