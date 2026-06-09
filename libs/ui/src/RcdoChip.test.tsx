// libs/ui/src/RcdoChip.test.tsx — proves the RCDO link chip renders the linked Supporting Outcome (green
// chip + optional ladder), that an UNLINKED item shows the visible amber "Link a Supporting Outcome"
// affordance (text+icon, not color-only), that clearing fires onClear, and that activating fires onClick.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RcdoChip } from './RcdoChip';
import type { RcdoPath } from './RcdoBreadcrumb';

const PATH: RcdoPath = {
  rallyCry: 'Become the system of record',
  definingObjective: 'Unify public & private markets',
  outcome: 'Single source of truth',
  supportingOutcome: 'Ingest private-capital statements',
};

describe('RcdoChip', () => {
  it('renders the linked Supporting Outcome title', () => {
    render(<RcdoChip title="Ingest private-capital statements" />);
    expect(screen.getByTestId('rcdo-chip')).toHaveTextContent('Ingest private-capital statements');
  });

  it('shows a text+icon unlinked affordance when not linked (never color-only)', () => {
    const { container } = render(<RcdoChip title={null} />);
    const el = screen.getByTestId('rcdo-chip-unlinked');
    expect(el).toHaveTextContent(/link a supporting outcome/i);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('fires onClear when the clear button is pressed', async () => {
    const onClear = vi.fn();
    render(<RcdoChip title="Normalize public holdings" onClear={onClear} />);
    await userEvent.click(screen.getByRole('button', { name: /clear link/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('fires onClick when the unlinked affordance is activated', async () => {
    const onClick = vi.fn();
    render(<RcdoChip title={null} onClick={onClick} />);
    await userEvent.click(screen.getByTestId('rcdo-chip-unlinked'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders the ladder beneath the chip when a path is given', () => {
    render(<RcdoChip title="Ingest private-capital statements" path={PATH} />);
    expect(screen.getByTestId('rcdo-breadcrumb')).toHaveTextContent('Become the system of record');
  });
});
