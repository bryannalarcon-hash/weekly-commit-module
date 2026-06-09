// apps/wc-remote/src/app/routesNavigation.test.tsx — proves the WC route table's thin wrappers fire
// their useNavigate-bridged callbacks (routes.tsx). Mounts the real provider stack + WcShell at "/"
// with a FRESH per-test store (WeeklyCommitApp's default store is a module singleton, so injecting an
// isolated one here keeps the constant-key getCurrentWeek cache from bleeding between tests). A user
// action on My Week (Edit/Continue, Open reconciliation) must drive the router to the corresponding
// screen — exercising the route wrapper's onEdit/onReconcile closures and the EditRoute/ReconcileRoute
// targets.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { CommitDto } from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { AppProviders } from './AppProviders';
import { RequireAuth } from './guards';
import { WcShell } from '../WeeklyCommitApp';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetMockDb();
});
afterAll(() => server.close());

const hostToken = async (): Promise<string> => 'test-token';

/** Mount the full authed shell at "/" with an isolated store, so each test starts cache-clean. */
function renderAtRoot() {
  return render(
    <AppProviders store={makeStore()} hostGetToken={hostToken} hostUser={{ name: 'Ada' }}>
      <RequireAuth>
        <MemoryRouter initialEntries={['/']}>
          <WcShell />
        </MemoryRouter>
      </RequireAuth>
    </AppProviders>,
  );
}

const baseCommit: CommitDto = {
  id: 'cw1',
  memberId: 'm1',
  weekStart: '2026-06-08',
  lifecycleState: 'DRAFT',
  submittedAt: null,
  reviewedAt: null,
  items: [
    {
      id: 'it1',
      text: 'Planned task',
      status: 'OPEN',
      supportingOutcomeId: 'so-1',
      chessTier: 'KING',
      carriedFromItemId: null,
    },
  ],
};

function currentWeekReturns(dto: CommitDto): void {
  server.use(
    http.get('*/commits/current', () => HttpResponse.json(dto)),
    http.get(`*/commits/${dto.id}`, () => HttpResponse.json(dto)),
  );
}

describe('WcRoutes navigation (route-wrapper nav callbacks)', () => {
  it('routes to the composer when My Week fires onEdit (DRAFT week)', async () => {
    currentWeekReturns(baseCommit);
    const user = userEvent.setup();
    renderAtRoot();
    await user.click(await screen.findByTestId('edit-continue'));
    await waitFor(() => {
      expect(screen.getByTestId('submit-lock')).toBeInTheDocument();
    });
  });

  it('routes to reconciliation when My Week fires onReconcile (LOCKED week)', async () => {
    const locked: CommitDto = {
      ...baseCommit,
      lifecycleState: 'RECONCILING',
      submittedAt: '2026-06-09T00:00:00Z',
    };
    currentWeekReturns(locked);
    server.use(
      http.get(`*/commits/${locked.id}/reconciliation`, () =>
        HttpResponse.json({ commitId: locked.id, lifecycleState: 'RECONCILING', rows: [] }),
      ),
    );
    const user = userEvent.setup();
    renderAtRoot();
    await user.click(await screen.findByTestId('open-reconcile'));
    await waitFor(() => {
      expect(screen.getByTestId('reconciliation')).toBeInTheDocument();
    });
  });
});
