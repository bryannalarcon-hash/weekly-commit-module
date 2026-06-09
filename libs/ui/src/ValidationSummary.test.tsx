// libs/ui/src/ValidationSummary.test.tsx — proves the pre-lock blocker explains the count (singular vs
// plural), is a polite status with a text+icon signal (never color-only), fires the Review jump, and
// renders nothing when nothing is blocking. Imports the component DIRECTLY.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ValidationSummary } from './ValidationSummary';

describe('ValidationSummary', () => {
  it('renders a polite status with an icon + the plural count', () => {
    const { container } = render(<ValidationSummary count={3} />);
    const el = screen.getByTestId('validation-summary');
    expect(el).toHaveAttribute('role', 'status');
    expect(el).toHaveTextContent('3 items need a Supporting Outcome');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('uses singular phrasing for a single blocking item', () => {
    render(<ValidationSummary count={1} />);
    expect(screen.getByTestId('validation-summary')).toHaveTextContent(
      '1 item needs a Supporting Outcome',
    );
  });

  it('fires the Review jump when the button is pressed', async () => {
    const onFix = vi.fn();
    render(<ValidationSummary count={2} onFix={onFix} />);
    await userEvent.click(screen.getByRole('button', { name: /review/i }));
    expect(onFix).toHaveBeenCalledOnce();
  });

  it('renders nothing when no items are blocking', () => {
    const { container } = render(<ValidationSummary count={0} />);
    expect(container.firstChild).toBeNull();
  });
});
