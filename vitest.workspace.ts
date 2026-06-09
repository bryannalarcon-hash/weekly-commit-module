// vitest.workspace.ts — Vitest workspace aggregating every app/lib test project.
// Loads @vitejs/plugin-react so JSX in libs/* (which have no own vite config) transforms with the
// automatic runtime, sets the jsdom env, jest-dom setup, and a coverage gate (lines >= 70, opt-in
// via --coverage). apps/wc-remote keeps its own vite.config.ts for the MF + react transform.
import { defineWorkspace } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineWorkspace([
  {
    extends: false,
    plugins: [react()],
    test: {
      name: 'wcm',
      globals: true,
      environment: 'jsdom',
      // jsdom gets a real origin so RTK Query's relative /api/* URLs resolve under node's undici;
      // MSW matches on path, so the host portion is irrelevant to the mocks.
      environmentOptions: { jsdom: { url: 'http://localhost/' } },
      env: { VITE_API_BASE: 'http://localhost/api' },
      setupFiles: ['./vitest.setup.ts'],
      include: [
        'apps/**/src/**/*.{test,spec}.{ts,tsx}',
        'libs/**/src/**/*.{test,spec}.{ts,tsx}',
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['apps/**/src/**/*.{ts,tsx}', 'libs/**/src/**/*.{ts,tsx}'],
        exclude: [
          '**/*.{test,spec}.{ts,tsx}',
          '**/main.tsx',
          '**/vite-env.d.ts',
          '**/*.config.{ts,js}',
        ],
        thresholds: {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
      },
    },
  },
]);
