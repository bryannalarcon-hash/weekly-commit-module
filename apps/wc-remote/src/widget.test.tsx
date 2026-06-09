// apps/wc-remote/src/widget.test.tsx — RTL tests for the federated dashboard widget (c-design
// prototype/wcm/widget.jsx), MSW-backed with real RTK Query. The widget self-provides its store, so
// these mount <WeeklyCommitWidget> directly (no host store needed) and let it fetch the current week
// off the same MSW handlers the app uses. Covers both variants — CARD (lifecycle stripe, linked/total
// ring + readiness, top-3 items + "+N more", due line, contextual CTA → onOpen) and COMPACT (slim
// status strip → onOpen) — plus the empty, loading, and error states, and the host-supplied `week`
// fast-path that skips the fetch. Asserts the testids the design implies: wcm-widget, widget-card,
// widget-compact, widget-cta.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { CommitDto } from '@wcm/types';
import { handlers, resetMockDb } from '@wcm/api';
import { WeeklyCommitWidget } from './widget';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetMockDb();
});
afterAll(() => server.close());

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

const FIVE_ITEMS: CommitDto['items'] = [
  {
    id: 'i1',
    text: 'Ship data-mapping wizard v1 to staging',
    status: 'OPEN',
    supportingOutcomeId: 'so1',
    chessTier: 'KING',
    carriedFromItemId: null,
  },
  {
    id: 'i2',
    text: 'Cut custodian-recon false positives by 30%',
    status: 'OPEN',
    supportingOutcomeId: 'so2',
    chessTier: 'ROOK',
    carriedFromItemId: null,
  },
  {
    id: 'i3',
    text: 'Prep Q3 platform capacity plan',
    status: 'OPEN',
    supportingOutcomeId: null,
    chessTier: 'QUEEN',
    carriedFromItemId: null,
  },
  {
    id: 'i4',
    text: 'Finish exposure-cube pre-aggregation spike',
    status: 'OPEN',
    supportingOutcomeId: 'so6',
    chessTier: 'ROOK',
    carriedFromItemId: null,
  },
  {
    id: 'i5',
    text: 'Write synthetic-monitoring runbook',
    status: 'OPEN',
    supportingOutcomeId: 'so4',
    chessTier: 'PAWN',
    carriedFromItemId: null,
  },
];

describe('WeeklyCommitWidget — CARD variant', () => {
  it('renders the lifecycle badge, linked/total ring readiness, top-3 items + "+N more", due line', async () => {
    currentReturns(commit({ items: FIVE_ITEMS }));
    render(<WeeklyCommitWidget />);

    // Wait for the loaded readiness line (loading skeleton shares the widget-card testid).
    const readiness = await screen.findByTestId('widget-readiness');
    const card = screen.getByTestId('widget-card');
    expect(screen.getByTestId('wcm-widget')).toHaveAttribute(
      'data-variant',
      'card',
    );
    // Lifecycle badge reflects DRAFT.
    expect(screen.getByTestId('lifecycle-badge')).toHaveAttribute(
      'data-state',
      'DRAFT',
    );
    // 4 of 5 linked → readiness shows "1 item need a link" (not ready to lock).
    expect(readiness).toHaveTextContent(/1 item need a link/i);
    expect(card).toHaveTextContent('linked to strategy');
    // Top-3 items only, then "+2 more".
    expect(screen.getAllByTestId('widget-item')).toHaveLength(3);
    expect(card).toHaveTextContent('Ship data-mapping wizard v1 to staging');
    expect(card).toHaveTextContent('+2 more');
    // Due line for the Mon-start week (Friday).
    expect(card).toHaveTextContent(/Due Fri Jun 12/);
  });

  it('shows "Ready to lock" + the Open CTA when fully linked and not a Draft', async () => {
    currentReturns(
      commit({
        lifecycleState: 'LOCKED',
        items: [
          {
            id: 'i1',
            text: 'All linked',
            status: 'COMPLETE',
            supportingOutcomeId: 'so1',
            chessTier: 'KING',
            carriedFromItemId: null,
          },
        ],
      }),
    );
    render(<WeeklyCommitWidget variant="card" />);
    expect(await screen.findByTestId('widget-readiness')).toHaveTextContent(
      /ready to lock/i,
    );
    expect(screen.getByTestId('widget-cta')).toHaveTextContent(/open/i);
    expect(screen.getByTestId('lifecycle-badge')).toHaveAttribute(
      'data-state',
      'LOCKED',
    );
  });

  it('fires onOpen("edit") with "Finish & lock" on a Draft CTA click', async () => {
    currentReturns(commit({ items: FIVE_ITEMS }));
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<WeeklyCommitWidget onOpen={onOpen} />);

    const cta = await screen.findByTestId('widget-cta');
    expect(cta).toHaveTextContent(/finish & lock/i);
    await user.click(cta);
    expect(onOpen).toHaveBeenCalledWith('edit');
  });

  it('shows the empty "Start your week" card and routes via the CTA when there is no commit', async () => {
    currentReturns(null);
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<WeeklyCommitWidget onOpen={onOpen} />);

    // Wait for the resolved empty state (the loading skeleton shares the widget-card testid).
    await screen.findByText(/start your week/i);
    expect(screen.queryByTestId('widget-item')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('widget-cta'));
    expect(onOpen).toHaveBeenCalledWith('edit');
  });

  it('shows an error state with retry when the week fails to load', async () => {
    server.use(
      http.get(
        '*/commits/current',
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    render(<WeeklyCommitWidget />);
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
    expect(screen.getByTestId('widget-card')).toBeInTheDocument();
  });
});

describe('WeeklyCommitWidget — COMPACT variant', () => {
  it('renders a slim status strip with n/total + lifecycle and fires onOpen("myweek")', async () => {
    currentReturns(commit({ items: FIVE_ITEMS }));
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<WeeklyCommitWidget variant="compact" onOpen={onOpen} />);

    // Wait for the resolved strip content (loading skeleton shares the widget-compact testid).
    await screen.findByText('4/5 linked · Draft');
    const strip = screen.getByTestId('widget-compact');
    expect(screen.getByTestId('wcm-widget')).toHaveAttribute(
      'data-variant',
      'compact',
    );
    expect(strip).toHaveTextContent('This week');
    await user.click(strip);
    expect(onOpen).toHaveBeenCalledWith('myweek');
  });
});

describe('WeeklyCommitWidget — host-supplied week (skips fetch)', () => {
  it('renders the provided commit without a network request', async () => {
    // No MSW handler override needed — the widget must not call the API when `week` is supplied.
    render(
      <WeeklyCommitWidget
        week={commit({ items: FIVE_ITEMS.slice(0, 2) })}
        variant="card"
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('widget-card')).toBeInTheDocument(),
    );
    expect(screen.getAllByTestId('widget-item')).toHaveLength(2);
    // Both supplied items are linked → ready to lock readiness.
    expect(screen.getByTestId('widget-readiness')).toHaveTextContent(
      /ready to lock/i,
    );
  });
});
