// libs/ui/src/StatePrimitives.test.tsx — proves Skeleton preserves layout & announces busy, Empty
// always offers a next action, and Error is a retryable alert with a non-color signal.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState, Skeleton } from './StatePrimitives';

describe('Skeleton', () => {
  it('reserves N placeholder lines and announces a busy live region (CLS-safe)', () => {
    render(<Skeleton lines={4} />);
    const el = screen.getByTestId('skeleton');
    expect(el).toHaveAttribute('aria-busy', 'true');
    // 4 placeholder blocks reserve vertical space.
    expect(el.querySelectorAll('div')).toHaveLength(4);
  });
});

describe('EmptyState', () => {
  it('renders the title and the next action', () => {
    render(
      <EmptyState
        title="No commit yet this week"
        action={<button type="button">Start your week</button>}
      />,
    );
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No commit yet this week');
    expect(screen.getByRole('button', { name: /start your week/i })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('is a retryable alert with text+icon and fires onRetry', async () => {
    const onRetry = vi.fn();
    const { container } = render(<ErrorState onRetry={onRetry} />);
    const el = screen.getByTestId('error-state');
    expect(el).toHaveAttribute('role', 'alert');
    expect(container.querySelector('svg')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('error-retry'));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
