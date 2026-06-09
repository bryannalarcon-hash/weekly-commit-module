// apps/wc-remote/src/test/jest-axe.d.ts — declares the jest-axe module (which ships no types) WITHOUT
// pulling @types/jest-axe (it depends on jest globals, which clash with vitest/globals). Ambient script
// file (no top-level import/export) so this registers a NEW module rather than augmenting a missing one.
declare module 'jest-axe' {
  interface AxeResults {
    violations: unknown[];
  }
  export function axe(
    html: Element | string,
    options?: Record<string, unknown>,
  ): Promise<AxeResults>;
  export const toHaveNoViolations: {
    toHaveNoViolations(results: AxeResults): { pass: boolean; message: () => string };
  };
}
