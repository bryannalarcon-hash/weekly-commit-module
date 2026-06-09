// apps/wc-remote/src/app/AppProviders.tsx — composes the remote's app-level providers in order:
// Redux (commitApi store) → Auth0 (empty-safe) → AuthBridge (host getToken vs self-Auth0). Both the
// federated WeeklyCommitApp and tests mount through this so the data + auth seams are wired once.
import type { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { makeStore, type AppStore } from '@wcm/api';
import { AuthProvider, type Auth0Config } from './AuthProvider';
import { AuthBridge } from './AuthBridge';

export interface AppProvidersProps {
  children: ReactNode;
  /** Host-injected token getter (wins over self-Auth0 when present). */
  hostGetToken?: () => Promise<string>;
  /** Host-injected user info (display name, manager role). */
  hostUser?: { name?: string; isManager?: boolean };
  /** Optional pre-built store (tests inject an isolated one); defaults to a fresh store. */
  store?: AppStore;
  /** Optional Auth0 config override (tests/standalone); defaults to env. */
  auth0Config?: Auth0Config;
}

export function AppProviders({
  children,
  hostGetToken,
  hostUser,
  store,
  auth0Config,
}: AppProvidersProps): JSX.Element {
  // A stable default store per mount when none is injected.
  const resolvedStore = store ?? defaultStore();
  return (
    <ReduxProvider store={resolvedStore}>
      <AuthProvider config={auth0Config}>
        <AuthBridge hostGetToken={hostGetToken} hostUser={hostUser}>
          {children}
        </AuthBridge>
      </AuthProvider>
    </ReduxProvider>
  );
}

let singleton: AppStore | undefined;
/** Lazily create one store for standalone runtime (tests pass their own). */
function defaultStore(): AppStore {
  if (!singleton) singleton = makeStore();
  return singleton;
}
