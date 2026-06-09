// apps/wc-remote/src/WeeklyCommitApp.tsx — the federated entry component of the WC remote, exposed to
// the host as './WeeklyCommitApp'. Mounts the app providers (Redux store + empty-safe Auth0 + the
// host↔remote AuthBridge), then the WcShell: the internal sub-nav (brief §5; NO host chrome) wired to
// the lazy react-router route table (WcRoutes). Props are optional so the remote also runs standalone;
// the host injects getToken + user when embedded. The router defaults to MemoryRouter unless a host
// passes one in (keeps the remote from fighting the host's history when embedded / under test).
import type { ReactNode } from 'react';
import {
  MemoryRouter,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { WcNavigation, DEFAULT_WC_NAV } from '@wcm/ui';
import { AppProviders } from './app/AppProviders';
import { RequireAuth } from './app/guards';
import { useWcAuth } from './app/AuthBridge';
import { WcRoutes } from './app/routes';

export interface WeeklyCommitAppProps {
  /** Optional access-token provider injected by the host shell (absent when standalone). */
  getToken?: () => Promise<string>;
  /** Optional authenticated user info injected by the host shell. */
  user?: { name?: string; isManager?: boolean };
  /** Optional Router wrapper (host supplies one when embedded; defaults to MemoryRouter). */
  router?: (children: ReactNode) => JSX.Element;
}

/** The internal sub-nav (brief §5) synced to the router; plus the secondary manager nav. */
function WcSubNav(): JSX.Element {
  const { isManager } = useWcAuth();
  const location = useLocation();
  const nav = useNavigate();
  const onManager = location.pathname.startsWith('/manager');

  return (
    <>
      <WcNavigation
        activePath={
          // Collapse deep paths back to their top-level section for the active highlight.
          location.pathname.startsWith('/manager')
            ? '/manager'
            : location.pathname.startsWith('/history')
              ? '/history'
              : location.pathname.startsWith('/edit') || location.pathname.startsWith('/reconcile')
                ? '/'
                : location.pathname
        }
        isManager={isManager}
        onNavigate={(to) => nav(to)}
        items={DEFAULT_WC_NAV}
        className="mb-2"
      />
      {onManager && (
        <nav
          aria-label="Manager sections"
          data-testid="manager-subnav"
          className="mb-6 flex gap-2 text-sm"
        >
          <button
            type="button"
            onClick={() => nav('/manager')}
            data-testid="subnav-queue"
            aria-current={location.pathname === '/manager' ? 'page' : undefined}
            className={
              location.pathname === '/manager'
                ? 'font-semibold text-primary-800'
                : 'text-slate-500 hover:text-slate-700'
            }
          >
            Review queue
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={() => nav('/manager/dashboard')}
            data-testid="subnav-dashboard"
            aria-current={location.pathname === '/manager/dashboard' ? 'page' : undefined}
            className={
              location.pathname === '/manager/dashboard'
                ? 'font-semibold text-primary-800'
                : 'text-slate-500 hover:text-slate-700'
            }
          >
            Team dashboard
          </button>
        </nav>
      )}
    </>
  );
}

/** The authenticated content region: sub-nav + the active lazy route. */
export function WcShell(): JSX.Element {
  return (
    <main className="mx-auto max-w-5xl p-4">
      <WcSubNav />
      <WcRoutes />
    </main>
  );
}

export function WeeklyCommitApp({
  getToken,
  user,
  router,
}: WeeklyCommitAppProps): JSX.Element {
  const wrap = router ?? ((children: ReactNode) => <MemoryRouter>{children}</MemoryRouter>);
  return (
    <AppProviders hostGetToken={getToken} hostUser={user}>
      <RequireAuth>{wrap(<WcShell />)}</RequireAuth>
    </AppProviders>
  );
}

export default WeeklyCommitApp;
