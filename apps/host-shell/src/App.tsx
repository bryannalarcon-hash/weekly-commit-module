// apps/host-shell/src/App.tsx — the THIN Module Federation host (U4/FR6). It LAZY-LOADS the WC remote
// (wc/WeeklyCommitApp) live over MF — no SPA fallback — and mounts it under a BrowserRouter so the
// real browser URL drives the remote's internal routes (Cypress can visit /manager/dashboard etc.).
// It ALSO demos the remote's second exposed surface — wc/WeeklyCommitWidget, the self-contained
// dashboard tile — on a host-owned `/dashboard` page: the host renders its own chrome around the
// federated widget and wires the widget's onOpen(route) → real browser navigation into the full
// module. The demo path is gated on window.location so the module-mount path (and its remote-owned
// BrowserRouter) is byte-for-byte unchanged for every non-demo URL.
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

// Live federated import of the remote's second exposed surface: the dashboard widget tile.
const WeeklyCommitWidget = lazy(() =>
  import('wc/WeeklyCommitWidget').then((m) => ({
    default: m.WeeklyCommitWidget ?? m.default,
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

/** The full federated module — the remote owns its router (host passes a BrowserRouter wrapper). */
function ModuleView(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div
          className="mx-auto max-w-2xl p-6 text-slate-500"
          data-testid="host-loading"
        >
          Loading the Weekly Commit module…
        </div>
      }
    >
      <WeeklyCommitApp
        router={(children) => <BrowserRouter>{children}</BrowserRouter>}
      />
    </Suspense>
  );
}

/**
 * A host-owned dashboard DEMO that embeds the federated widget tile (wc/WeeklyCommitWidget). Proves the
 * second MF expose: the host renders its own chrome and lets the self-contained widget own its data,
 * wiring the widget's onOpen(route) back to real browser navigation so opening the tile lands on the
 * full module (which then owns its own router). No host BrowserRouter here — the widget needs none.
 */
export function DashboardDemo(): JSX.Element {
  const open = (route: string): void => {
    // Hand the URL to the module path; the module's own BrowserRouter takes over from there.
    window.location.assign(route === 'edit' ? '/?open=edit' : '/');
  };
  return (
    <main className="mx-auto max-w-5xl p-6" data-testid="host-dashboard">
      <h1 className="mb-4 text-lg font-bold tracking-tight text-slate-800">
        My Dashboard
      </h1>
      <div className="grid gap-4 md:grid-cols-[minmax(0,420px)_1fr]">
        <Suspense
          fallback={
            <div className="text-slate-500" data-testid="host-widget-loading">
              Loading widget…
            </div>
          }
        >
          <WeeklyCommitWidget onOpen={open} variant="card" />
        </Suspense>
        <p className="self-center text-sm text-slate-500">
          The bordered card is the live remote — its styles are isolated; the
          host renders the rest.
        </p>
      </div>
    </main>
  );
}

/** True when the host should render its widget-demo dashboard instead of mounting the full module. */
function isDashboardDemo(): boolean {
  return (
    typeof window !== 'undefined' && window.location.pathname === '/dashboard'
  );
}

export function App(): JSX.Element {
  const demo = isDashboardDemo();
  return (
    <div data-testid="host-shell">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <span className="text-sm font-semibold tracking-tight text-slate-800">
          Solovis · Weekly Commit
        </span>
      </header>
      <RemoteErrorBoundary>
        {demo ? <DashboardDemo /> : <ModuleView />}
      </RemoteErrorBoundary>
    </div>
  );
}

export default App;
