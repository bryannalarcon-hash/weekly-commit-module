// apps/host-shell/src/host.test.tsx — unit-level proof of the Module Federation seam (Plan U4/FR6):
// the thin host lazy-loads the remote's exposed `wc/WeeklyCommitApp` and renders it. The federated
// import is unresolvable under Vitest (no federation plugin), so we vi.mock it to stand in for the
// remote — exactly the contract the live remoteEntry must satisfy. Paths covered: the happy path
// (host shows its chrome, then the remote-exposed component mounts and the host passes it a `router`
// wrapper); the failure path (a remote that throws is caught by the host's error boundary, rendering
// a message instead of a white screen); and the `/dashboard` demo path, which instead mounts the
// SECOND federated expose — `wc/WeeklyCommitWidget` — wiring the widget's onOpen(route) to navigation.
import { render, screen, waitFor } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

// The remote's exposed entry, mocked to stand in for the federated module. The factory returns a
// component the host will lazy-load; tests below swap its implementation per scenario.
const remoteImpl: { current: Mock } = { current: vi.fn() };
vi.mock('wc/WeeklyCommitApp', () => ({
  WeeklyCommitApp: (props: Record<string, unknown>) =>
    remoteImpl.current(props),
}));

// The remote's SECOND exposed surface (the dashboard widget tile), mocked the same way.
const widgetImpl: { current: Mock } = { current: vi.fn() };
vi.mock('wc/WeeklyCommitWidget', () => ({
  WeeklyCommitWidget: (props: Record<string, unknown>) =>
    widgetImpl.current(props),
}));

describe('host-shell App (Module Federation seam)', () => {
  beforeEach(() => {
    remoteImpl.current = vi.fn();
    widgetImpl.current = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Default location is the module path; the dashboard-demo test overrides it.
    window.history.replaceState({}, '', '/');
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    window.history.replaceState({}, '', '/');
  });

  it('renders the component the remote exposes, passing a router wrapper', async () => {
    remoteImpl.current = vi.fn(
      (props: { router?: (c: unknown) => unknown }) => {
        // The host injects a `router` function — exercise it so we prove the host wires the router
        // context the remote consumes, and render a marker the remote "exposes".
        const wrapped = props.router?.(
          <div data-testid="remote-mounted">WC remote here</div>,
        );
        return <>{wrapped}</>;
      },
    );

    const { App } = await import('./App');
    render(<App />);

    // Host chrome is present immediately (it owns layout/router, not the feature).
    expect(screen.getByTestId('host-shell')).toBeInTheDocument();

    // The federated component resolves and mounts (lazy → Suspense), proving live federation works
    // at the unit level.
    expect(await screen.findByTestId('remote-mounted')).toBeInTheDocument();
    expect(remoteImpl.current).toHaveBeenCalledTimes(1);
    // The host passed a `router` wrapper to the remote (the U4 contract).
    const [firstProps] = remoteImpl.current.mock.calls[0] ?? [];
    expect(firstProps).toHaveProperty('router');
  });

  it('catches a failed remote load in the error boundary instead of a white screen', async () => {
    remoteImpl.current = vi.fn(() => {
      throw new Error('remoteEntry unreachable');
    });

    const { App } = await import('./App');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('remote-error')).toBeInTheDocument();
    });
    expect(screen.getByText('remoteEntry unreachable')).toBeInTheDocument();
  });

  it('mounts the federated widget on the /dashboard demo path, wiring onOpen→navigate', async () => {
    // jsdom's location.assign is non-configurable, so swap the whole location object for the test.
    const realLocation = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...realLocation, pathname: '/dashboard', assign },
    });

    widgetImpl.current = vi.fn(
      (props: { onOpen?: (r: string) => void; variant?: string }) => {
        props.onOpen?.('edit'); // exercise the host's onOpen wiring (routes 'edit' into the module path)
        return <div data-testid="widget-mounted">{props.variant}</div>;
      },
    );

    try {
      const { App } = await import('./App');
      render(<App />);

      // The host renders its own dashboard chrome (NOT the full module) and embeds the widget.
      expect(screen.getByTestId('host-shell')).toBeInTheDocument();
      expect(await screen.findByTestId('host-dashboard')).toBeInTheDocument();
      expect(await screen.findByTestId('widget-mounted')).toHaveTextContent(
        'card',
      );
      // The full module is NOT mounted on the demo path.
      expect(remoteImpl.current).not.toHaveBeenCalled();
      // The host passed onOpen + variant=card; onOpen routes 'edit' into the module path.
      const [props] = widgetImpl.current.mock.calls[0] ?? [];
      expect(props).toHaveProperty('onOpen');
      expect(props).toHaveProperty('variant', 'card');
      expect(assign).toHaveBeenCalledWith('/?open=edit');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: realLocation,
      });
    }
  });
});
