// vitest.setup.ts — global test setup loaded before every WCM test file.
// Registers @testing-library/jest-dom matchers + the jest-axe `toHaveNoViolations` matcher (a11y),
// and auto-unmounts React trees after each test.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

afterEach(() => {
  cleanup();
});
