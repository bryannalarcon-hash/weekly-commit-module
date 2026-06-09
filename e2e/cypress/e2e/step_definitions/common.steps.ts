// common.steps.ts — shared Gherkin steps for the WCM live E2E suite: per-scenario data reset and the
// shared "report's review detail is shown" assertion reused by the manager scenarios. Step definitions
// drive the LIVE federated app (host loading the remote over MF) via real-browser interactions; the
// acting identity is hermetic (X-Debug-Member) set through cy.visitAs.
import { Given, Then } from '@badeball/cypress-cucumber-preprocessor';

Given('the demo data is reset', () => {
  // Clear cross-scenario state remembered in Cypress.env so a fresh reseed isn't shadowed by a
  // commit id captured in a previous scenario.
  Cypress.env('reconCommitId', undefined);
  Cypress.env('lifecycleCommitId', undefined);
  cy.resetData();
});

Then("the report's review detail is shown", () => {
  cy.get('[data-testid="review-detail"]', { timeout: 20000 }).should('be.visible');
  // A reviewable (locked+) report shows the item list + the review actions, not the not-locked state.
  cy.get('[data-testid="review-items"]').should('exist');
  cy.get('[data-testid="mark-reviewed"]').should('exist');
});
