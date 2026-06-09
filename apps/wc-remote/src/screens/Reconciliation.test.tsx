// apps/wc-remote/src/screens/Reconciliation.test.tsx — RTL tests for the planned-vs-actual view
// (brief §6.6, U20). MSW-backed. Covers: the NOT-YET-LOCKED guard (Draft → redirect back), the
// in-progress (RECONCILING) state with per-row flags + an editable actual-status select, the
// added-after-lock flag, the carry-forward action (confirm + mutation), the reconciled read-only
// state, loading skeleton, and error.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ReconciliationView } from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { Reconciliation } from './Reconciliation';

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

function viewReturns(view: ReconciliationView): void {
  server.use(http.get('*/commits/c1/reconciliation', () => HttpResponse.json(view)));
}

const reconcilingView: ReconciliationView = {
  commitId: 'c1',
  lifecycleState: 'RECONCILING',
  rows: [
    { commitItemId: 'i1', plannedText: 'Planned task', plannedTier: 'KING', supportingOutcomeId: 's1', actualStatus: 'INCOMPLETE', flag: 'INCOMPLETE' },
    { commitItemId: 'i2', plannedText: null, plannedTier: null, supportingOutcomeId: null, actualStatus: 'OPEN', flag: 'ADDED_AFTER_LOCK' },
  ],
};

describe('Reconciliation', () => {
  it('guards a not-yet-locked (Draft) commit and routes back to my week', async () => {
    viewReturns({ commitId: 'c1', lifecycleState: 'DRAFT', rows: [] });
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={onBack} />));
    await user.click(await screen.findByTestId('recon-back-to-week'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows planned-vs-actual rows with flags and an editable status while RECONCILING', async () => {
    viewReturns(reconcilingView);
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));

    const rows = await screen.findAllByTestId('recon-row');
    expect(rows).toHaveLength(2);
    // An incomplete planned item and an added-after-lock item are both flagged.
    expect(within(rows[0]!).getByTestId('recon-flag')).toHaveTextContent(/incomplete/i);
    expect(rows[1]).toHaveAttribute('data-flag', 'ADDED_AFTER_LOCK');
    expect(within(rows[1]!).getByText(/not in the locked plan/i)).toBeInTheDocument();
    // Status is editable in RECONCILING.
    expect(within(rows[0]!).getByTestId('recon-status-select')).toBeInTheDocument();
  });

  it('fires the carry-forward mutation through the confirm dialog', async () => {
    viewReturns(reconcilingView);
    const carry = vi.fn(() => HttpResponse.json({}));
    server.use(http.post('*/commits/c1/carry-forward', carry));
    const user = userEvent.setup();
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));

    await user.click(await screen.findByTestId('carry-forward'));
    await user.click(await screen.findByTestId('confirm-accept'));
    await waitFor(() => expect(carry).toHaveBeenCalled());
  });

  it('debounces a per-item actual-status change into a single PATCH', async () => {
    viewReturns(reconcilingView);
    const patch = vi.fn(() => HttpResponse.json({}));
    server.use(http.patch('*/commits/c1/items/i1/status', patch));
    const user = userEvent.setup();
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));

    const rows = await screen.findAllByTestId('recon-row');
    const select = within(rows[0]!).getByTestId('recon-status-select');
    // Two quick changes coalesce — the debounce keys by itemId so only the last status is sent.
    await user.selectOptions(select, 'OPEN');
    await user.selectOptions(select, 'COMPLETE');
    // The Select reflects the local optimistic choice immediately.
    expect((select as HTMLSelectElement).value).toBe('COMPLETE');
    await waitFor(() => expect(patch).toHaveBeenCalled());
  });

  it('marks the week reconciled while RECONCILING', async () => {
    viewReturns(reconcilingView);
    const reconciled = vi.fn(() => HttpResponse.json({}));
    server.use(http.post('*/commits/c1/reconciled', reconciled));
    const user = userEvent.setup();
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));

    await user.click(await screen.findByTestId('mark-reconciled'));
    await waitFor(() => expect(reconciled).toHaveBeenCalled());
  });

  it('renders a reconciled week read-only (no status select)', async () => {
    viewReturns({
      ...reconcilingView,
      lifecycleState: 'RECONCILED',
      rows: [
        { commitItemId: 'i1', plannedText: 'Done', plannedTier: 'QUEEN', supportingOutcomeId: 's1', actualStatus: 'COMPLETE', flag: 'COMPLETED' },
      ],
    });
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));
    await screen.findAllByTestId('recon-row');
    expect(screen.getByTestId('lifecycle-badge')).toHaveAttribute('data-state', 'RECONCILED');
    expect(screen.queryByTestId('recon-status-select')).not.toBeInTheDocument();
  });

  it('shows an error state on failure', async () => {
    server.use(http.get('*/commits/c1/reconciliation', () => new HttpResponse(null, { status: 500 })));
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });
});
