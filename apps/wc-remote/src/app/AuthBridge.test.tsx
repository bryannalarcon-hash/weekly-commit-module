// apps/wc-remote/src/app/AuthBridge.test.tsx — proves the auth seam works WITHOUT live Auth0: a
// host-injected getToken wins and feeds @wcm/api's tokenProvider; with no host token and unconfigured
// Auth0 the context is empty-safe (unauthenticated, resolved); and the route guards render the right
// UX states (loading skeleton, please-sign-in, manager gate). Auth0 is never really called.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken } from '@wcm/api';
import { AuthProvider } from './AuthProvider';
import { AuthBridge, useWcAuth } from './AuthBridge';
import { RequireAuth, RequireManager } from './guards';

// Mockable Auth0 hook so the STANDALONE (self-Auth0) branch can be exercised without a live tenant.
const auth0State = vi.hoisted(() => ({
  current: {
    isAuthenticated: false,
    isLoading: false,
    user: undefined as Record<string, unknown> | undefined,
    getAccessTokenSilently: vi.fn(async () => 'auth0-token'),
    loginWithRedirect: vi.fn(),
  },
}));
vi.mock('@auth0/auth0-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@auth0/auth0-react')>();
  return { ...actual, useAuth0: () => auth0State.current };
});

function Probe(): JSX.Element {
  const { isAuthenticated, isLoading, userName, isManager } = useWcAuth();
  return (
    <div>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="name">{userName ?? ''}</span>
      <span data-testid="manager">{String(isManager)}</span>
    </div>
  );
}

const NO_AUTH0 = { domain: undefined, clientId: undefined };

describe('AuthBridge', () => {
  it('uses a host-injected getToken and registers it with @wcm/api', async () => {
    const hostGetToken = async (): Promise<string> => 'host-token-xyz';
    render(
      <AuthProvider config={NO_AUTH0}>
        <AuthBridge hostGetToken={hostGetToken} hostUser={{ name: 'Diego', isManager: true }}>
          <Probe />
        </AuthBridge>
      </AuthProvider>,
    );
    expect(screen.getByTestId('authed')).toHaveTextContent('true');
    expect(screen.getByTestId('name')).toHaveTextContent('Diego');
    expect(screen.getByTestId('manager')).toHaveTextContent('true');
    // The token provider now yields the host token (no real Auth0 involved).
    await waitFor(async () => {
      expect(await getAccessToken()).toBe('host-token-xyz');
    });
  });

  it('is empty-safe (unauthenticated, resolved) with no host token and no Auth0 config', () => {
    render(
      <AuthProvider config={NO_AUTH0}>
        <AuthBridge>
          <Probe />
        </AuthBridge>
      </AuthProvider>,
    );
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('falls back to self-Auth0 standalone: derives manager role + token from the Auth0 user', async () => {
    auth0State.current = {
      isAuthenticated: true,
      isLoading: false,
      user: { name: 'Standalone Sam', 'https://wcm/roles': ['manager'] },
      getAccessTokenSilently: vi.fn(async () => 'auth0-token'),
      loginWithRedirect: vi.fn(),
    };
    render(
      <AuthProvider config={NO_AUTH0}>
        <AuthBridge>
          <Probe />
        </AuthBridge>
      </AuthProvider>,
    );
    expect(screen.getByTestId('authed')).toHaveTextContent('true');
    expect(screen.getByTestId('name')).toHaveTextContent('Standalone Sam');
    // isManager derived from the Auth0 roles claim.
    expect(screen.getByTestId('manager')).toHaveTextContent('true');
    // The token provider yields the silently-fetched Auth0 token (standalone path).
    await waitFor(async () => {
      expect(await getAccessToken()).toBe('auth0-token');
    });
  });

  it('invokes Auth0 loginWithRedirect from the sign-in action when standalone + unauthenticated', async () => {
    const loginWithRedirect = vi.fn();
    auth0State.current = {
      isAuthenticated: false,
      isLoading: false,
      user: undefined,
      getAccessTokenSilently: vi.fn(async () => 'auth0-token'),
      loginWithRedirect,
    };
    const user = userEvent.setup();
    render(
      <AuthProvider config={NO_AUTH0}>
        <AuthBridge>
          <RequireAuth>
            <div>secret</div>
          </RequireAuth>
        </AuthBridge>
      </AuthProvider>,
    );
    await user.click(screen.getByTestId('auth-signin'));
    expect(loginWithRedirect).toHaveBeenCalledOnce();
  });
});

// Reset the mocked Auth0 state so the host-token-path tests above stay isolated.
afterEach(() => {
  auth0State.current = {
    isAuthenticated: false,
    isLoading: false,
    user: undefined,
    getAccessTokenSilently: vi.fn(async () => 'auth0-token'),
    loginWithRedirect: vi.fn(),
  };
});

describe('route guards', () => {
  it('shows the please-sign-in panel when unauthenticated', () => {
    render(
      <AuthProvider config={NO_AUTH0}>
        <AuthBridge>
          <RequireAuth>
            <div>secret</div>
          </RequireAuth>
        </AuthBridge>
      </AuthProvider>,
    );
    expect(screen.getByTestId('auth-required')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders children when authenticated via the host token', () => {
    render(
      <AuthProvider config={NO_AUTH0}>
        <AuthBridge hostGetToken={async () => 't'} hostUser={{ name: 'A' }}>
          <RequireAuth>
            <div>secret</div>
          </RequireAuth>
        </AuthBridge>
      </AuthProvider>,
    );
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('gates manager-only content for non-managers', () => {
    render(
      <AuthProvider config={NO_AUTH0}>
        <AuthBridge hostGetToken={async () => 't'} hostUser={{ name: 'A', isManager: false }}>
          <RequireManager>
            <div>team dashboard</div>
          </RequireManager>
        </AuthBridge>
      </AuthProvider>,
    );
    expect(screen.getByTestId('manager-required')).toBeInTheDocument();
    expect(screen.queryByText('team dashboard')).not.toBeInTheDocument();
  });

  it('shows manager content for managers', () => {
    render(
      <AuthProvider config={NO_AUTH0}>
        <AuthBridge hostGetToken={async () => 't'} hostUser={{ name: 'A', isManager: true }}>
          <RequireManager>
            <div>team dashboard</div>
          </RequireManager>
        </AuthBridge>
      </AuthProvider>,
    );
    expect(screen.getByText('team dashboard')).toBeInTheDocument();
  });
});
