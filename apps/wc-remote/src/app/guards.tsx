// apps/wc-remote/src/app/guards.tsx — UX route guards for the WC remote (U17). RequireAuth shows the
// auth-resolving skeleton while loading, a clean "Please sign in" panel when unauthenticated (deferring
// the action to the host/Auth0), and the children once authenticated. RequireManager additionally
// gates manager-only screens, showing a non-punitive "not available" panel. Real authorization is
// server-side; these are UX affordances only (brief §6.1).
import type { ReactNode } from 'react';
import { Button } from 'flowbite-react';
import { EmptyState, Skeleton } from '@wcm/ui';
import { useWcAuth } from './AuthBridge';

export interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps): JSX.Element {
  const { isLoading, isAuthenticated, login } = useWcAuth();

  if (isLoading) {
    return (
      <div data-testid="auth-loading" className="mx-auto max-w-2xl p-6">
        <Skeleton lines={4} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div data-testid="auth-required" className="mx-auto max-w-md p-6">
        <EmptyState
          title="Please sign in"
          description="Your session has ended. Sign in to view and edit your weekly commit."
          action={
            <Button color="blue" onClick={login} data-testid="auth-signin">
              Sign in
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}

export interface RequireManagerProps {
  children: ReactNode;
}

export function RequireManager({ children }: RequireManagerProps): JSX.Element {
  const { isManager } = useWcAuth();
  if (!isManager) {
    return (
      <div data-testid="manager-required" className="mx-auto max-w-md p-6">
        <EmptyState
          title="Manager view"
          description="This section is available to managers. If you believe this is an error, contact your administrator."
        />
      </div>
    );
  }
  return <>{children}</>;
}
