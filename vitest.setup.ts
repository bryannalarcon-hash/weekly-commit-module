// vitest.setup.ts — global test setup loaded before every WCM test file.
// Registers @testing-library/jest-dom matchers + the jest-axe `toHaveNoViolations` matcher (a11y),
// auto-unmounts React trees after each test, and raises Testing Library's async wait ceiling so
// findBy*/waitFor survive CPU starvation under full-suite parallelism (specs are individually fast,
// but when 8 files compete the default 1s window can lapse before RTK Query/effects settle — the
// source of the EditCommit/route-table render-race flakes).
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

configure({ asyncUtilTimeout: 5000 });
expect.extend(toHaveNoViolations);

afterEach(() => {
  cleanup();
});
