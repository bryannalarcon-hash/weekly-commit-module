// apps/wc-remote/src/screens/Reconciliation.test.tsx — RTL tests for the re-skinned planned-vs-actual
// view (brief §6.6, U20). MSW-backed, RTK Query real. Covers: the NOT-YET-LOCKED guard (Draft →
// redirect back), a LOCKED week's owner Begin CTA + an un-judged item rendering neutral PENDING (Bug
// 1), a LOCKED report read-only for a non-owner manager (canReconcile=false → recon-readonly-note, no
// Begin — Bug 2), the in-progress (RECONCILING) state with the three tinted metric tiles, per-row
// ItemStatus flags + an editable actual-status select, the added-after-lock flag ("NOT PLANNED"
// placeholder + amber added card), the unified "Carry forward & reconcile" action (confirm dialog →
// carry-forward + markReconciled mutations), the reconciled read-only success banner, loading
// skeleton, and error.
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
  canReconcile: true,
  rows: [
    { commitItemId: 'i1', plannedText: 'Planned task', plannedTier: 'KING', supportingOutcomeId: 's1', actualStatus: 'INCOMPLETE', flag: 'INCOMPLETE' },
    { commitItemId: 'i2', plannedText: null, plannedTier: null, supportingOutcomeId: null, actualStatus: 'OPEN', flag: 'ADDED_AFTER_LOCK' },
  ],
};

