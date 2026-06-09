// manager.steps.ts — Gherkin steps for manager-review-rollup.feature. Drives the manager's review
// queue, opening a report's review, and the team roll-up dashboard (metrics + drill-through) through
// the LIVE federated UI as a manager (X-Debug-Member, manager=true). The drill-through assertion
// exercises the deferred "dashboard → report review" fix: clicking a row opens that report's review.
import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

Given('the manager {string} opens the review queue', (manager: string) => {
  cy.visitAs(manager, { manager: true, path: '/manager' });
  cy.get('[data-testid="review-queue"]', { timeout: 30000 }).should('be.visible');
});

Then('the review queue lists the report {string}', (name: string) => {
  cy.get('[data-testid="queue-list"]', { timeout: 20000 }).should('be.visible');
  cy.contains('[data-testid="queue-row"]', name).should('be.visible');
});

When('the manager opens the review for {string}', (name: string) => {
  cy.contains('[data-testid="queue-row"]', name)
    .find('[data-testid="queue-open-review"]')
    .click();
});

Given('the manager {string} opens the team dashboard', (manager: string) => {
  cy.visitAs(manager, { manager: true, path: '/manager/dashboard' });
  cy.get('[data-testid="rollup-dashboard"]', { timeout: 30000 }).should('be.visible');
});

Then('the dashboard shows a roll-up row for {string}', (name: string) => {
  cy.get('[data-testid="rollup-table"]', { timeout: 20000 }).should('be.visible');
  cy.contains('[data-testid="rollup-row"]', name).should('be.visible');
});

Then('the dashboard shows an alignment percentage column', () => {
  cy.contains('Alignment %').should('be.visible');
});

When('the manager drills through the {string} row', (name: string) => {
  cy.contains('[data-testid="rollup-row"]', name)
    .find('[data-testid="rollup-drill"]')
    .click();
});
