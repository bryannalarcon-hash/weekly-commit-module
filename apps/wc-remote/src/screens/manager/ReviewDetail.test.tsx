// apps/wc-remote/src/screens/manager/ReviewDetail.test.tsx — RTL tests for the re-skinned manager review
// detail (brief §6.8, U21). MSW-backed, real RTK Query. Covers: the report-not-locked state (Draft →
// nothing to review), a locked report's header (name + Locked badge + Pulse) and item cards, the
// a linked item card showing its REAL Supporting-Outcome title resolved from the RCDO tree (not a
// placeholder), the mark-reviewed flow (ConfirmDialog → posts a review), the unlinked-strategy amber notice, the inline
// per-item comment box (Comment toggle), prev/next navigation callbacks (disabled when no handler),
// the CB-1 Schedule-1:1 header button (opens the prefilled ScheduleDialog; success note after posting),
// and an error state.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { CommitDto, PulseDto, RallyCryNode } from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { ReviewDetail } from './ReviewDetail';

// A fixed RCDO tree whose Supporting Outcome `s1` has a known title, so an item linked to `s1` shows
// that real name on its chip (not the generic "Linked outcome" placeholder).
const FIXED_TREE: RallyCryNode[] = [
  {
    id: 'rc-1',
    title: 'Win the quarter',
    definingObjectives: [
      {
        id: 'do-1',
        title: 'Ship the data platform',
        outcomes: [
          {
            id: 'o-1',
            title: 'Single source of truth',
            supportingOutcomes: [
              { id: 's1', outcomeId: 'o-1', title: 'Normalize public holdings', ownerId: null },
            ],
          },
        ],
      },
    ],
  },
];

function treeReturns(tree: RallyCryNode[]): void {
  server.use(http.get('*/rcdo/tree', () => HttpResponse.json(tree)));
}

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

function commit(
  state: CommitDto['lifecycleState'],
  items: CommitDto['items'] = [
    {
      id: 'i1',
      text: 'Their commit item',
      status: 'COMPLETE',
      supportingOutcomeId: 's1',
      chessTier: 'ROOK',
      carriedFromItemId: null,
    },
  ],
): CommitDto {
  return {
    id: 'c1',
    memberId: 'm1',
    weekStart: '2026-06-08',
    lifecycleState: state,
    submittedAt: state === 'DRAFT' ? null : '2026-06-12T12:00:00Z',
    reviewedAt: null,
    items,
  };
}

function pulse(rating: number | null, comment: string | null): PulseDto {
  return { rating, comment, privateToManager: false };
}

