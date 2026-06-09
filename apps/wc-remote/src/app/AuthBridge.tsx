// apps/wc-remote/src/app/AuthBridge.tsx — the host↔remote auth seam (U17). Yields a single getToken:
// if the HOST injected one (via the WeeklyCommitApp prop / this provider's `hostGetToken`), use it;
// otherwise fall back to the remote's own Auth0 (standalone dev). Registers the chosen getter with
// @wcm/api's tokenProvider so every RTK Query request attaches the Bearer token. Empty-safe: with no
// host token and no configured Auth0 it yields null, so tests/build run WITHOUT live Auth0.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { setTokenGetter, clearTokenGetter } from '@wcm/api';

export interface AuthContextValue {
  /** Resolve a Bearer access token, or null when unauthenticated/unconfigured. */
  getToken: () => Promise<string | null>;
  /** True when an authenticated identity is available. */
  isAuthenticated: boolean;
  /** True while auth is resolving (host or Auth0). */
  isLoading: boolean;
  /** Authenticated user's display name, if known. */
  userName?: string;
  /** Whether the current user is a manager (host-provided role, else false). */
  isManager: boolean;
  /** Trigger interactive sign-in (defers to Auth0 when standalone; host handles when embedded). */
  login: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthBridgeProps {
  children: ReactNode;
  /** Host-injected token getter; when present it WINS over self-Auth0. */
  hostGetToken?: () => Promise<string>;
  /** Host-injected user info (display name, manager role). */
  hostUser?: { name?: string; isManager?: boolean };
}

/**
 * Provides the unified auth context and keeps @wcm/api's token getter in sync. When the host injects
 * a token, self-Auth0 is bypassed entirely (the useAuth0 values are still read but unused for tokens).
 */
export function AuthBridge({
  children,
  hostGetToken,
  hostUser,
}: AuthBridgeProps): JSX.Element {
  const auth0 = useAuth0();

  const value = useMemo<AuthContextValue>(() => {
    if (hostGetToken) {
      return {
        getToken: async () => {
          try {
            return await hostGetToken();
          } catch {
            return null;
          }
        },
        isAuthenticated: true,
        isLoading: false,
        userName: hostUser?.name,
        isManager: Boolean(hostUser?.isManager),
        login: () => undefined,
      };
    }
    return {
      getToken: async () => {
        if (!auth0.isAuthenticated) return null;
        try {
          return await auth0.getAccessTokenSilently();
        } catch {
          return null;
        }
      },
      isAuthenticated: auth0.isAuthenticated,
      isLoading: auth0.isLoading,
      userName: auth0.user?.name,
      isManager: Boolean(
        (auth0.user?.['https://wcm/roles'] as string[] | undefined)?.includes(
          'manager',
        ),
      ),
      login: () => void auth0.loginWithRedirect(),
    };
  }, [hostGetToken, hostUser, auth0]);

  // Register the active getter with the data layer so RTK Query injects the Bearer token.
  useEffect(() => {
    setTokenGetter(value.getToken);
    return () => clearTokenGetter();
  }, [value.getToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Read the unified auth context. Throws if used outside an AuthBridge (developer error). */
export function useWcAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useWcAuth must be used within an <AuthBridge>');
  }
  return ctx;
}
