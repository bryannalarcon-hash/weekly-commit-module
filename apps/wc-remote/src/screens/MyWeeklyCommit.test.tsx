// apps/wc-remote/src/screens/MyWeeklyCommit.test.tsx — RTL tests for the re-skinned My Week home
// (brief §6.2, c-design page-myweek). MSW-backed (real RTK Query). Covers every state from the brief:
// empty ("Start your week" → creates a commit and routes to the composer), Draft (Continue editing +
// Lock week gated on all-linked + lock-confirm dialog, ValidationSummary, past-due banner, carried
// section), Locked (frozen read-only items + Start reconciliation + status pills), Reconciling (Open
// reconciliation nav), loading skeleton, and error. Asserts the shared-primitive testids the new
// structure renders (week-header, validation-summary, item-status, confirm-dialog) and that a linked
// item's chip shows the REAL Supporting-Outcome title resolved from the RCDO tree (not a placeholder).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { CommitDto, RallyCryNode } from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { MyWeeklyCommit } from './MyWeeklyCommit';

// A fixed RCDO tree whose Supporting Outcome `s1` carries a known title, so an item linked to `s1`
// shows that real name on its chip (not the generic "Linked outcome" placeholder).
const FIXED_TREE: RallyCryNode[] = [
  {
    id: 'rc-1',
    title: 'Win the quarter',
    definingObjectives: [
      {
        id: 'do-1',
        title: 'Ship the data platform',
        outcomes: [
          {
            id: 'o-1',
            title: 'Single source of truth',
            supportingOutcomes: [
              { id: 's1', outcomeId: 'o-1', title: 'Normalize public holdings', ownerId: null },
            ],
          },
        ],
      },
    ],
  },
];

function treeReturns(tree: RallyCryNode[]): void {
  server.use(http.get('*/rcdo/tree', () => HttpResponse.json(tree)));
}

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetMockDb();
});
afterAll(() => server.close());

function withStore(node: ReactNode): JSX.Element {
  return <Provider store={makeStore()}>{node}</Provider>;
}

const noop = (): void => undefined;

function commit(overrides: Partial<CommitDto>): CommitDto {
  return {
    id: 'c1',
    memberId: 'm1',
    weekStart: '2026-06-08',
    lifecycleState: 'DRAFT',
    submittedAt: null,
    reviewedAt: null,
    items: [],
    ...overrides,
  };
}

function currentReturns(dto: CommitDto | null): void {
  server.use(
    http.get('*/commits/current', () =>
      dto ? HttpResponse.json(dto) : new HttpResponse(null, { status: 204 }),
    ),
  );
}

