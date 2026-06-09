// libs/ui/src/LifecycleBadge.test.tsx — proves the lifecycle badge renders all 5 states with a visible
// human-readable text label + an icon (never color-only, the a11y rule from brief §4.1), and that it
// never leaks the raw enum slug into viewer-facing text.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LifecycleState } from '@wcm/types';
import { LifecycleBadge } from './LifecycleBadge';
import { LIFECYCLE_LABEL } from './tokens';

const ALL: LifecycleState[] = [
  'DRAFT',
  'LOCKED',
  'RECONCILING',
  'RECONCILED',
  'CARRY_FORWARD',
];

describe('LifecycleBadge', () => {
  it.each(ALL)('renders %s with its human-readable label + icon (not color-only)', (state) => {
    const { container } = render(<LifecycleBadge state={state} />);
    const badge = screen.getByTestId('lifecycle-badge');
    expect(badge).toHaveTextContent(LIFECYCLE_LABEL[state]);
    expect(badge).toHaveAttribute('data-state', state);
    // An accompanying SVG icon must be present so the state has a non-color signal.
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('never renders the raw enum slug in viewer-facing text', () => {
    render(<LifecycleBadge state="CARRY_FORWARD" />);
    const badge = screen.getByTestId('lifecycle-badge');
    expect(badge.textContent).not.toContain('CARRY_FORWARD');
    expect(badge).toHaveTextContent('Carried forward');
  });
});
