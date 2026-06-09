// apps/wc-remote/src/WeeklyCommitApp.test.tsx — render test for the federated WC entry + its router.
// MSW-backed (real RTK Query). With a host-injected getToken it authenticates and lands on My Week,
// which (no commit yet) shows the "Start your week" empty state and the internal sub-nav. With NO token
// + no Auth0 config it shows the "please sign in" panel instead of the feature.
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

  it('shows the sign-in panel when standalone without auth', () => {
    render(<WeeklyCommitApp />);
    expect(screen.getByTestId('auth-required')).toBeInTheDocument();
    expect(screen.queryByTestId('wc-navigation')).not.toBeInTheDocument();
  });

  it('hides the manager nav item for non-managers and shows it for managers', async () => {
    const { unmount } = render(<WeeklyCommitApp getToken={hostToken} user={{ name: 'Ada' }} />);
    await screen.findByTestId('start-week');
    expect(screen.queryByTestId('wc-nav-/manager')).not.toBeInTheDocument();
    unmount();

    render(<WeeklyCommitApp getToken={hostToken} user={{ name: 'Mira', isManager: true }} />);
    await waitFor(() => {
      expect(screen.getByTestId('wc-nav-/manager')).toBeInTheDocument();
    });
  });
});
