// apps/wc-remote/src/screens/manager/ReviewQueue.test.tsx — RTL tests for the manager review queue
// (brief §6.7, U21), updated for the WCM design re-skin. MSW-backed, real RTK Query. Covers: the row
// list (Avatar + name + submission badge + done count) with the overdue marker, the filter-chip bar
// with live counts (All / Needs review / Submitted / Draft / Overdue) narrowing the view, opening a
// RECONCILED (reviewable) report (callback) while LOCKED/Draft open controls are DISABLED (a review is
// only allowed post-reconciliation — the backend 409s earlier), the 'ready' badge for a
// RECONCILED-unreviewed row, the week stepper / selector driving the query, the empty state, and error.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Page, ReviewQueueRow } from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { ReviewQueue } from './ReviewQueue';

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

function page(rows: ReviewQueueRow[]): Page<ReviewQueueRow> {
  return { content: rows, totalElements: rows.length, totalPages: 1, number: 0, size: 50 };
}

// Diego is RECONCILED-unreviewed → "Ready to review" + reviewable + counts in needs-review.
// Sam is LOCKED (submitted, awaiting reconciliation) → NOT reviewable, NOT needs-review.
// Priya is an overdue DRAFT.
const rows: ReviewQueueRow[] = [
  { memberId: 'a', memberName: 'Diego Alvarez', commitId: 'c-a', lifecycleState: 'RECONCILED', overdue: false, itemCount: 4, completedCount: 2, reviewState: 'UNREVIEWED' },
  { memberId: 's', memberName: 'Sam Locked', commitId: 'c-s', lifecycleState: 'LOCKED', overdue: false, itemCount: 3, completedCount: 0, reviewState: 'UNREVIEWED' },
  { memberId: 'b', memberName: 'Priya Natarajan', commitId: null, lifecycleState: 'DRAFT', overdue: true, itemCount: 1, completedCount: 0, reviewState: 'UNREVIEWED' },
];