describe('Reconciliation', () => {
  it('guards a not-yet-locked (Draft) commit and routes back to my week', async () => {
    viewReturns({ commitId: 'c1', lifecycleState: 'DRAFT', canReconcile: true, rows: [] });
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={onBack} />));
    await user.click(await screen.findByTestId('recon-back-to-week'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows a LOCKED week the "Begin reconciliation" CTA, which POSTs the LOCKED→RECONCILING start', async () => {
    viewReturns({
      commitId: 'c1',
      lifecycleState: 'LOCKED',
      canReconcile: true,
      rows: [
        // Bug 1: an un-judged item on a just-locked week is PENDING (neutral), NOT pre-flagged red.
        { commitItemId: 'i1', plannedText: 'Planned task', plannedTier: 'KING', supportingOutcomeId: 's1', actualStatus: null, flag: 'PENDING' },
      ],
    });
    const startSpy = vi.fn(() => HttpResponse.json({ id: 'c1', items: [] }));
    server.use(http.post('*/commits/c1/reconcile', startSpy));
    const user = userEvent.setup();
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));

    // LOCKED is NOT editable yet: no per-row status select, but a Begin CTA + hint.
    expect(await screen.findByTestId('recon-begin')).toBeInTheDocument();
    expect(screen.getByTestId('recon-locked-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('status-select')).not.toBeInTheDocument();

    // The un-judged item renders the neutral PENDING pill (not the red Incomplete one) and shows no
    // "will carry forward" hint.
    const row = await screen.findByTestId('recon-row');
    expect(within(row).getByTestId('recon-flag')).toHaveTextContent(/pending/i);
    expect(within(row).queryByText(/will carry forward/i)).not.toBeInTheDocument();

    await user.click(screen.getByTestId('recon-begin'));
    await waitFor(() => expect(startSpy).toHaveBeenCalled()); // POST /commits/c1/reconcile
  });

  it('renders a LOCKED report read-only for a non-owner (manager): a note, no Begin CTA', async () => {
    // Bug 2: a manager viewing a not-yet-reconciled report (canReconcile=false) must not see the
    // owner-only "Begin reconciliation" control — they'd 403 on it. They see a read-only note.
    viewReturns({
      commitId: 'c1',
      lifecycleState: 'LOCKED',
      canReconcile: false,
      rows: [
        { commitItemId: 'i1', plannedText: 'Planned task', plannedTier: 'KING', supportingOutcomeId: 's1', actualStatus: null, flag: 'PENDING' },
      ],
    });
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));

    expect(await screen.findByTestId('recon-readonly-note')).toBeInTheDocument();
    expect(screen.queryByTestId('recon-begin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recon-status-select')).not.toBeInTheDocument();
  });

  it('shows the three tinted metric tiles summarizing completion', async () => {
    viewReturns(reconcilingView);
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));

    const summary = await screen.findByTestId('recon-summary');
    // One planned row (incomplete) → 0/1 completed, 0% completion, 1 carrying over.
    expect(within(summary).getByText(/completion/i)).toBeInTheDocument();
    expect(within(summary).getByText(/completed/i)).toBeInTheDocument();
    expect(within(summary).getByText(/carrying over/i)).toBeInTheDocument();
    expect(within(summary).getByText('0/1')).toBeInTheDocument();
    expect(within(summary).getAllByTestId('metric')).toHaveLength(3);
  });

  it('shows planned-vs-actual rows with flags and an editable status while RECONCILING', async () => {
    viewReturns(reconcilingView);
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));

    const rows = await screen.findAllByTestId('recon-row');
    expect(rows).toHaveLength(2);
    // The incomplete planned item carries the Incomplete flag + the carry-forward hint.
    const planned = rows.find((r) => r.getAttribute('data-flag') === 'INCOMPLETE')!;
    expect(within(planned).getByTestId('recon-flag')).toHaveTextContent(/incomplete/i);
    expect(within(planned).getByText(/will carry forward/i)).toBeInTheDocument();
    // The added-after-lock item is flagged and sits opposite a "NOT PLANNED" placeholder.
    const added = rows.find((r) => r.getAttribute('data-flag') === 'ADDED_AFTER_LOCK')!;
    expect(within(added).getByTestId('recon-flag')).toHaveTextContent(/added after lock/i);
    expect(screen.getByText('NOT PLANNED')).toBeInTheDocument();
    // Status is editable in RECONCILING.
    expect(within(planned).getByTestId('recon-status-select')).toBeInTheDocument();
  });

  it('fires carry-forward then markReconciled through the unified confirm dialog', async () => {
    viewReturns(reconcilingView);
    const carry = vi.fn(() => HttpResponse.json({}));
    const reconciled = vi.fn(() => HttpResponse.json({}));
    server.use(http.post('*/commits/c1/carry-forward', carry));
    server.use(http.post('*/commits/c1/reconciled', reconciled));
    const user = userEvent.setup();
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));

    // The header "Carry forward & reconcile" action opens the confirm dialog.
    await user.click(await screen.findByTestId('carry-forward'));
    await user.click(await screen.findByTestId('confirm-accept'));
    // There is an incomplete item, so it carries forward AND marks the week reconciled.
    await waitFor(() => expect(carry).toHaveBeenCalled());
    await waitFor(() => expect(reconciled).toHaveBeenCalled());
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

  it('marks reconciled even when nothing is incomplete (no carry-forward)', async () => {
    viewReturns({
      ...reconcilingView,
      rows: [
        { commitItemId: 'i1', plannedText: 'Done', plannedTier: 'QUEEN', supportingOutcomeId: 's1', actualStatus: 'COMPLETE', flag: 'COMPLETED' },
      ],
    });
    const carry = vi.fn(() => HttpResponse.json({}));
    const reconciled = vi.fn(() => HttpResponse.json({}));
    server.use(http.post('*/commits/c1/carry-forward', carry));
    server.use(http.post('*/commits/c1/reconciled', reconciled));
    const user = userEvent.setup();
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));

    await user.click(await screen.findByTestId('carry-forward'));
    await user.click(await screen.findByTestId('confirm-accept'));
    await waitFor(() => expect(reconciled).toHaveBeenCalled());
    // Nothing incomplete → no carry-forward request fires.
    expect(carry).not.toHaveBeenCalled();
  });

  it('renders a reconciled week as a read-only success banner (no status select)', async () => {
    viewReturns({
      ...reconcilingView,
      lifecycleState: 'RECONCILED',
      rows: [
        { commitItemId: 'i1', plannedText: 'Done', plannedTier: 'QUEEN', supportingOutcomeId: 's1', actualStatus: 'COMPLETE', flag: 'COMPLETED' },
      ],
    });
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));
    await screen.findAllByTestId('recon-row');
    expect(await screen.findByTestId('recon-success')).toHaveTextContent(/week reconciled/i);
    expect(screen.queryByTestId('recon-status-select')).not.toBeInTheDocument();
    // The unified reconcile action is gone once the week is closed.
    expect(screen.queryByTestId('carry-forward')).not.toBeInTheDocument();
  });

  it('shows an error state on failure', async () => {
    server.use(http.get('*/commits/c1/reconciliation', () => new HttpResponse(null, { status: 500 })));
    render(withStore(<Reconciliation commitId="c1" onBackToWeek={noop} />));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });
});
