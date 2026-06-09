// apps/host-shell/src/__mocks__/wc-remote-widget.tsx — test-only stand-in for the federated module
// `wc/WeeklyCommitWidget` (the dashboard tile the remote exposes alongside WeeklyCommitApp). Under
// Vitest there is no Module Federation runtime, so the workspace aliases the bare
// `wc/WeeklyCommitWidget` specifier to this file purely so Vite's import-analysis can resolve it;
// host.test.tsx then vi.mock()s the same specifier to drive per-scenario behavior. This default impl
// is a harmless placeholder and is never asserted on directly.
export interface WeeklyCommitWidgetProps {
  onOpen?: (route: string) => void;
  variant?: 'card' | 'compact';
}

export function WeeklyCommitWidget(
  _props: WeeklyCommitWidgetProps,
): JSX.Element {
  return <div data-testid="widget-stub-default" />;
}

export default WeeklyCommitWidget;
