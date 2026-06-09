// apps/wc-remote/src/test/vitest-matchers.d.ts — augments Vitest's expect with the jest-axe
// `toHaveNoViolations` a11y matcher (registered in vitest.setup.ts). Module file (the trailing export
// makes `declare module 'vitest'` an AUGMENTATION, not a replacement of the real vitest types).
import 'vitest';

declare module 'vitest' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
