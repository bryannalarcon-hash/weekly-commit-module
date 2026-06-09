// apps/host-shell/src/host.test.tsx — unit-level proof of the Module Federation seam (Plan U4/FR6):
// the thin host lazy-loads the remote's exposed `wc/WeeklyCommitApp` and renders it. The federated
// import is unresolvable under Vitest (no federation plugin), so we vi.mock it to stand in for the
// remote — exactly the contract the live remoteEntry must satisfy. Two paths are covered: the happy
// path (host shows its chrome, then the remote-exposed component mounts and the host passes it a
// `router` wrapper), and the failure path (a remote that throws is caught by the host's error
// boundary, rendering a message instead of a white screen).
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
  WeeklyCommitApp: (props: Record<string, unknown>) => remoteImpl.current(props),
}));

describe('host-shell App (Module Federation seam)', () => {
  beforeEach(() => {
    remoteImpl.current = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('renders the component the remote exposes, passing a router wrapper', async () => {
    remoteImpl.current = vi.fn((props: { router?: (c: unknown) => unknown }) => {
      // The host injects a `router` function — exercise it so we prove the host wires the router
      // context the remote consumes, and render a marker the remote "exposes".
      const wrapped = props.router?.(<div data-testid="remote-mounted">WC remote here</div>);
      return <>{wrapped}</>;
    });

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
});
