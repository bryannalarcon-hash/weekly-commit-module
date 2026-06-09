// apps/wc-remote/src/screens/CommitHistory.test.tsx — RTL tests for the history list + past detail
// (brief §6.4 / §6.4.1). MSW-backed. Covers: empty state, a populated list with status badges +
// completion summary, the status filter, opening a row (callback), and the read-only past-commit
// detail (items render, no composer, reconciliation link present for a locked week).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { CommitDto, WeekSummary } from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { CommitHistory } from './CommitHistory';
import { PastCommitDetail } from './PastCommitDetail';

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

const summaries: WeekSummary[] = [
  { commitId: 'w1', weekStart: '2026-06-01', lifecycleState: 'RECONCILED', itemCount: 5, completedCount: 4, carriedInCount: 1 },
  { commitId: 'w2', weekStart: '2026-05-25', lifecycleState: 'LOCKED', itemCount: 3, completedCount: 0, carriedInCount: 0 },
];

describe('CommitHistory', () => {
  it('shows the empty state when there are no past weeks', async () => {
    server.use(http.get('*/commits', () => HttpResponse.json([])));
    render(withStore(<CommitHistory onOpen={noop} />));
    expect(await screen.findByTestId('empty-state')).toHaveTextContent(/no past weeks/i);
  });

  it('lists past weeks with badges + completion and opens a row', async () => {
    server.use(http.get('*/commits', () => HttpResponse.json(summaries)));
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(withStore(<CommitHistory onOpen={onOpen} />));

    const rows = await screen.findAllByTestId('history-row');
    expect(rows).toHaveLength(2);
    expect(screen.getAllByTestId('lifecycle-badge')[0]).toHaveAttribute('data-state', 'RECONCILED');
    expect(screen.getByText('4 of 5 done')).toBeInTheDocument();

    await user.click(rows[0]!);
    expect(onOpen).toHaveBeenCalledWith('w1');
  });

  it('filters the list by status', async () => {
    server.use(http.get('*/commits', () => HttpResponse.json(summaries)));
    const user = userEvent.setup();
    render(withStore(<CommitHistory onOpen={noop} />));
    await screen.findAllByTestId('history-row');

    await user.selectOptions(screen.getByTestId('history-filter'), 'LOCKED');
    await waitFor(() => expect(screen.getAllByTestId('history-row')).toHaveLength(1));
  });
});

describe('PastCommitDetail', () => {
  const detail: CommitDto = {
    id: 'w2',
    memberId: 'm1',
    weekStart: '2026-05-25',
    lifecycleState: 'LOCKED',
    submittedAt: '2026-05-29T12:00:00Z',
    reviewedAt: null,
    items: [
      { id: 'i1', text: 'Read-only item', status: 'COMPLETE', supportingOutcomeId: 's1', chessTier: 'KING', carriedFromItemId: null },
    ],
  };

  it('renders read-only items with a reconciliation link for a locked week', async () => {
    server.use(http.get('*/commits/w2', () => HttpResponse.json(detail)));
    const onReconcile = vi.fn();
    const user = userEvent.setup();
    render(withStore(<PastCommitDetail commitId="w2" onBack={noop} onReconcile={onReconcile} />));

    expect(await screen.findByText('Read-only item')).toBeInTheDocument();
    // No editable composer in the read-only detail.
    expect(screen.queryByTestId('composer-item')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('past-open-reconcile'));
    expect(onReconcile).toHaveBeenCalledWith('w2');
  });
});
