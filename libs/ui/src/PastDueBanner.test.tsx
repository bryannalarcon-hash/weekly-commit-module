// libs/ui/src/PastDueBanner.test.tsx — verifies the overdue banner is an assertive alert with a
// text+icon signal, surfaces the due label, and renders a passed-in action.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PastDueBanner } from './PastDueBanner';

describe('PastDueBanner', () => {
  it('renders as an alert with a non-color signal (icon + text)', () => {
    const { container } = render(<PastDueBanner />);
    const el = screen.getByTestId('past-due-banner');
    expect(el).toHaveAttribute('role', 'alert');
    expect(el).toHaveTextContent(/past due/i);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('includes the due label when provided', () => {
    render(<PastDueBanner dueLabel="due Friday, Jun 13" />);
    expect(screen.getByTestId('past-due-banner')).toHaveTextContent('due Friday, Jun 13');
  });

  it('renders a provided action', () => {
    render(<PastDueBanner action={<button type="button">Submit now</button>} />);
    expect(screen.getByRole('button', { name: /submit now/i })).toBeInTheDocument();
  });
});