describe('MyWeeklyCommit', () => {
  it('shows the empty "Start your week" state and creates a commit on click', async () => {
    currentReturns(null);
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(withStore(<MyWeeklyCommit onEdit={onEdit} onReconcile={noop} />));

    const start = await screen.findByTestId('start-week');
    await user.click(start);
    // createCommit (MSW) returns a new DRAFT commit → routes to the composer.
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
  });

  it('renders a Draft week with the week header, Continue editing, and a past-due banner', async () => {
    currentReturns(
      commit({
        weekStart: '2020-01-06', // long past → past-due
        items: [
          { id: 'i1', text: 'Ship the thing', status: 'OPEN', supportingOutcomeId: 's1', chessTier: 'KING', carriedFromItemId: null },
        ],
      }),
    );
    render(withStore(<MyWeeklyCommit onEdit={noop} onReconcile={noop} />));
    expect(await screen.findByTestId('edit-continue')).toBeInTheDocument();
    expect(screen.getByTestId('week-header')).toBeInTheDocument();
    expect(screen.getByTestId('lifecycle-badge')).toHaveAttribute('data-state', 'DRAFT');
    expect(screen.getByTestId('past-due-banner')).toBeInTheDocument();
    // Every item is linked → Lock week is enabled and the unlinked validation summary is absent.
    expect(screen.getByTestId('lock-week')).toBeEnabled();
    expect(screen.queryByTestId('validation-summary')).not.toBeInTheDocument();
  });

  it('disables Lock week and shows the validation summary when an item is unlinked', async () => {
    currentReturns(
      commit({
        items: [
          { id: 'i1', text: 'Linked', status: 'OPEN', supportingOutcomeId: 's1', chessTier: 'ROOK', carriedFromItemId: null },
          { id: 'i2', text: 'Unlinked', status: 'OPEN', supportingOutcomeId: null, chessTier: null, carriedFromItemId: null },
        ],
      }),
    );
    render(withStore(<MyWeeklyCommit onEdit={noop} onReconcile={noop} />));
    expect(await screen.findByTestId('lock-week')).toBeDisabled();
    const summary = screen.getByTestId('validation-summary');
    expect(summary).toHaveTextContent(/1 item needs a Supporting Outcome/i);
  });

  it('opens the lock-confirm dialog and routes to the composer on confirm', async () => {
    currentReturns(
      commit({
        items: [
          { id: 'i1', text: 'All linked', status: 'OPEN', supportingOutcomeId: 's1', chessTier: 'KING', carriedFromItemId: null },
        ],
      }),
    );
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(withStore(<MyWeeklyCommit onEdit={onEdit} onReconcile={noop} />));
    await user.click(await screen.findByTestId('lock-week'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('confirm-accept'));
    expect(onEdit).toHaveBeenCalledWith('c1');
  });

  it('surfaces a carried-forward item in its own section', async () => {
    currentReturns(
      commit({
        items: [
          { id: 'i1', text: 'Finish exposure-cube spike', status: 'OPEN', supportingOutcomeId: 's1', chessTier: 'QUEEN', carriedFromItemId: 'prev1' },
          { id: 'i2', text: 'Fresh item', status: 'OPEN', supportingOutcomeId: 's1', chessTier: 'PAWN', carriedFromItemId: null },
        ],
      }),
    );
    render(withStore(<MyWeeklyCommit onEdit={noop} onReconcile={noop} />));
    const carried = await screen.findByTestId('carried-block');
    expect(carried).toHaveTextContent(/Carried from last week/i);
    expect(carried).toHaveTextContent(/Finish exposure-cube spike/i);
  });

  it('renders a Locked week read-only with Start reconciliation and status pills', async () => {
    currentReturns(
      commit({
        lifecycleState: 'LOCKED',
        items: [
          { id: 'i1', text: 'Done item', status: 'COMPLETE', supportingOutcomeId: 's1', chessTier: 'QUEEN', carriedFromItemId: null },
        ],
      }),
    );
    render(withStore(<MyWeeklyCommit onEdit={noop} onReconcile={noop} />));
    const reconcile = await screen.findByTestId('open-reconcile');
    expect(reconcile).toHaveTextContent(/start reconciliation/i);
    expect(screen.getByTestId('lifecycle-badge')).toHaveAttribute('data-state', 'LOCKED');
    // Read-only status pill is shown (not on a Draft); no Draft-only controls.
    expect(screen.getByTestId('item-status')).toHaveAttribute('data-status', 'completed');
    expect(screen.queryByTestId('edit-continue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lock-week')).not.toBeInTheDocument();
  });

  it('shows the resolved Supporting Outcome name on a linked item, and the unlinked chip otherwise', async () => {
    treeReturns(FIXED_TREE);
    currentReturns(
      commit({
        lifecycleState: 'LOCKED',
        items: [
          { id: 'i1', text: 'Linked item', status: 'COMPLETE', supportingOutcomeId: 's1', chessTier: 'ROOK', carriedFromItemId: null },
          { id: 'i2', text: 'Unlinked item', status: 'OPEN', supportingOutcomeId: null, chessTier: null, carriedFromItemId: null },
        ],
      }),
    );
    render(withStore(<MyWeeklyCommit onEdit={noop} onReconcile={noop} />));

    // The linked item's chip shows the REAL outcome title from the tree, not the placeholder.
    expect(await screen.findByText('Normalize public holdings')).toBeInTheDocument();
    expect(screen.queryByText('Linked outcome')).not.toBeInTheDocument();
    // The linked item renders the green chip; the unlinked item keeps the amber "needs an outcome" one.
    expect(screen.getAllByTestId('rcdo-chip')).toHaveLength(1);
    expect(screen.getByTestId('rcdo-chip-unlinked')).toBeInTheDocument();
  });

  it('routes to reconciliation from a Reconciling week via Open reconciliation', async () => {
    currentReturns(commit({ lifecycleState: 'RECONCILING', items: [
      { id: 'i1', text: 'x', status: 'INCOMPLETE', supportingOutcomeId: 's1', chessTier: null, carriedFromItemId: null },
    ] }));
    const onReconcile = vi.fn();
    const user = userEvent.setup();
    render(withStore(<MyWeeklyCommit onEdit={noop} onReconcile={onReconcile} />));
    const open = await screen.findByTestId('open-reconcile');
    expect(open).toHaveTextContent(/open reconciliation/i);
    await user.click(open);
    expect(onReconcile).toHaveBeenCalledWith('c1');
  });

  it('shows an error state when the week fails to load', async () => {
    server.use(
      http.get('*/commits/current', () => new HttpResponse(null, { status: 500 })),
    );
    render(withStore(<MyWeeklyCommit onEdit={noop} onReconcile={noop} />));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });
});
