// apps/wc-remote/src/screens/CommitHistory.test.tsx — RTL tests for the re-skinned history list +
// read-only past detail (brief §6.4 / §6.4.1). MSW-backed, real RTK Query. Covers: the empty state,
// a populated panel list (lifecycle badge + done/total + carried + completion %), the pill-chip filter
// (All / Reconciled / Reconciling), opening a row (callback), and the read-only PastCommitDetail
// (chess badge + strategy breadcrumb resolved from the RCDO tree + ItemStatus pill, recorded Pulse,
// reconciliation link for a non-draft week, and NO editable composer).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { CommitDto, PulseDto, RallyCryNode, WeekSummary } from '@wcm/types';
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
  { commitId: 'w2', weekStart: '2026-05-25', lifecycleState: 'RECONCILING', itemCount: 4, completedCount: 4, carriedInCount: 0 },
  { commitId: 'w3', weekStart: '2026-05-18', lifecycleState: 'LOCKED', itemCount: 3, completedCount: 0, carriedInCount: 0 },
];

describe('CommitHistory', () => {
  it('shows the empty state when there are no past weeks', async () => {
    server.use(http.get('*/commits', () => HttpResponse.json([])));
    render(withStore(<CommitHistory onOpen={noop} />));
    expect(await screen.findByTestId('empty-state')).toHaveTextContent(/no past weeks/i);
  });

  it('lists past weeks with lifecycle badge, completion summary, and carried lineage', async () => {
    server.use(http.get('*/commits', () => HttpResponse.json(summaries)));
    render(withStore(<CommitHistory onOpen={noop} />));

    const rows = await screen.findAllByTestId('history-row');
    expect(rows).toHaveLength(3);
    expect(screen.getAllByTestId('lifecycle-badge')[0]).toHaveAttribute('data-state', 'RECONCILED');
    // Real done/total from the summary + carried lineage + computed completion %.
    expect(screen.getByText('4/5 done')).toBeInTheDocument();
    expect(screen.getByText('1 carried')).toBeInTheDocument();
    expect(screen.getAllByTestId('history-completion')[0]).toHaveTextContent('80%');
  });

  it('opens a row via the onOpen callback', async () => {
    server.use(http.get('*/commits', () => HttpResponse.json(summaries)));
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(withStore(<CommitHistory onOpen={onOpen} />));

    const rows = await screen.findAllByTestId('history-row');
    await user.click(rows[0]!);
    expect(onOpen).toHaveBeenCalledWith('w1');
  });

  it('filters the list by status via the pill chips', async () => {
    server.use(http.get('*/commits', () => HttpResponse.json(summaries)));
    const user = userEvent.setup();
    render(withStore(<CommitHistory onOpen={noop} />));
    expect(await screen.findAllByTestId('history-row')).toHaveLength(3);

    // "Reconciling" keeps only the single RECONCILING week.
    await user.click(screen.getByTestId('history-filter-reconciling'));
    await waitFor(() => expect(screen.getAllByTestId('history-row')).toHaveLength(1));
    expect(screen.getByTestId('lifecycle-badge')).toHaveAttribute('data-state', 'RECONCILING');

    // "Reconciled" keeps only the RECONCILED week (LOCKED is excluded).
    await user.click(screen.getByTestId('history-filter-reconciled'));
    await waitFor(() => expect(screen.getAllByTestId('history-row')).toHaveLength(1));
    expect(screen.getByTestId('lifecycle-badge')).toHaveAttribute('data-state', 'RECONCILED');
  });
});

describe('PastCommitDetail', () => {
  const detail: CommitDto = {
    id: 'w2',
    memberId: 'm1',
    weekStart: '2026-05-25',
    lifecycleState: 'RECONCILED',
    submittedAt: '2026-05-29T12:00:00Z',
    reviewedAt: null,
    items: [
      { id: 'i1', text: 'Read-only item', status: 'COMPLETE', supportingOutcomeId: 's1', chessTier: 'KING', carriedFromItemId: null },
    ],
  };

  // A deterministic RCDO tree so the item's supportingOutcomeId (s1) resolves to a real breadcrumb.
  const tree: RallyCryNode[] = [
    {
      id: 'rc1',
      title: 'Rally cry',
      definingObjectives: [
        {
          id: 'do1',
          title: 'Defining objective',
          outcomes: [
            {
              id: 'o1',
              title: 'Outcome',
              supportingOutcomes: [{ id: 's1', outcomeId: 'o1', title: 'Ship the thing', ownerId: null }],
            },
          ],
        },
      ],
    },
  ];

  const pulse: PulseDto = { rating: 4, comment: null, privateToManager: false };

  it('renders read-only items with chess badge, breadcrumb, status, pulse + reconciliation link', async () => {
    server.use(
      http.get('*/commits/w2', () => HttpResponse.json(detail)),
      http.get('*/commits/w2/pulse', () => HttpResponse.json(pulse)),
      http.get('*/rcdo/tree', () => HttpResponse.json(tree)),
    );
    const onReconcile = vi.fn();
    const user = userEvent.setup();
    render(withStore(<PastCommitDetail commitId="w2" onBack={noop} onReconcile={onReconcile} />));

    expect(await screen.findByText('Read-only item')).toBeInTheDocument();
    // Priority badge + resolved strategy ladder + status pill all present.
    expect(screen.getByTestId('chess-tier-badge')).toHaveAttribute('data-tier', 'KING');
    expect(await screen.findByTestId('rcdo-breadcrumb')).toHaveTextContent(/Ship the thing/i);
    expect(screen.getByTestId('item-status')).toHaveAttribute('data-status', 'completed');
    // The recorded pulse is shown read-only.
    expect(await screen.findByTestId('past-pulse')).toHaveTextContent('4/5');
    // No editable composer in the read-only detail.
    expect(screen.queryByTestId('composer-item')).not.toBeInTheDocument();
    expect(screen.queryByTestId('composer-list')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('past-open-reconcile'));
    expect(onReconcile).toHaveBeenCalledWith('w2');
  });

  it('hides the reconciliation link for a draft week', async () => {
    server.use(
      http.get('*/commits/w9', () =>
        HttpResponse.json({ ...detail, id: 'w9', lifecycleState: 'DRAFT' } satisfies CommitDto),
      ),
      http.get('*/commits/w9/pulse', () =>
        HttpResponse.json({ rating: null, comment: null, privateToManager: false } satisfies PulseDto),
      ),
      http.get('*/rcdo/tree', () => HttpResponse.json(tree)),
    );
    render(withStore(<PastCommitDetail commitId="w9" onBack={noop} onReconcile={noop} />));

    expect(await screen.findByText('Read-only item')).toBeInTheDocument();
    expect(screen.queryByTestId('past-open-reconcile')).not.toBeInTheDocument();
  });
});
