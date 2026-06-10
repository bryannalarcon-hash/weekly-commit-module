// apps/wc-remote/src/app/AuthProvider.tsx — wraps @auth0/auth0-react's Auth0Provider, configured from
// VITE_AUTH0_* (U17). EMPTY-SAFE: when no domain/clientId is set (tests, CI build, host-embedded mode
// where the host owns auth) it renders a stub Auth0Context with isLoading:false / isAuthenticated:false
// instead of the real provider, so the remote builds and tests run WITHOUT a live Auth0 tenant and
// never spins forever. HERMETIC-SAFE: an E2E build (VITE_E2E) ALWAYS gets the stub — auth there is
// the X-Debug-Member seam (KTD13), and booting the real Auth0 client from a developer .env crashes
// auth0-spa-js on the suite's insecure host.docker.internal origin. Pairs with AuthBridge.
import type { ReactNode } from 'react';
import {
  Auth0Context,
  Auth0Provider,
  initialContext,
  type Auth0ContextInterface,
  type User,
} from '@auth0/auth0-react';
import { isE2e } from './e2eAuth';

/** Read the Auth0 config from Vite env (all optional → empty-safe). */
export interface Auth0Config {
  domain?: string;
  clientId?: string;
  audience?: string;
  scope?: string;
}

function readEnvConfig(): Auth0Config {
  const env =
    (typeof import.meta !== 'undefined' && import.meta.env) ||
    ({} as ImportMetaEnv);
  return {
    domain: env.VITE_AUTH0_DOMAIN,
    clientId: env.VITE_AUTH0_CLIENT_ID,
    audience: env.VITE_AUTH0_AUDIENCE,
    scope: env.VITE_AUTH0_SCOPE,
  };
}

/** A value is a real config, not an unset env or a scaffold placeholder ("your-tenant…", "your_…"). */
function isReal(value: string | undefined): boolean {
  if (!value) return false;
  return !/^your[-_]/i.test(value.trim());
}

/**
 * True only when both the domain and clientId are present AND not scaffold placeholders. The repo's
 * `.env` ships placeholder VITE_AUTH0_* values; treating those as "not configured" keeps tests/build
 * empty-safe (the stub context is used) and prevents the remote from spinning on a fake tenant.
 */
export function isAuth0Configured(config: Auth0Config = readEnvConfig()): boolean {
  return isReal(config.domain) && isReal(config.clientId);
}

/** The empty-safe stub context: resolved (not loading), unauthenticated, no tokens. */
const STUB_CONTEXT: Auth0ContextInterface<User> = {
  ...initialContext,
  isLoading: false,
};

export interface AuthProviderProps {
  children: ReactNode;
  /** Test/override hook: force the config rather than reading env. */
  config?: Auth0Config;
}

export function AuthProvider({ children, config }: AuthProviderProps): JSX.Element {
  const cfg = config ?? readEnvConfig();

  if (isE2e() || !isAuth0Configured(cfg)) {
    // Stub when no live Auth0 is configured (host owns auth, or tests) — and ALWAYS in a hermetic
    // E2E build, where auth is the X-Debug-Member seam: a real .env tenant must not boot
    // auth0-spa-js there (it throws on the suite's insecure host.docker.internal origin).
    return (
      <Auth0Context.Provider value={STUB_CONTEXT}>
        {children}
      </Auth0Context.Provider>
    );
  }

  return (
    <Auth0Provider
      domain={cfg.domain as string}
      clientId={cfg.clientId as string}
      authorizationParams={{
        redirect_uri:
          typeof window !== 'undefined' ? window.location.origin : undefined,
        audience: cfg.audience,
        scope: cfg.scope,
      }}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
}
