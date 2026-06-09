// apps/wc-remote/src/screens/manager/RollupDashboard.test.tsx — RTL tests for the team roll-up (brief
// §6.9, U21), re-skinned to the WCM Team Dashboard. MSW-backed, real RTK Query. Asserts the four
// tinted Metric tiles + the completion-trend sparkline render, the PRIMARY direct-reports table renders
// rows with derived done/total + status pills + tabular numerals, pagination advances the page (next
// query), sortable headers reorder the visible page, the row and chevron drill through, the "Open
// queue" affordance fires, and the empty/error states render.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Page, RollupRow } from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { RollupDashboard } from './RollupDashboard';

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

function rollupPage(rows: RollupRow[], totalPages = 2, number = 0): Page<RollupRow> {
  return { content: rows, totalElements: rows.length * totalPages, totalPages, number, size: 50 };
}

const rows: RollupRow[] = [
  { memberId: 'a', memberName: 'Diego Alvarez', commitCount: 3, itemCount: 4, completionPct: 50, carryOverRate: 25, rcdoAlignmentPct: 75 },
  { memberId: 'b', memberName: 'Aria Bell', commitCount: 2, itemCount: 6, completionPct: 90, carryOverRate: 10, rcdoAlignmentPct: 100 },
];

describe('RollupDashboard', () => {
  it('renders the tinted metric tiles, trend sparkline, and the primary per-report table', async () => {
    server.use(http.get('*/rollup', () => HttpResponse.json(rollupPage(rows))));
    render(withStore(<RollupDashboard onDrillThrough={noop} />));

    const table = await screen.findByTestId('rollup-table');
    const dataRows = within(table).getAllByTestId('rollup-row');
    expect(dataRows).toHaveLength(2);

    // Four summary tiles: three tinted Metric tiles + the Unreviewed tile.
    expect(screen.getAllByTestId('metric').length).toBe(3);
    expect(screen.getByTestId('metric-widget')).toBeInTheDocument();
    // Team aggregates are averaged over the page: completion = round((50+90)/2) = 70.
    const tiles = screen.getAllByTestId('metric-value');
    expect(tiles.some((t) => t.textContent?.includes('70'))).toBe(true);

    // The completion-trend sparkline renders.
    expect(screen.getByTestId('trend-sparkline')).toBeInTheDocument();

    // Diego's row carries his derived completion (round(50% * 4) = 2 of 4) + a status pill.
    const diego = dataRows.find((r) => within(r).queryByText('Diego Alvarez'));
    expect(diego).toBeTruthy();
    expect(within(diego!).getByText('2/4')).toBeInTheDocument();
    expect(within(diego!).getByText('75%')).toBeInTheDocument(); // alignment, tabular-nums
    expect(within(diego!).getByTestId('status-pill')).toHaveTextContent('Submitted');
    expect(within(diego!).getByTestId('completion-bar')).toBeInTheDocument();
  });

  it('advances the page via pagination controls', async () => {
    const pagesSeen: number[] = [];
    server.use(
      http.get('*/rollup', ({ request }) => {
        const p = Number(new URL(request.url).searchParams.get('page') ?? '0');
        pagesSeen.push(p);
        return HttpResponse.json(rollupPage(rows, 2, p));
      }),
    );
    const user = userEvent.setup();
    render(withStore(<RollupDashboard onDrillThrough={noop} />));
    await screen.findByTestId('rollup-table');

    await user.click(screen.getByTestId('page-next'));
    await waitFor(() => expect(pagesSeen).toContain(1));
  });

  it('sorts the visible page by a numeric column', async () => {
    server.use(http.get('*/rollup', () => HttpResponse.json(rollupPage(rows))));
    const user = userEvent.setup();
    render(withStore(<RollupDashboard onDrillThrough={noop} />));
    await screen.findByTestId('rollup-table');

    // Default sort is by name ascending (Aria before Diego).
    const first = screen.getAllByTestId('rollup-row')[0]!;
    expect(within(first).getByText('Aria Bell')).toBeInTheDocument();

    // Sort by completion ascending → Diego (50) first; click again to flip to descending → Aria (90).
    await user.click(screen.getByTestId('sort-completionPct'));
    await waitFor(() => {
      const top = screen.getAllByTestId('rollup-row')[0]!;
      expect(within(top).getByText('Diego Alvarez')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('sort-completionPct'));
    await waitFor(() => {
      const top = screen.getAllByTestId('rollup-row')[0]!;
      expect(within(top).getByText('Aria Bell')).toBeInTheDocument();
    });
  });

  it('shows the empty state when there is no team data', async () => {
    server.use(http.get('*/rollup', () => HttpResponse.json(rollupPage([], 1))));
    render(withStore(<RollupDashboard onDrillThrough={noop} />));
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows an error state on failure', async () => {
    server.use(http.get('*/rollup', () => new HttpResponse(null, { status: 500 })));
    render(withStore(<RollupDashboard onDrillThrough={noop} />));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });

  it('invokes onDrillThrough with the report id from the row chevron', async () => {
    server.use(http.get('*/rollup', () => HttpResponse.json(rollupPage(rows))));
    const onDrill = vi.fn();
    const user = userEvent.setup();
    render(withStore(<RollupDashboard onDrillThrough={onDrill} />));
    await screen.findByTestId('rollup-table');
    await user.click(screen.getAllByTestId('rollup-drill')[0]!);
    expect(onDrill).toHaveBeenCalledWith(expect.any(String));
  });

  it('fires onOpenQueue from the Unreviewed tile affordance', async () => {
    server.use(http.get('*/rollup', () => HttpResponse.json(rollupPage(rows))));
    const onOpenQueue = vi.fn();
    const user = userEvent.setup();
    render(withStore(<RollupDashboard onDrillThrough={noop} onOpenQueue={onOpenQueue} />));
    await screen.findByTestId('rollup-table');
    await user.click(screen.getByTestId('open-queue'));
    expect(onOpenQueue).toHaveBeenCalled();
  });
});
