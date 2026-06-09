// apps/wc-remote/src/WeeklyCommitApp.test.tsx — render test for the federated WC entry + its router.
// MSW-backed (real RTK Query). With a host-injected getToken it authenticates and lands on My Week,
// which (no commit yet) shows the "Start your week" empty state and the re-skinned WcShell sub-nav
// (data-testid wc-navigation). With NO token + no Auth0 config it shows the design's standalone
// sign-in screen (auth-required) instead of the feature, and the sub-nav is absent. The Manager tab
// (wc-nav-manager) is hidden for employees and shown for managers. CB-2: the demo PersonaPill mounts
// ONLY in the hermetic demo build (isE2e mocked on, same pattern as the AuthBridge/e2eAuth tests) —
// it must be ABSENT on the real host/Auth0 path (KTD13).
import { render, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { handlers, resetMockDb } from '@wcm/api';
import { WeeklyCommitApp } from './WeeklyCommitApp';

// Controllable isE2e (the VITE_E2E flag is environment-driven); the rest of e2eAuth stays REAL so
// the hermetic identity resolves from localStorage exactly as in an E2E build.
const e2eState = vi.hoisted(() => ({ enabled: false }));
vi.mock('./app/e2eAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./app/e2eAuth')>();
  return { ...actual, isE2e: () => e2eState.enabled };
});

const server = setupServer(...handlers);
beforeAll(() => {
  // HERMETIC: the developer .env now carries a REAL Auth0 tenant (provisioned demo accounts), which
  // import.meta.env leaks into Vitest — that would mount the real Auth0Provider (isLoading: true)
  // instead of AuthProvider's resolved stub and hang the standalone sign-in assertions. Blank the
  // config so tests behave identically with or without a local tenant.
  vi.stubEnv('VITE_AUTH0_DOMAIN', '');
  vi.stubEnv('VITE_AUTH0_CLIENT_ID', '');
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => {
  server.resetHandlers();
  resetMockDb();
  e2eState.enabled = false;
  window.localStorage.clear();
});
afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});

const hostToken = async (): Promise<string> => 'test-token';

describe('WeeklyCommitApp', () => {
  it('lands on My Week (Start your week) when authenticated via the host', async () => {
    render(<WeeklyCommitApp getToken={hostToken} user={{ name: 'Ada' }} />);
    expect(await screen.findByTestId('start-week')).toBeInTheDocument();
    // The internal sub-nav renders (no host chrome here).
    expect(screen.getByTestId('wc-navigation')).toBeInTheDocument();
    // KTD13: the demo persona switcher NEVER mounts on the real host/Auth0 path.
    expect(screen.queryByTestId('persona-pill')).not.toBeInTheDocument();
  });

  it('mounts the demo PersonaPill when the hermetic demo build is authenticated (e2e only)', async () => {
    e2eState.enabled = true;
    window.localStorage.setItem('wcm.e2e.member', 'diego');
    render(<WeeklyCommitApp />); // no host token — the hermetic seam auto-authenticates
    expect(await screen.findByTestId('persona-pill')).toBeInTheDocument();
    expect(screen.getByTestId('persona-pill')).toHaveTextContent('Diego');
    // Authenticated chrome (not the sign-in screen).
    expect(screen.queryByTestId('auth-required')).not.toBeInTheDocument();
  });

  it('shows the standalone sign-in screen when standalone without auth', () => {
    render(<WeeklyCommitApp />);
    // The design login screen (Plan your week) with the Continue-with-Microsoft sign-in action.
    expect(screen.getByTestId('auth-required')).toBeInTheDocument();
    expect(screen.getByText('Plan your week')).toBeInTheDocument();
    expect(screen.getByTestId('auth-signin')).toBeInTheDocument();
    // No feature sub-nav until authenticated.
    expect(screen.queryByTestId('wc-navigation')).not.toBeInTheDocument();
  });

  it('surfaces the login screen + demo bypass when the hermetic build is SIGNED OUT, and a bypass click signs in', async () => {
    // Regression for the CB-2 review blocker: the bypass was unreachable because the e2e branch
    // auto-authenticated unconditionally. The signed-out flag must surface the real sign-in screen
    // WITH the demo personas, and a persona click must clear the flag (the sign-in) + reload.
    e2eState.enabled = true;
    window.localStorage.setItem('wcm.e2e.member', 'diego');
    window.localStorage.setItem('wcm.e2e.signedOut', 'true');
    const realLocation = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...realLocation, search: '', assign },
    });
    try {
      render(<WeeklyCommitApp />);
      // The hermetic signed-out state shows the standalone login screen…
      expect(await screen.findByTestId('auth-required')).toBeInTheDocument();
      // …WITH the demo bypass (this is the CB-2 verbatim ask), and no pill while signed out.
      expect(screen.getByTestId('demo-bypass')).toBeInTheDocument();
      expect(screen.queryByTestId('persona-pill')).not.toBeInTheDocument();
      // Clicking a persona clears the signed-out flag (the sign-in) and hard-reloads.
      screen.getByTestId('demo-login-priya').click();
      expect(window.localStorage.getItem('wcm.e2e.signedOut')).toBeNull();
      expect(window.localStorage.getItem('wcm.e2e.member')).toBe('priya');
      expect(assign).toHaveBeenCalledWith('/');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: realLocation,
      });
    }
  });

  it('hides the Manager tab for non-managers and shows it for managers', async () => {
    const { unmount } = render(<WeeklyCommitApp getToken={hostToken} user={{ name: 'Ada' }} />);
    await screen.findByTestId('start-week');
    expect(screen.queryByTestId('wc-nav-manager')).not.toBeInTheDocument();
    unmount();

    render(<WeeklyCommitApp getToken={hostToken} user={{ name: 'Mira', isManager: true }} />);
    await waitFor(() => {
      expect(screen.getByTestId('wc-nav-manager')).toBeInTheDocument();
    });
  });
});
