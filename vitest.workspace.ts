// vitest.workspace.ts — Vitest workspace aggregating every app/lib test project.
// Sets the jsdom env, jest-dom setup, and a build-failing coverage gate (lines >= 70).
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: false,
    test: {
      name: 'wcm',
      globals: true,
      environment: 'jsdom',
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