describe('ReviewDetail', () => {
  it('resolves the report name from the review queue on a deep link (no memberName prop)', async () => {
    // Deep link / refresh: the route has no memberName to pass. The header must resolve the real
    // name via the review-queue row for the commit's week — never show the raw member UUID.
    server.use(http.get('*/commits/c1', () => HttpResponse.json(commit('LOCKED'))));
    server.use(
      http.get('*/review-queue', () =>
        HttpResponse.json({
          content: [
            {
              memberId: 'm1',
              memberName: 'Maya Chen',
              commitId: 'c1',
              lifecycleState: 'LOCKED',
              overdue: false,
              itemCount: 1,
              completedCount: 0,
              reviewState: 'UNREVIEWED',
            },
          ],
          totalElements: 1,
          totalPages: 1,
          number: 0,
          size: 50,
        }),
      ),
    );
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} />));
    const header = await screen.findByTestId('review-header');
    await waitFor(() => expect(header).toHaveTextContent('Maya Chen'));
    expect(header).not.toHaveTextContent('Report m1');
  });

  it('shows the report-not-locked state for a Draft commit', async () => {
    server.use(http.get('*/commits/c1', () => HttpResponse.json(commit('DRAFT'))));
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} />));
    expect(await screen.findByTestId('empty-state')).toHaveTextContent(/nothing to review/i);
    expect(screen.queryByTestId('mark-reviewed')).not.toBeInTheDocument();
  });

  it('renders the header (name + Locked badge + Pulse) and item cards for a locked report', async () => {
    server.use(http.get('*/commits/c1', () => HttpResponse.json(commit('LOCKED'))));
    server.use(http.get('*/commits/c1/pulse', () => HttpResponse.json(pulse(4, 'Solid week.'))));
    render(withStore(<ReviewDetail commitId="c1" memberName="Maya Chen" onBack={noop} />));

    const header = await screen.findByTestId('review-header');
    expect(within(header).getByText('Maya Chen')).toBeInTheDocument();
    expect(within(header).getByTestId('lifecycle-badge')).toHaveAttribute('data-state', 'LOCKED');
    expect(await screen.findByTestId('review-pulse-rating')).toHaveTextContent('4/5');
    expect(screen.getByTestId('review-pulse')).toHaveTextContent('Solid week.');

    expect(screen.getByText('Their commit item')).toBeInTheDocument();
    expect(screen.getAllByTestId('review-item')).toHaveLength(1);
    // Linked item shows the green RCDO chip, not the unlinked affordance.
    expect(screen.getByTestId('rcdo-chip')).toBeInTheDocument();
    expect(screen.queryByTestId('review-unlinked-notice')).not.toBeInTheDocument();
  });

  it('shows the resolved Supporting Outcome name on a linked item card (not the placeholder)', async () => {
    treeReturns(FIXED_TREE);
    server.use(http.get('*/commits/c1', () => HttpResponse.json(commit('LOCKED'))));
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} />));

    // The default commit item links to `s1`; its chip resolves to the tree's real title.
    expect(await screen.findByText('Normalize public holdings')).toBeInTheDocument();
    expect(screen.queryByText('Linked outcome')).not.toBeInTheDocument();
    expect(screen.getByTestId('rcdo-chip')).toBeInTheDocument();
    expect(screen.queryByTestId('rcdo-chip-unlinked')).not.toBeInTheDocument();
  });

  it('confirms before posting a review on Mark reviewed', async () => {
    server.use(http.get('*/commits/c1', () => HttpResponse.json(commit('LOCKED'))));
    const reviewSpy = vi.fn(() =>
      HttpResponse.json({
        id: 'r1',
        weeklyCommitId: 'c1',
        reviewerId: 'mgr',
        state: 'REVIEWED',
        comment: null,
        reviewedAt: new Date().toISOString(),
      }),
    );
    server.use(http.post('*/commits/c1/review', reviewSpy));
    const user = userEvent.setup();
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} />));

    expect(await screen.findByText('Their commit item')).toBeInTheDocument();
    await user.click(screen.getByTestId('mark-reviewed'));

    // A ConfirmDialog gates the post; nothing is sent until confirmed.
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(reviewSpy).not.toHaveBeenCalled();
    await user.click(within(dialog).getByTestId('confirm-accept'));

    await waitFor(() => expect(reviewSpy).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('mark-reviewed')).toHaveTextContent(/reviewed/i));
  });

  it('shows the amber notice and unlinked chip when an item has no Supporting Outcome', async () => {
    server.use(
      http.get('*/commits/c1', () =>
        HttpResponse.json(
          commit('LOCKED', [
            {
              id: 'i1',
              text: 'Unlinked item',
              status: 'OPEN',
              supportingOutcomeId: null,
              chessTier: 'PAWN',
              carriedFromItemId: null,
            },
          ]),
        ),
      ),
    );
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} />));

    const notice = await screen.findByTestId('review-unlinked-notice');
    expect(notice).toHaveTextContent(/1 item/i);
    expect(notice).toHaveTextContent(/linked to strategy/i);
    expect(screen.getByTestId('rcdo-chip-unlinked')).toBeInTheDocument();
  });

  it('expands an inline comment box from the per-item Comment action', async () => {
    server.use(http.get('*/commits/c1', () => HttpResponse.json(commit('LOCKED'))));
    const user = userEvent.setup();
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} />));
    await screen.findByText('Their commit item');

    expect(screen.queryByTestId('review-item-comment-input-i1')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('review-item-comment-i1'));
    expect(screen.getByTestId('review-item-comment-input-i1')).toBeInTheDocument();
  });

  it('wires prev/next navigation (disabled when no handler)', async () => {
    server.use(http.get('*/commits/c1', () => HttpResponse.json(commit('LOCKED'))));
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} onNext={onNext} />));
    await screen.findByText('Their commit item');

    expect(screen.getByTestId('review-prev')).toBeDisabled(); // no onPrev
    const next = screen.getByTestId('review-next');
    expect(next).toBeEnabled();
    await user.click(next);
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('opens the Schedule 1:1 dialog from the header and shows the success note after scheduling', async () => {
    server.use(http.get('*/commits/c1', () => HttpResponse.json(commit('LOCKED'))));
    const user = userEvent.setup();
    render(withStore(<ReviewDetail commitId="c1" memberName="Maya Chen" onBack={noop} />));
    await screen.findByTestId('review-header');

    // Closed until the header button is clicked; the dialog opens prefilled for THIS report.
    expect(screen.queryByTestId('schedule-dialog')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('schedule-open'));
    const dialog = await screen.findByTestId('schedule-dialog');
    expect(within(dialog).getByTestId('schedule-subject')).toHaveValue('1:1 — Maya Chen');

    // Default MSW handler succeeds → dialog closes and the inline success note appears.
    await user.click(within(dialog).getByTestId('schedule-submit'));
    await waitFor(() => expect(screen.queryByTestId('schedule-dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('schedule-success')).toHaveTextContent(/scheduled/i);
    // Existing header affordances are intact alongside the new button.
    expect(screen.getByTestId('mark-reviewed')).toBeInTheDocument();
  });

  it('shows an error state on failure', async () => {
    server.use(http.get('*/commits/c1', () => new HttpResponse(null, { status: 500 })));
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} />));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });
});
