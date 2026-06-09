// e2e/cypress/support/e2e.ts — global support for the WCM live E2E suite. Registers custom commands
// used by the step definitions: resetData (re-seed the backend's per-scenario baseline) and visitAs
// (open the federated host authenticated as a seeded member via the hermetic X-Debug-Member identity,
// carried in the ?member= query the wc-remote reads). Also swallows ResizeObserver noise that some
// Flowbite components emit, which is harmless but would otherwise fail a test.
/// <reference types="cypress" />

const API = Cypress.env('apiUrl') || 'http://localhost:8080';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Re-seed the backend to the per-scenario baseline (hermetic e2e reset endpoint). */
      resetData(): Chainable<void>;
      /** Visit a path on the federated host authenticated as the named seeded member. */
      visitAs(member: string, opts?: { manager?: boolean; path?: string }): Chainable<void>;
    }
  }
}

Cypress.Commands.add('resetData', () => {
  cy.request('POST', `${API}/api/e2e/reset`).its('status').should('eq', 200);
});

Cypress.Commands.add(
  'visitAs',
  (member: string, opts?: { manager?: boolean; path?: string }) => {
    const path = opts?.path ?? '/';
    const sep = path.includes('?') ? '&' : '?';
    const qp = `member=${encodeURIComponent(member)}&manager=${opts?.manager ? 'true' : 'false'}`;
    cy.visit(`${path}${sep}${qp}`);
  },
);

// Flowbite / dnd-kit can throw a benign ResizeObserver loop warning; do not fail the run on it.
Cypress.on('uncaught:exception', (err) => {
  if (/ResizeObserver loop/.test(err.message)) {
    return false;
  }
  return undefined;
});

export {};
