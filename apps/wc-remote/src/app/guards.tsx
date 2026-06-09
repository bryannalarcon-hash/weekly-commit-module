// apps/wc-remote/src/app/guards.tsx — UX route guards for the WC remote (U17), re-skinned to the WCM
// design (prototype/wcm/page-auth.jsx). RequireAuth shows the auth-resolving skeleton while loading
// and, when unauthenticated, the design's standalone "Plan your week" sign-in screen (floating orbs +
// Continue with Microsoft / SSO). Real sign-in is host/Auth0-owned — both buttons just call login()
// (defers to Auth0 when standalone, to the host when embedded). RequireManager gates manager-only
// screens with a non-punitive "Manager view" EmptyState. Real authorization is server-side; these are
// UX affordances only (brief §6.1). Preserves testids: auth-loading, auth-required, auth-signin,
// manager-required.
import type { ReactNode } from 'react';
import { EmptyState, Icon, Skeleton } from '@wcm/ui';
import { useWcAuth } from './AuthBridge';

export interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps): JSX.Element {
  const { isLoading, isAuthenticated, login } = useWcAuth();

  // Authenticating / redirect skeleton — a layout-preserving panel so the hand-off to the host or
  // Auth0 never flashes blank chrome (CLS-safe).
  if (isLoading) {
    return (
      <div
        data-testid="auth-loading"
        style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}
      >
        <div className="panel" style={{ width: 392, maxWidth: '94vw', padding: '30px 28px' }}>
          <Skeleton lines={4} />
        </div>
      </div>
    );
  }

  // Standalone / unauthorized: the design login screen. Real sign-in is deferred to the host/Auth0.
  if (!isAuthenticated) {
    return (
      <div
        data-testid="auth-required"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          zIndex: 1,
          padding: 20,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div className="float-orb" style={{ left: '12%', top: '18%', background: 'var(--signal)' }} />
          <div
            className="float-orb"
            style={{ right: '10%', top: '26%', background: 'var(--cyan)', animationDelay: '-3s' }}
          />
          <div
            className="float-orb"
            style={{ left: '26%', bottom: '12%', background: 'var(--violet)', animationDelay: '-6s' }}
          />
        </div>

        <div style={{ width: 392, maxWidth: '94vw', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              justifyContent: 'center',
              marginBottom: 26,
            }}
          >
            <span
              className="badge-pop"
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--r-md)',
                background: 'var(--signal)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 8px 24px -8px var(--signal)',
              }}
            >
              <span className="mono" style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                WC
              </span>
            </span>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700, fontSize: 17, whiteSpace: 'nowrap' }}>Weekly Commit</div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.16em',
                  color: 'var(--ink-low)',
                  textTransform: 'uppercase',
                }}
              >
                Solovis
              </div>
            </div>
          </div>

          <div
            className="panel"
            style={{ padding: '30px 28px', boxShadow: 'var(--shadow-pop)', animation: 'riseIn .4s ease both' }}
          >
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, textAlign: 'center' }}>Plan your week</h1>
            <p
              style={{
                fontSize: 13.5,
                color: 'var(--ink-low)',
                textAlign: 'center',
                margin: '8px 0 24px',
                lineHeight: 1.5,
              }}
            >
              Sign in to write your Weekly Commit and align it to strategy.
            </p>
            <button
              type="button"
              className="btn btn-primary lift"
              data-testid="auth-signin"
              onClick={login}
              style={{ width: '100%', justifyContent: 'center', padding: 12, fontSize: 14 }}
            >
              <Icon.mail size={16} aria-hidden /> Continue with Microsoft
            </button>
            <button
              type="button"
              className="btn btn-ghost lift"
              data-testid="auth-signin-sso"
              onClick={login}
              style={{ width: '100%', justifyContent: 'center', padding: 12, marginTop: 10, fontSize: 14 }}
            >
              <Icon.lock size={15} aria-hidden /> Single sign-on (SSO)
            </button>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                justifyContent: 'center',
                marginTop: 22,
                fontSize: 11,
                color: 'var(--ink-faint)',
              }}
            >
              <Icon.lock size={12} aria-hidden /> Secured by Auth0 · Authorization Code + PKCE
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--ink-faint)' }}>
            You'll be redirected to your identity provider.
          </div>
        </div>
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
          icon="mgr"
          title="Manager view"
          description="This section is available to managers. If you believe this is an error, contact your administrator."
        />
      </div>
    );
  }
  return <>{children}</>;
}
