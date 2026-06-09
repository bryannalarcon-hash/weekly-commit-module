// reconciliation.steps.ts — Gherkin steps for reconciliation.feature. Opens Omar's seeded RECONCILING
// week through the LIVE federated UI and asserts the planned(snapshot)-vs-actual diff: one COMPLETED
// row, one INCOMPLETE row, and — after injecting an out-of-band item (the hermetic e2e endpoint) — an
// ADDED_AFTER_LOCK row. The acting identity is hermetic (X-Debug-Member).
import { Given, Then } from '@badeball/cypress-cucumber-preprocessor';

const API = Cypress.env('apiUrl') || 'http://localhost:8080';

/** Resolve the owner's reconciling commit id and remember it for later steps. */
function loadReconcilingCommit(member: string): Cypress.Chainable<string> {
  return cy
    .request<Array<{ commitId: string; lifecycleState: string }>>({
      method: 'GET',
      url: `${API}/api/commits`,
      headers: { 'X-Debug-Member': member },
    })
    .then((res) => {
      const recon = res.body.find((w) => w.lifecycleState === 'RECONCILING') ?? res.body[0];
      expect(recon, 'a reconciling week exists for ' + member).to.not.equal(undefined);
      Cypress.env('reconCommitId', recon.commitId);
      return recon.commitId;
    });
}

// One definition serves BOTH the Given and When phrasings (cucumber matches by text, not keyword):
// resolve the owner's reconciling commit (if not already remembered) and open its reconciliation view.
const openReconcilingWeek = (member: string): void => {
  const known = Cypress.env('reconCommitId');
  if (known) {
    cy.visitAs(member, { path: `/reconcile/${known}` });
    cy.get('[data-testid="reconciliation"]', { timeout: 30000 }).should('be.visible');
  } else {
    loadReconcilingCommit(member).then((commitId) => {
      cy.visitAs(member, { path: `/reconcile/${commitId}` });
      cy.get('[data-testid="reconciliation"]', { timeout: 30000 }).should('be.visible');
    });
  }
};

// Registered ONCE — cucumber resolves a step by its text regardless of the Given/When/Then keyword,
// so this single definition matches both the "Given ... opens" and "When ... opens" lines.
Given('the employee {string} opens their reconciling week', openReconcilingWeek);

Then('the reconciliation view lists the planned items', () => {
  cy.get('[data-testid="recon-rows"]').should('be.visible');
  cy.get('[data-testid="recon-row"]').should('have.length.at.least', 2);
});

Then('one item is flagged completed', () => {
  cy.get('[data-testid="recon-row"][data-flag="COMPLETED"]').should('have.length.at.least', 1);
});

Then('one item is flagged incomplete', () => {
  cy.get('[data-testid="recon-row"][data-flag="INCOMPLETE"]').should('have.length.at.least', 1);
});

Given('the employee {string} has an item added after lock', (member: string) => {
  loadReconcilingCommit(member).then((commitId) => {
    cy.request({
      method: 'POST',
      url: `${API}/api/e2e/commits/${commitId}/inject-item`,
    })
      .its('status')
      .should('eq', 200);
  });
});

Then('an item is flagged as added after lock', () => {
  cy.get('[data-testid="recon-row"][data-flag="ADDED_AFTER_LOCK"]', { timeout: 20000 }).should(
    'have.length.at.least',
    1,
  );
});