describe('ReviewQueue', () => {
  it('lists reports with a submission badge, done count, and an overdue marker', async () => {
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(rows))));
    render(withStore(<ReviewQueue onOpenReview={noop} />));

    const queueRows = await screen.findAllByTestId('queue-row');
    expect(queueRows).toHaveLength(3);
    expect(screen.getByText('Diego Alvarez')).toBeInTheDocument();

    // Diego is RECONCILED-unreviewed → "Ready to review"; Sam is a LOCKED submission; Priya is overdue.
    const badges = screen.getAllByTestId('queue-status-badge');
    expect(badges[0]).toHaveAttribute('data-status', 'ready');
    expect(badges[1]).toHaveAttribute('data-status', 'submitted');
    expect(badges[2]).toHaveAttribute('data-status', 'overdue');
    expect(screen.getByText('Ready to review')).toBeInTheDocument();
    expect(screen.getByTestId('queue-overdue')).toBeInTheDocument();

    // Diego (RECONCILED) shows completion; Sam (LOCKED, not-yet-reconciled) shows its PLANNED count.
    expect(screen.getByText('2/4 done')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  it('shows "X/Y done" only for reconciled weeks, and the planned count otherwise', async () => {
    const mixed: ReviewQueueRow[] = [
      { memberId: 'r', memberName: 'Rae Reconciled', commitId: 'c-r', lifecycleState: 'RECONCILED', overdue: false, itemCount: 3, completedCount: 2, reviewState: 'REVIEWED' },
      { memberId: 's', memberName: 'Sam Submitted', commitId: 'c-s', lifecycleState: 'LOCKED', overdue: false, itemCount: 2, completedCount: 0, reviewState: 'UNREVIEWED' },
    ];
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(mixed))));
    render(withStore(<ReviewQueue onOpenReview={noop} />));
    await screen.findAllByTestId('queue-row');

    expect(screen.getByText('2/3 done')).toBeInTheDocument(); // reconciled → completion
    expect(screen.getByText('2 items')).toBeInTheDocument(); // submitted/locked → planned count, NOT "0/2 done"
    expect(screen.queryByText('0/2 done')).not.toBeInTheDocument();
  });

  it('shows live filter-chip counts over the unfiltered set', async () => {
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(rows))));
    render(withStore(<ReviewQueue onOpenReview={noop} />));
    await screen.findAllByTestId('queue-row');

    expect(screen.getByTestId('queue-count-all')).toHaveTextContent('3');
    // Diego (RECONCILED, unreviewed) needs review; Sam is a LOCKED submission (NOT needs-review);
    // Priya is an overdue draft.
    expect(screen.getByTestId('queue-count-needs')).toHaveTextContent('1');
    expect(screen.getByTestId('queue-count-submitted')).toHaveTextContent('1');
    expect(screen.getByTestId('queue-count-overdue')).toHaveTextContent('1');
    expect(screen.getByTestId('queue-count-draft')).toHaveTextContent('0');
  });

  it('opens a RECONCILED report for review; LOCKED and Draft open controls are disabled', async () => {
    // A review is only allowed once the IC has RECONCILED (the backend 409s an earlier review), so a
    // LOCKED submission is NOT yet reviewable — only the reconciled row's open control is enabled.
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(rows))));
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(withStore(<ReviewQueue onOpenReview={onOpen} />));
    await screen.findAllByTestId('queue-row');

    const buttons = screen.getAllByTestId('queue-open-review');
    expect(buttons[0]).toBeEnabled(); // Diego is RECONCILED → reviewable
    expect(buttons[1]).toBeDisabled(); // Sam is LOCKED (awaiting reconciliation) → not reviewable
    expect(buttons[2]).toBeDisabled(); // Priya is DRAFT
    await user.click(buttons[0]!);
    expect(onOpen).toHaveBeenCalledWith('c-a', expect.any(String));
  });

  it('applies the needs-review filter chip', async () => {
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(rows))));
    const user = userEvent.setup();
    render(withStore(<ReviewQueue onOpenReview={noop} />));
    await screen.findAllByTestId('queue-row');

    await user.click(screen.getByTestId('needs-review-filter'));
    // Only the RECONCILED, unreviewed report remains — the LOCKED submission is NOT needs-review.
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(1));
    expect(screen.getByText('Diego Alvarez')).toBeInTheDocument();
    expect(screen.queryByText('Sam Locked')).not.toBeInTheDocument();
  });

  it('applies a submission-status filter chip (Draft)', async () => {
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(rows))));
    const user = userEvent.setup();
    render(withStore(<ReviewQueue onOpenReview={noop} />));
    await screen.findAllByTestId('queue-row');

    await user.click(screen.getByTestId('queue-filter-overdue'));
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(1));
    expect(screen.getByText('Priya Natarajan')).toBeInTheDocument();
  });

  it('drives the query by the selected week', async () => {
    const seen: string[] = [];
    server.use(
      http.get('*/review-queue', ({ request }) => {
        const w = new URL(request.url).searchParams.get('weekStart');
        if (w) seen.push(w);
        return HttpResponse.json(page(rows));
      }),
    );
    const user = userEvent.setup();
    render(withStore(<ReviewQueue onOpenReview={noop} />));
    await screen.findAllByTestId('queue-row');

    const select = screen.getByTestId('week-selector') as HTMLSelectElement;
    const secondWeek = (select.options[1] as HTMLOptionElement).value;
    await user.selectOptions(select, secondWeek);
    await waitFor(() => expect(seen).toContain(secondWeek));
  });

  it('queue rows wrap on narrow widths instead of overlapping (badge never paints over the name)', async () => {
    // Layout regression for the 390px overlap: the long "Submitted — awaiting reconciliation"
    // pill used to paint over the member name. The row must be a wrapping flex container and the
    // name block must truncate with an ellipsis instead of overflowing under the badge.
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(rows))));
    render(withStore(<ReviewQueue onOpenReview={noop} />));
    const queueRows = await screen.findAllByTestId('queue-row');

    const samRow = queueRows[1]!; // Sam Locked — carries the longest status pill
    expect(samRow.style.display).toBe('flex');
    expect(samRow.style.flexWrap).toBe('wrap');

    const name = screen.getByText('Sam Locked');
    expect(name.style.overflow).toBe('hidden');
    expect(name.style.textOverflow).toBe('ellipsis');
    expect(name.style.whiteSpace).toBe('nowrap');
  });

  it('shows the all-caught-up empty state', async () => {
    server.use(http.get('*/review-queue', () => HttpResponse.json(page([]))));
    render(withStore(<ReviewQueue onOpenReview={noop} />));
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('shows a retryable error state on failure', async () => {
    server.use(http.get('*/review-queue', () => HttpResponse.error()));
    render(withStore(<ReviewQueue onOpenReview={noop} />));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });
});
