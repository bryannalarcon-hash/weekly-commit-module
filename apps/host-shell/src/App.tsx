// apps/host-shell/src/App.tsx — the THIN Module Federation host (U4/FR6). It LAZY-LOADS the WC remote
// (wc/WeeklyCommitApp) live over MF — no SPA fallback — and mounts it under a BrowserRouter so the
// real browser URL drives the remote's internal routes (Cypress can visit /manager/dashboard etc.).
// Auth is owned by the remote: in a hermetic E2E build (VITE_E2E) the remote auto-authenticates from
// X-Debug-Member; otherwise the remote's own Auth0 runs. The host supplies only chrome + the router,
// and an error boundary so a remoteEntry load failure renders a message instead of a blank page.
import {
  Component,
  Suspense,
  lazy,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { BrowserRouter } from 'react-router-dom';

// Live federated import of the remote's exposed entry. Resolves the named export for React.lazy.
const WeeklyCommitApp = lazy(() =>
  import('wc/WeeklyCommitApp').then((m) => ({
    default: m.WeeklyCommitApp ?? m.default,
  })),
);

/** Minimal error boundary so a failed remoteEntry load is a visible message, not a white screen. */
class RemoteErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in the console for debugging a federation/auth failure during E2E.
    console.error('WC remote failed to load', error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-2xl p-6" data-testid="remote-error">
          <h1 className="text-xl font-bold text-red-700">
            The Weekly Commit module failed to load
          </h1>
          <p className="text-gray-600">{this.state.error.message}</p>
        </main>
      );
    }
    return this.props.children;
  }
}

export function App(): JSX.Element {
  return (
    <div data-testid="host-shell">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <span className="text-sm font-semibold tracking-tight text-slate-800">
          Solovis · Weekly Commit
        </span>
      </header>
      <RemoteErrorBoundary>
        <Suspense
          fallback={
            <div className="mx-auto max-w-2xl p-6 text-slate-500" data-testid="host-loading">
              Loading the Weekly Commit module…
            </div>
          }
        >
          <WeeklyCommitApp
            router={(children) => <BrowserRouter>{children}</BrowserRouter>}
          />
        </Suspense>
      </RemoteErrorBoundary>
    </div>
  );
}

export default App;
