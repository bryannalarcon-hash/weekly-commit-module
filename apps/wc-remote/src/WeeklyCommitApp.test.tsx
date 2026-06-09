// apps/wc-remote/src/WeeklyCommitApp.test.tsx — render test for the federated WC entry + its router.
// MSW-backed (real RTK Query). With a host-injected getToken it authenticates and lands on My Week,
// which (no commit yet) shows the "Start your week" empty state and the re-skinned WcShell sub-nav
// (data-testid wc-navigation). With NO token + no Auth0 config it shows the design's standalone
// sign-in screen (auth-required) instead of the feature, and the sub-nav is absent. The Manager tab
// (wc-nav-manager) is hidden for employees and shown for managers.
import { render, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { handlers, resetMockDb } from '@wcm/api';
import { WeeklyCommitApp } from './WeeklyCommitApp';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetMockDb();
});
afterAll(() => server.close());

const hostToken = async (): Promise<string> => 'test-token';

describe('WeeklyCommitApp', () => {
  it('lands on My Week (Start your week) when authenticated via the host', async () => {
    render(<WeeklyCommitApp getToken={hostToken} user={{ name: 'Ada' }} />);
    expect(await screen.findByTestId('start-week')).toBeInTheDocument();
    // The internal sub-nav renders (no host chrome here).
    expect(screen.getByTestId('wc-navigation')).toBeInTheDocument();
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
