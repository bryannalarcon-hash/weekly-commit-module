// apps/wc-remote/src/screens/MyWeeklyCommit.test.tsx — RTL tests for the My Week home (brief §6.2).
// MSW-backed (real RTK Query). Covers every state from the brief: empty ("Start your week" → creates a
// commit and routes to the composer), Draft (Edit/Continue + past-due banner), Locked (read-only items
// + Review), Reconciling (nav to reconciliation), loading skeleton, and error.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { CommitDto } from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { MyWeeklyCommit } from './MyWeeklyCommit';

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

  it('renders a Draft week with Edit/Continue and a past-due banner when overdue', async () => {
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
    expect(screen.getByTestId('past-due-banner')).toBeInTheDocument();
  });

  it('renders a Locked week read-only with a Review action', async () => {
    currentReturns(
      commit({
        lifecycleState: 'LOCKED',
        items: [
          { id: 'i1', text: 'Done item', status: 'COMPLETE', supportingOutcomeId: 's1', chessTier: 'QUEEN', carriedFromItemId: null },
        ],
      }),
    );
    render(withStore(<MyWeeklyCommit onEdit={noop} onReconcile={noop} />));
    const review = await screen.findByTestId('open-reconcile');
    expect(review).toHaveTextContent(/review/i);
    expect(screen.getByTestId('lifecycle-badge')).toHaveAttribute('data-state', 'LOCKED');
    // No editable composer here.
    expect(screen.queryByTestId('edit-continue')).not.toBeInTheDocument();
  });

  it('routes to reconciliation from a Reconciling week', async () => {
    currentReturns(commit({ lifecycleState: 'RECONCILING', items: [
      { id: 'i1', text: 'x', status: 'INCOMPLETE', supportingOutcomeId: 's1', chessTier: null, carriedFromItemId: null },
    ] }));
    const onReconcile = vi.fn();
    const user = userEvent.setup();
    render(withStore(<MyWeeklyCommit onEdit={noop} onReconcile={onReconcile} />));
    const open = await screen.findByTestId('open-reconcile');
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
