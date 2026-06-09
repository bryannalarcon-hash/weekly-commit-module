// apps/wc-remote/src/screens/manager/ReviewQueue.test.tsx — RTL tests for the manager review queue
// (brief §6.7, U21), updated for the WCM design re-skin. MSW-backed, real RTK Query. Covers: the row
// list (Avatar + name + submission badge + done count) with the overdue marker, the filter-chip bar
// with live counts (All / Needs review / Submitted / Draft / Overdue) narrowing the view, opening a
// Submitted/locked report (callback) while a Draft row's open control is disabled, the week stepper /
// selector driving the query, the "All caught up" empty state, and an error state.
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

const rows: ReviewQueueRow[] = [
  { memberId: 'a', memberName: 'Diego Alvarez', commitId: 'c-a', lifecycleState: 'LOCKED', overdue: false, itemCount: 4, completedCount: 2, reviewState: 'UNREVIEWED' },
  { memberId: 'b', memberName: 'Priya Natarajan', commitId: null, lifecycleState: 'DRAFT', overdue: true, itemCount: 1, completedCount: 0, reviewState: 'UNREVIEWED' },
];

describe('ReviewQueue', () => {
  it('lists reports with a submission badge, done count, and an overdue marker', async () => {
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(rows))));
    render(withStore(<ReviewQueue onOpenReview={noop} />));

    const queueRows = await screen.findAllByTestId('queue-row');
    expect(queueRows).toHaveLength(2);
    expect(screen.getByText('Diego Alvarez')).toBeInTheDocument();

    // Diego is a locked submission; Priya is an overdue draft.
    const badges = screen.getAllByTestId('queue-status-badge');
    expect(badges[0]).toHaveAttribute('data-status', 'submitted');
    expect(badges[1]).toHaveAttribute('data-status', 'overdue');
    expect(screen.getByTestId('queue-overdue')).toBeInTheDocument();

    // Done count comes straight from completed/item counts.
    expect(screen.getByText('2/4 done')).toBeInTheDocument();
  });

  it('shows live filter-chip counts over the unfiltered set', async () => {
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(rows))));
    render(withStore(<ReviewQueue onOpenReview={noop} />));
    await screen.findAllByTestId('queue-row');

    expect(screen.getByTestId('queue-count-all')).toHaveTextContent('2');
    // Diego (locked, unreviewed) needs review and is submitted; Priya is an overdue draft.
    expect(screen.getByTestId('queue-count-needs')).toHaveTextContent('1');
    expect(screen.getByTestId('queue-count-submitted')).toHaveTextContent('1');
    expect(screen.getByTestId('queue-count-overdue')).toHaveTextContent('1');
    expect(screen.getByTestId('queue-count-draft')).toHaveTextContent('0');
  });

  it('opens a Submitted report for review and disables open for a Draft', async () => {
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(rows))));
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(withStore(<ReviewQueue onOpenReview={onOpen} />));
    await screen.findAllByTestId('queue-row');

    const buttons = screen.getAllByTestId('queue-open-review');
    expect(buttons[0]).toBeEnabled(); // Diego is LOCKED (Submitted)
    expect(buttons[1]).toBeDisabled(); // Priya is DRAFT
    await user.click(buttons[0]!);
    expect(onOpen).toHaveBeenCalledWith('c-a', expect.any(String));
  });

  it('applies the needs-review filter chip', async () => {
    server.use(http.get('*/review-queue', () => HttpResponse.json(page(rows))));
    const user = userEvent.setup();
    render(withStore(<ReviewQueue onOpenReview={noop} />));
    await screen.findAllByTestId('queue-row');

    await user.click(screen.getByTestId('needs-review-filter'));
    // Only the LOCKED, unreviewed report remains.
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(1));
    expect(screen.getByText('Diego Alvarez')).toBeInTheDocument();
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
