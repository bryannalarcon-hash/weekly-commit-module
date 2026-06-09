// vitest.setup.ts — global test setup loaded before every WCM test file.
// Registers @testing-library/jest-dom matchers and auto-unmounts React trees after each test.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
