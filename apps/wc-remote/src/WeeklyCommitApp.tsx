// apps/wc-remote/src/WeeklyCommitApp.tsx — the federated entry component of the WC remote, exposed to
// the host as './WeeklyCommitApp'. Mounts the app providers (Redux store + empty-safe Auth0 + the
// host↔remote AuthBridge), then the re-skinned WcShell (from @wcm/ui): the slim internal sub-nav
// (brief §5; NO host chrome — the host owns its frame) wrapping the lazy react-router route table
// (WcRoutes) in its max-1240px riseIn content region. Tabs: My Week · History · Strategy · | ·
// Manager (manager-only, unreviewed badge, 2nd sub-row Review Queue · Team Dashboard) · Settings.
// WcShell here is the router-aware adapter: it maps the current pathname → the shell's active group /
// manager sub-row, reads isManager + the live unreviewed count, and wires the shell's navigate
// callbacks back to react-router. Props are optional so the remote also runs standalone; the host
// injects getToken + user when embedded. The router defaults to MemoryRouter unless a host passes one
// in (keeps the remote from fighting the host's history when embedded / under test). In the hermetic
// demo build ONLY (isE2e(), KTD13) the authenticated region also mounts the CB-2 PersonaPill — the
// floating bottom-right demo account switcher; never rendered on the real Auth0/host path.
import type { ReactNode } from 'react';
import {
  MemoryRouter,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  WcShell as WcShellNav,
  type WcManagerSubId,
  type WcNavId,
} from '@wcm/ui';
import { useGetReviewQueueQuery } from '@wcm/api';
import { AppProviders } from './app/AppProviders';
import { RequireAuth } from './app/guards';
import { useWcAuth } from './app/AuthBridge';
import { WcRoutes } from './app/routes';
import { isE2e } from './app/e2eAuth';
import { PersonaPill } from './app/PersonaPill';

export interface WeeklyCommitAppProps {
  /** Optional access-token provider injected by the host shell (absent when standalone). */
  getToken?: () => Promise<string>;
  /** Optional authenticated user info injected by the host shell. */
  user?: { name?: string; isManager?: boolean };
  /** Optional Router wrapper (host supplies one when embedded; defaults to MemoryRouter). */
  router?: (children: ReactNode) => JSX.Element;
}

/** Collapse the router pathname to the shell's top-level active group. */
function activeGroupFor(pathname: string): WcNavId {
  if (pathname.startsWith('/manager')) return 'manager';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/strategy')) return 'strategy';
  if (pathname.startsWith('/settings')) return 'settings';
  // '/', '/edit', '/reconcile' all belong to My Week.
  return 'myweek';
}

/** Which manager second sub-row item is active for a /manager* pathname. */
function managerSubFor(pathname: string): WcManagerSubId {
  return pathname.startsWith('/manager/dashboard') ? 'mgr-dashboard' : 'mgr-queue';
}

/** Map a shell top-level group id to its route path. */
const GROUP_PATH: Record<WcNavId, string> = {
  myweek: '/',
  history: '/history',
  strategy: '/strategy',
  manager: '/manager',
  settings: '/settings',
};

/** Map a manager sub-row id to its route path. */
const MGR_SUB_PATH: Record<WcManagerSubId, string> = {
  'mgr-queue': '/manager',
  'mgr-dashboard': '/manager/dashboard',
};

/**
 * The live unreviewed count for the Manager tab badge: reports submitted (LOCKED) this week that the
 * manager has not yet reviewed. Derived from the same review-queue query the queue screen uses, so the
 * badge and the queue agree. Skipped entirely for non-managers (no request, count is 0).
 */
function useUnreviewedCount(isManager: boolean): number {
  const { data } = useGetReviewQueueQuery(undefined, { skip: !isManager });
  if (!isManager || !data) return 0;
  return data.content.filter((r) => r.lifecycleState === 'LOCKED' && r.reviewState !== 'REVIEWED')
    .length;
}

/**
 * The authenticated content region: the re-skinned WcShell sub-nav synced to the router, wrapping the
 * active lazy route in its content area. Exported (router-aware, prop-less) so the route/navigation
 * integration tests can mount it directly inside their own MemoryRouter.
 */
export function WcShell(): JSX.Element {
  const { isManager } = useWcAuth();
  const location = useLocation();
  const nav = useNavigate();
  const active = activeGroupFor(location.pathname);
  const managerSub = managerSubFor(location.pathname);
  const unreviewedCount = useUnreviewedCount(isManager);

  return (
    <WcShellNav
      active={active}
      managerSub={managerSub}
      isManager={isManager}
      unreviewedCount={unreviewedCount}
      onNavigate={(id) => nav(GROUP_PATH[id])}
      onNavigateManagerSub={(id) => nav(MGR_SUB_PATH[id])}
    >
      <WcRoutes />
    </WcShellNav>
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
      <RequireAuth>
        {wrap(<WcShell />)}
        {/* CB-2 demo account switcher — hermetic demo build only (KTD13), and only once authed
            (RequireAuth children render only when authenticated). */}
        {isE2e() ? <PersonaPill /> : null}
      </RequireAuth>
    </AppProviders>
  );
}

export default WeeklyCommitApp;
