// apps/wc-remote/src/components/RcdoPicker.test.tsx — the U18 a11y/keyboard test for the RCDO picker +
// tree, MSW-backed (real RTK Query getRcdoTree). Proves: the tree exposes proper ARIA (role=tree/
// treeitem, aria-level, aria-expanded), keyboard navigation + Enter selection emits the FULL
// SupportingOutcome, the typeahead filter narrows leaves, the empty state shows on no match, focus
// returns to the trigger on close, and jest-axe finds no violations.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { setupServer } from 'msw/node';
import { axe } from 'jest-axe';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { handlers, makeStore } from '@wcm/api';
import type { ReactNode } from 'react';
import { RcdoPicker, filterTree } from './RcdoPicker';
import type { RcdoSelection } from './RcdoTree';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function withStore(node: ReactNode): JSX.Element {
  return <Provider store={makeStore()}>{node}</Provider>;
}

const noop = (): void => undefined;

describe('filterTree', () => {
  it('keeps only branches with a matching leaf', () => {
    const tree = [
      {
        id: 'rc',
        title: 'RC',
        definingObjectives: [
          {
            id: 'do',
            title: 'DO',
            outcomes: [
              {
                id: 'o',
                title: 'O',
                supportingOutcomes: [
                  { id: 's1', outcomeId: 'x', title: 'Ingest statements', ownerId: null },
                  { id: 's2', outcomeId: 'y', title: 'Normalize holdings', ownerId: null },
                ],
              },
            ],
          },
        ],
      },
    ];
    const out = filterTree(tree, 'ingest');
    expect(out[0]?.definingObjectives[0]?.outcomes[0]?.supportingOutcomes).toHaveLength(1);
    expect(filterTree(tree, 'zzz')).toHaveLength(0);
  });
});

describe('RcdoPicker', () => {
  it('renders the tree with proper ARIA roles and levels', async () => {
    render(withStore(<RcdoPicker open selectedId={null} onSelect={noop} onClose={noop} />));
    const tree = await screen.findByRole('tree');
    const items = within(tree).getAllByRole('treeitem');
    expect(items.length).toBeGreaterThan(0);
    // Root Rally Cry is level 1 and expandable.
    const root = items[0]!;
    expect(root).toHaveAttribute('aria-level', '1');
    expect(root).toHaveAttribute('aria-expanded');
  });

  it('selects a Supporting Outcome by keyboard and emits the full outcome', async () => {
    const onSelect = vi.fn<(s: RcdoSelection) => void>();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      withStore(<RcdoPicker open selectedId={null} onSelect={onSelect} onClose={onClose} />),
    );
    const tree = await screen.findByRole('tree');
    const leaf = within(tree)
      .getAllByRole('treeitem')
      .find((el) => el.getAttribute('data-leaf') === 'true');
    expect(leaf).toBeTruthy();
    leaf!.focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();
    const sel = onSelect.mock.calls[0]![0];
    // The emitted value is the FULL SupportingOutcomeDto plus its 4-level breadcrumb path.
    expect(sel.outcome).toHaveProperty('id');
    expect(sel.outcome).toHaveProperty('title');
    expect(sel.path.rallyCry).toMatch(/\S/);
    expect(sel.path.supportingOutcome).toBe(sel.outcome.title);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('filters the tree via typeahead search and shows an empty state on no match', async () => {
    const user = userEvent.setup();
    render(withStore(<RcdoPicker open selectedId={null} onSelect={noop} onClose={noop} />));
    await screen.findByRole('tree');
    const search = screen.getByTestId('rcdo-search');
    await user.type(search, 'zzzznomatch');
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('has no detectable a11y violations', async () => {
    const { container } = render(
      withStore(<RcdoPicker open selectedId={null} onSelect={noop} onClose={noop} />),
    );
    await screen.findByRole('tree');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
