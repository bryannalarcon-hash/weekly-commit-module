// libs/ui/src/WeekHeader.test.tsx — proves the header renders the range as an h1, the shared lifecycle
// badge for the state, the due line (flagged overdue with a non-color-only data attribute), the actions
// slot, and arbitrary children. Imports the component DIRECTLY (LifecycleBadge is a real sibling).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeekHeader } from './WeekHeader';

describe('WeekHeader', () => {
  it('renders the week range as an h1 and the lifecycle badge for the state', () => {
    render(<WeekHeader range="Week of Jun 8–12" state="DRAFT" year={2026} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Week of Jun 8–12' })).toBeInTheDocument();
    const badge = screen.getByTestId('lifecycle-badge');
    expect(badge).toHaveAttribute('data-state', 'DRAFT');
  });

  it('shows the due line and flags overdue (not color-only)', () => {
    render(<WeekHeader range="Week of Jun 1–5" state="LOCKED" due="Fri Jun 5" overdue />);
    const due = screen.getByTestId('week-due');
    expect(due).toHaveTextContent('Due Fri Jun 5');
    expect(due).toHaveAttribute('data-overdue', 'true');
  });

  it('renders the actions slot and children', () => {
    render(
      <WeekHeader
        range="Week of Jun 8–12"
        state="DRAFT"
        actions={<button type="button">Edit</button>}
      >
        <p>Child content</p>
      </WeekHeader>,
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });
});
