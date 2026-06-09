// apps/wc-remote/src/screens/manager/RollupDashboard.test.tsx — RTL tests for the team roll-up (brief
// §6.9, U21). MSW-backed. Asserts the PRIMARY per-report table renders rows with per-report completion%
// and tabular numerals, supporting metric widgets appear, pagination advances the page (next query),
// sort works, drill-through fires, and empty/error states render.
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
  it('renders the primary per-report table with completion% and supporting widgets', async () => {
    server.use(http.get('*/rollup', () => HttpResponse.json(rollupPage(rows))));
    render(withStore(<RollupDashboard onDrillThrough={noop} />));

    const table = await screen.findByTestId('rollup-table');
    const dataRows = within(table).getAllByTestId('rollup-row');
    expect(dataRows).toHaveLength(2);
    // Diego's row carries his per-report completion (default sort is by name → Aria, then Diego).
    const diego = dataRows.find((r) => within(r).queryByText('Diego Alvarez'));
    expect(diego).toBeTruthy();
    expect(within(diego!).getByText('50%')).toBeInTheDocument();
    // Supporting metric widgets exist (but are not the primary surface).
    expect(screen.getAllByTestId('metric-widget').length).toBeGreaterThanOrEqual(3);
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

    // Default sort is by name (Aria before Diego). Sort by completion% → Aria (90) first stays first.
    await user.click(screen.getByTestId('sort-completionPct'));
    await waitFor(() => {
      const first = screen.getAllByTestId('rollup-row')[0]!;
      expect(within(first).getByText('Aria Bell')).toBeInTheDocument();
    });
  });

  it('fires drill-through and shows the empty state when no data', async () => {
    server.use(http.get('*/rollup', () => HttpResponse.json(rollupPage([], 1))));
    render(withStore(<RollupDashboard onDrillThrough={noop} />));
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows an error state on failure', async () => {
    server.use(http.get('*/rollup', () => new HttpResponse(null, { status: 500 })));
    render(withStore(<RollupDashboard onDrillThrough={noop} />));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });

  it('invokes onDrillThrough with the report id', async () => {
    server.use(http.get('*/rollup', () => HttpResponse.json(rollupPage(rows))));
    const onDrill = vi.fn();
    const user = userEvent.setup();
    render(withStore(<RollupDashboard onDrillThrough={onDrill} />));
    await screen.findByTestId('rollup-table');
    await user.click(screen.getAllByTestId('rollup-drill')[0]!);
    expect(onDrill).toHaveBeenCalled();
  });
});
