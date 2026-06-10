// vitest.workspace.ts — Vitest workspace aggregating every app/lib test project (test env + plugins
// only). The COVERAGE gate lives in the root vitest.config.ts: in Vitest 2.x coverage is a
// root-level option and is ignored when set on a workspace project, so it must not live here.
// Loads @vitejs/plugin-react so JSX in libs/* (which have no own vite config) transforms with the
// automatic runtime, sets the jsdom env and jest-dom setup. The federated `wc/WeeklyCommitApp` and
// `wc/WeeklyCommitWidget` specifiers are aliased to local stubs so the host's lazy imports resolve
// under Vitest (no MF runtime here); host.test.tsx vi.mock()s them for per-scenario behavior.
// apps/wc-remote keeps its own vite.config.ts for the MF + react transform.
import { fileURLToPath } from 'node:url';
import { defineWorkspace } from 'vitest/config';
import react from '@vitejs/plugin-react';

const wcRemoteStub = fileURLToPath(
  new URL(
    './apps/host-shell/src/__mocks__/wc-remote-entry.tsx',
    import.meta.url,
  ),
);
const wcWidgetStub = fileURLToPath(
  new URL(
    './apps/host-shell/src/__mocks__/wc-remote-widget.tsx',
    import.meta.url,
  ),
);

export default defineWorkspace([
  {
    extends: false,
    plugins: [react()],
    resolve: {
      alias: {
        'wc/WeeklyCommitApp': wcRemoteStub,
        'wc/WeeklyCommitWidget': wcWidgetStub,
      },
    },
    test: {
      name: 'wcm',
      globals: true,
      environment: 'jsdom',
      // jsdom gets a real origin so RTK Query's relative /api/* URLs resolve under node's undici;
      // MSW matches on path, so the host portion is irrelevant to the mocks.
      environmentOptions: { jsdom: { url: 'http://localhost/' } },
      env: { VITE_API_BASE: 'http://localhost/api' },
      // The heaviest interaction specs (EditCommit drawer flow, route table) string several
      // userEvent + waitFor steps together; under full 44-file parallelism on a busy CPU they can be
      // starved past the 5s default and flake. They pass in well under a second when not contended,
      // so a higher ceiling absorbs the starvation without slowing the happy path. hookTimeout
      // covers MSW server start/seed in beforeAll under the same contention.
      testTimeout: 20000,
      hookTimeout: 20000,
      setupFiles: ['./vitest.setup.ts'],
      include: [
        'apps/**/src/**/*.{test,spec}.{ts,tsx}',
        'libs/**/src/**/*.{test,spec}.{ts,tsx}',
      ],
    },
  },
]);
