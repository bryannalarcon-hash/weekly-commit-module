// apps/wc-remote/src/WeeklyCommitApp.test.tsx — render test for the federated WC entry.
// Uses RTL + jest-dom to assert visible heading/copy and the lifecycle-state default (DRAFT).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeeklyCommitApp } from './WeeklyCommitApp';

describe('WeeklyCommitApp', () => {
  it('renders the Weekly Commit heading', () => {
    render(<WeeklyCommitApp />);
    expect(
      screen.getByRole('heading', { name: /weekly commit/i }),
    ).toBeInTheDocument();
  });

  it('defaults the lifecycle state to DRAFT and greets a passed-in user', () => {
    render(<WeeklyCommitApp user={{ name: 'Ada' }} />);
    expect(screen.getByTestId('lifecycle-state')).toHaveTextContent('DRAFT');
    expect(screen.getByText(/welcome, ada/i)).toBeInTheDocument();
  });
});
