// apps/host-shell/src/__mocks__/wc-remote-entry.tsx — test-only stand-in for the federated module
// `wc/WeeklyCommitApp`. Under Vitest there is no Module Federation runtime, so the workspace aliases
// the bare `wc/WeeklyCommitApp` specifier to this file purely so Vite's import-analysis can resolve
// it; the host.test.tsx then vi.mock()s the same specifier to drive per-scenario behavior. This
// default impl is just a harmless placeholder and is never asserted on directly.
export function WeeklyCommitApp(): JSX.Element {
  return <div data-testid="remote-stub-default" />;
}

export default WeeklyCommitApp;
