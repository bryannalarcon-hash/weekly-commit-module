// libs/ui/src/RcdoBreadcrumb.test.tsx — proves the strategy ladder renders root → leaf, keeps the full
// trail in a tooltip, and drops empty intermediate levels (partial paths still read). data-testid=rcdo-breadcrumb.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RcdoBreadcrumb } from './RcdoBreadcrumb';
import type { RcdoPath } from './RcdoBreadcrumb';

const PATH: RcdoPath = {
  rallyCry: 'Become the system of record',
  definingObjective: 'Unify public & private markets',
  outcome: 'Single source of truth',
  supportingOutcome: 'Ingest private-capital statements',
};

describe('RcdoBreadcrumb', () => {
  it('renders the full 4-level ladder root → leaf with a tooltip', () => {
    render(<RcdoBreadcrumb path={PATH} />);
    const el = screen.getByTestId('rcdo-breadcrumb');
    expect(el).toHaveTextContent('Become the system of record');
    expect(el).toHaveTextContent('Ingest private-capital statements');
    expect(el).toHaveAttribute('title', expect.stringContaining('›'));
  });

  it('drops empty intermediate levels', () => {
    render(
      <RcdoBreadcrumb
        path={{ rallyCry: 'Top', definingObjective: '', outcome: '', supportingOutcome: 'Leaf' }}
      />,
    );
    const el = screen.getByTestId('rcdo-breadcrumb');
    expect(el).toHaveTextContent('Top');
    expect(el).toHaveTextContent('Leaf');
    // Only one separator chevron between the two surviving crumbs.
    expect(el.querySelectorAll('svg')).toHaveLength(1);
  });
});
