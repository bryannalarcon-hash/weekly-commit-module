// libs/ui/src/ItemStatus.test.tsx — proves the status pill renders a human-readable label + icon
// (never color-only), tags the raw status on data-status for automation, and renders nothing for an
// unknown status. Imports the component DIRECTLY (not via the barrel).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItemStatus } from './ItemStatus';

describe('ItemStatus', () => {
  it('renders a human-readable label + an icon (text carries the meaning)', () => {
    const { container } = render(<ItemStatus status="completed" />);
    const pill = screen.getByTestId('item-status');
    expect(pill).toHaveTextContent('Completed');
    expect(pill).toHaveAttribute('data-status', 'completed');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('labels each known status with its human-readable name', () => {
    const cases: Array<[Parameters<typeof ItemStatus>[0]['status'], string]> = [
      ['incomplete', 'Incomplete'],
      ['carried', 'Carried forward'],
      ['added', 'Added after lock'],
      ['pending', 'In progress'],
    ];
    for (const [status, label] of cases) {
      const { unmount } = render(<ItemStatus status={status} />);
      expect(screen.getByTestId('item-status')).toHaveTextContent(label);
      unmount();
    }
  });

  it('renders nothing for an unknown status (defensive)', () => {
    // @ts-expect-error — intentionally passing an out-of-contract key.
    const { container } = render(<ItemStatus status="bogus" />);
    expect(container.firstChild).toBeNull();
  });
});
