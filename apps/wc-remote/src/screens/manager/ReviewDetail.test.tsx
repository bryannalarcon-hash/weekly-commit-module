// apps/wc-remote/src/screens/manager/ReviewDetail.test.tsx — RTL tests for the manager review detail
// (brief §6.8, U21). MSW-backed. Covers: the report-not-locked state (Draft → nothing to review), a
// locked report's items + the mark-reviewed action (posts a review), prev/next navigation callbacks
// (disabled when no handler), and an error state.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { CommitDto } from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { ReviewDetail } from './ReviewDetail';

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

function commit(state: CommitDto['lifecycleState']): CommitDto {
  return {
    id: 'c1',
    memberId: 'm1',
    weekStart: '2026-06-08',
    lifecycleState: state,
    submittedAt: state === 'DRAFT' ? null : '2026-06-12T12:00:00Z',
    reviewedAt: null,
    items: [
      { id: 'i1', text: 'Their commit item', status: 'COMPLETE', supportingOutcomeId: 's1', chessTier: 'ROOK', carriedFromItemId: null },
    ],
  };
}

describe('ReviewDetail', () => {
  it('shows the report-not-locked state for a Draft commit', async () => {
    server.use(http.get('*/commits/c1', () => HttpResponse.json(commit('DRAFT'))));
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} />));
    expect(await screen.findByTestId('empty-state')).toHaveTextContent(/nothing to review/i);
    expect(screen.queryByTestId('mark-reviewed')).not.toBeInTheDocument();
  });

  it('renders a locked report and posts a review on Mark reviewed', async () => {
    server.use(http.get('*/commits/c1', () => HttpResponse.json(commit('LOCKED'))));
    const reviewSpy = vi.fn(() =>
      HttpResponse.json({ id: 'r1', weeklyCommitId: 'c1', reviewerId: 'mgr', state: 'REVIEWED', comment: null, reviewedAt: new Date().toISOString() }),
    );
    server.use(http.post('*/commits/c1/review', reviewSpy));
    const user = userEvent.setup();
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} />));

    expect(await screen.findByText('Their commit item')).toBeInTheDocument();
    await user.click(screen.getByTestId('mark-reviewed'));
    await waitFor(() => expect(reviewSpy).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('mark-reviewed')).toHaveTextContent(/reviewed/i));
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

  it('shows an error state on failure', async () => {
    server.use(http.get('*/commits/c1', () => new HttpResponse(null, { status: 500 })));
    render(withStore(<ReviewDetail commitId="c1" onBack={noop} />));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });
});
