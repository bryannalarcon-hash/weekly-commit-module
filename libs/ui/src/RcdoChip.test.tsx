// libs/ui/src/RcdoChip.test.tsx — proves the RCDO link chip + 4-level breadcrumb render the linked
// Supporting Outcome, that an UNLINKED item shows a visible text+icon "needs a Supporting Outcome"
// affordance (not color-only), and that clearing fires onClear.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RcdoBreadcrumb, RcdoChip } from './RcdoChip';
import type { RcdoPath } from './RcdoChip';

const PATH: RcdoPath = {
  rallyCry: 'Become the system of record',
  definingObjective: 'Unify public & private markets',
  outcome: 'Single source of truth',
  supportingOutcome: 'Ingest private-capital statements',
};

describe('RcdoChip', () => {
  it('renders the linked Supporting Outcome title', () => {
    render(<RcdoChip title="Ingest private-capital statements" />);
    expect(screen.getByTestId('rcdo-chip')).toHaveTextContent(
      'Ingest private-capital statements',
    );
  });

  it('shows a text+icon unlinked affordance when not linked (never color-only)', () => {
    const { container } = render(<RcdoChip title={null} />);
    const el = screen.getByTestId('rcdo-chip-unlinked');
    expect(el).toHaveTextContent(/needs a supporting outcome/i);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('fires onClear when the clear button is pressed', async () => {
    const onClear = vi.fn();
    render(<RcdoChip title="Normalize public holdings" onClear={onClear} />);
    await userEvent.click(screen.getByRole('button', { name: /clear link/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('renders the full 4-level breadcrumb root → leaf', () => {
    render(<RcdoBreadcrumb path={PATH} />);
    const crumb = screen.getByTestId('rcdo-breadcrumb');
    expect(crumb).toHaveTextContent('Become the system of record');
    expect(crumb).toHaveTextContent('Ingest private-capital statements');
    expect(crumb).toHaveAttribute('title', expect.stringContaining('›'));
  });
});
