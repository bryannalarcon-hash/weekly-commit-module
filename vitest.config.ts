// vitest.config.ts — root Vitest config. In Vitest 2.x the coverage gate is a ROOT-level option
// (ignored if set on a workspace project), so it lives here while vitest.workspace.ts owns the
// per-project test env/plugins. Coverage is scoped to real app/lib SOURCE only and held to >= 80
// across lines/functions/branches/statements — mirroring the backend JaCoCo bar (KTD10). all:true
// instruments every matched source file (so untested files count as 0, not silently omitted),
// while the excludes keep test-only infra (MSW), pure type/contract/barrel files, the MF entry
// shim, and the e2e/perf/dist/generated-report trees out of the measured surface.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    workspace: './vitest.workspace.ts',
    coverage: {
      provider: 'v8',
      all: true,
      reporter: ['text', 'html', 'json-summary'],
      include: ['apps/*/src/**/*.{ts,tsx}', 'libs/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.{test,spec}.{ts,tsx}',
        '**/main.tsx',
        '**/bootstrap.tsx', // MF bootstrap shim, exercised by the federation build, not units
        '**/remote-entry.tsx', // MF entry shim, exercised by the live federation build, not units
        '**/vite-env.d.ts',
        '**/*.d.ts',
        '**/*.d.mts',
        '**/*.config.{ts,js,mts}',
        '**/__mocks__/**', // test-only module stubs (e.g. the federated-remote stand-in)
        '**/index.ts', // pure re-export barrels (covered transitively, no own behavior)
        'libs/types/src/contract.ts', // type-only declarations (no runtime to cover)
        'libs/ui/src/theme.colors.mjs', // generated token map (no logic)
        'libs/api/src/msw/**', // test-only mock server, not shipped product code
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
