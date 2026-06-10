// apps/wc-remote/src/app/routes.test.tsx — integration coverage of the WC remote's internal route
// table (U17/§5). Mounts the full WeeklyCommitApp (real RTK Query via MSW) as a MANAGER, driving a
// MemoryRouter to each path so every lazy route + its thin router-wrapper (which bridges
// useNavigate/useParams to the screens' callbacks) actually mounts. Covers the employee routes, the
// manager-gated routes (queue/detail/dashboard via RequireManager), the manager sub-nav branch in
// WcShell, and the catch-all redirect. Proves the route map is wired, not just that screens render
// in isolation. (Review Detail → reconciliation navigation lives in routesNavigation.test.tsx, which
// injects a fresh store per test to avoid the singleton-store cache bleed that data-driven nav needs.)
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { handlers, resetMockDb } from '@wcm/api';
import type { ReactNode } from 'react';
import { WeeklyCommitApp } from '../WeeklyCommitApp';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetMockDb();
});
afterAll(() => server.close());

const hostToken = async (): Promise<string> => 'test-token';
const manager = { name: 'Mira', isManager: true } as const;

function routerAt(path: string) {
  return (children: ReactNode): JSX.Element => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  );
}

function renderAt(path: string) {
  return render(
    <WeeklyCommitApp getToken={hostToken} user={manager} router={routerAt(path)} />,
  );
}

describe('WcRoutes (internal route table)', () => {
  it('mounts My Week at "/" with the manager sub-nav available', async () => {
    renderAt('/');
    expect(await screen.findByTestId('start-week')).toBeInTheDocument();
    // Manager → the top-level Manager tab is present in the re-skinned WcShell sub-nav. findBy (not
    // getBy): the shell nav and the My Week body settle on independent renders, so under parallel
    // load the tab can lag start-week by a tick.
    expect(await screen.findByTestId('wc-nav-manager')).toBeInTheDocument();
  });

  it('mounts the History route', async () => {
    renderAt('/history');
    // CommitHistory renders its own region once the (empty) history list resolves.
    await waitFor(() => {
      expect(screen.getByTestId('wc-navigation')).toBeInTheDocument();
    });
  });

  it('mounts the Strategy (RCDO browser) route', async () => {
    renderAt('/strategy');
    expect(await screen.findByTestId('rcdo-browser')).toBeInTheDocument();
  });

  it('mounts the Settings route', async () => {
    renderAt('/settings');
    await waitFor(() => {
      expect(screen.getByTestId('wc-navigation')).toBeInTheDocument();
    });
  });

  it('mounts the manager Review Queue (RequireManager passes) with the manager sub-row', async () => {
    renderAt('/manager');
    // The manager 2nd sub-row (Review Queue / Team Dashboard) renders only on /manager* + for managers.
    expect(await screen.findByTestId('wc-manager-subnav')).toBeInTheDocument();
    expect(screen.getByTestId('wc-nav-mgr-queue')).toBeInTheDocument();
    expect(screen.getByTestId('wc-nav-mgr-dashboard')).toBeInTheDocument();
  });

  it('mounts the manager Dashboard route', async () => {
    renderAt('/manager/dashboard');
    await waitFor(() => {
      expect(screen.getByTestId('wc-manager-subnav')).toBeInTheDocument();
    });
    // The Team Dashboard sub-row item is the active one on /manager/dashboard.
    expect(screen.getByTestId('wc-nav-mgr-dashboard')).toHaveAttribute('aria-current', 'true');
  });

  it('mounts the manager Review Detail route', async () => {
    renderAt('/manager/review/some-commit-id');
    await waitFor(() => {
      expect(screen.getByTestId('wc-manager-subnav')).toBeInTheDocument();
    });
  });

  it('redirects an unknown path back to My Week via the catch-all', async () => {
    renderAt('/does-not-exist');
    expect(await screen.findByTestId('start-week')).toBeInTheDocument();
  });

  it('gates manager routes for a non-manager (RequireManager shows the not-available panel)', async () => {
    render(
      <WeeklyCommitApp
        getToken={hostToken}
        user={{ name: 'Ada', isManager: false }}
        router={routerAt('/manager')}
      />,
    );
    expect(await screen.findByTestId('manager-required')).toBeInTheDocument();
  });
});
