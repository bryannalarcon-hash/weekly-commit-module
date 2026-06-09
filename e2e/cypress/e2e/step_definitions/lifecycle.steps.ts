// lifecycle.steps.ts — Gherkin steps for weekly-commit-lifecycle.feature. Drives the employee
// create→link(RCDO picker)→tier→submit(LOCKED) journey through the LIVE federated UI, then the
// manager-driven reconcile (start RECONCILING + mark reviewed) with the owner recording actuals, and
// the owner's carry-forward. Where a locked precondition is needed it is built via the real REST API
// as the owner (X-Debug-Member) — the create→lock UI itself is covered by the first scenario.
import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

const API = Cypress.env('apiUrl') || 'http://localhost:8080';

/** Monday (yyyy-MM-dd) of the current week — matches the app's "start your week" week-start. */
function currentMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Request helper acting as a seeded member via the hermetic X-Debug-Member header. */
function asMember<T = unknown>(
  member: string,
  method: string,
  path: string,
  body?: unknown,
): Cypress.Chainable<Cypress.Response<T>> {
  return cy.request<T>({
    method,
    url: `${API}${path}`,
    headers: { 'X-Debug-Member': member },
    body,
  });
}

// --- Scenario 1: employee drafts and locks ----------------------------------------------------

Given('the employee {string} opens the Weekly Commit app', (member: string) => {
  cy.visitAs(member);
  // The federated remote must mount and reach the authenticated home.
  cy.get('[data-testid="my-week"]', { timeout: 30000 }).should('be.visible');
});

When('they start a new week', () => {
  cy.get('[data-testid="start-week"]', { timeout: 20000 }).click();
  cy.get('[data-testid="edit-commit"]', { timeout: 20000 }).should('be.visible');
});

When('they add a commit item {string}', (text: string) => {
  cy.get('[data-testid="add-item"]').click();
  cy.get('[data-testid="composer-item"]').last().find('[data-testid="item-text"]').type(text);
});

When('they link item {int} to a Supporting Outcome', (n: number) => {
  cy.get('[data-testid="composer-item"]')
    .eq(n - 1)
    .find('[data-testid="link-outcome"]')
    .click();
  cy.get('[data-testid="rcdo-picker"]', { timeout: 20000 }).should('be.visible');
  cy.get('[data-testid="rcdo-tree"]').should('be.visible');
  // Pick the first selectable leaf in the tree.
  cy.get('[data-testid^="tree-item-"][aria-level="4"]').first().click();
  cy.get('[data-testid="rcdo-picker"]').should('not.exist');
});

When('they set item {int} chess tier to {string}', (n: number, tier: string) => {
  // The re-skinned ChessSelector is a segmented radiogroup (role=radio buttons carrying data-tier),
  // not a native <select> — click the tier's segment.
  cy.get('[data-testid="composer-item"]')
    .eq(n - 1)
    .find('[data-testid="chess-tier-select"]')
    .find(`[data-tier="${tier}"]`)
    .click();
});

When('they submit and lock the week', () => {
  cy.get('[data-testid="submit-lock"]').should('not.be.disabled').click();
  cy.get('[data-testid="confirm-accept"]', { timeout: 20000 }).click();
  // After lock the composer routes back to the read-only My-Week view.
  cy.get('[data-testid="my-week"]', { timeout: 20000 }).should('be.visible');
});

Then('the week is {string}', (state: string) => {
  cy.contains('[data-testid="lifecycle-badge"]', new RegExp(state, 'i'), {
    timeout: 20000,
  }).should('be.visible');
});

Then('the locked week is read-only', () => {
  // The locked My-Week view offers Review/Open reconciliation, not an editable composer.
  cy.get('[data-testid="open-reconcile"]').should('exist');
  cy.get('[data-testid="edit-continue"]').should('not.exist');
});

// --- Scenario 2: manager reconciles, owner carries forward ------------------------------------

Given(
  'the employee {string} has a locked week with one completed and one incomplete item',
  (member: string) => {
    const weekStart = currentMonday();
    // Find two distinct supporting-outcome leaf ids to link the items to.
    asMember<Array<{ definingObjectives: Array<{ outcomes: Array<{ supportingOutcomes: Array<{ id: string }> }> }> }>>(
      member,
      'GET',
      '/api/rcdo/tree',
    ).then((treeRes) => {
      const leaves: string[] = [];
      for (const rc of treeRes.body) {
        for (const dobj of rc.definingObjectives) {
          for (const o of dobj.outcomes) {
            for (const so of o.supportingOutcomes) leaves.push(so.id);
          }
        }
      }
      const [so1, so2] = leaves;
      asMember<{ id: string }>(member, 'POST', '/api/commits', {
        weekStart,
        items: [
          { text: 'Reconcile look-through exposures', supportingOutcomeId: so1, chessTier: 'KING' },
          { text: 'Exception validation workflow', supportingOutcomeId: so2, chessTier: 'ROOK' },
        ],
      }).then((createRes) => {
        const commitId = createRes.body.id;
        Cypress.env('lifecycleCommitId', commitId);
        asMember(member, 'POST', `/api/commits/${commitId}/submit`).its('status').should('eq', 200);
      });
    });
  },
);

When('the manager {string} starts reconciliation for that week', (manager: string) => {
  const commitId = Cypress.env('lifecycleCommitId');
  // The manager opens the reconciliation view, then starts it (LOCKED -> RECONCILING).
  asMember(manager, 'POST', `/api/commits/${commitId}/reconcile`).its('status').should('eq', 200);
});

When('the owner marks the first item complete and the second item incomplete', () => {
  const commitId = Cypress.env('lifecycleCommitId');
  cy.visitAs('sana@solovis.test', { path: `/reconcile/${commitId}` });
  cy.get('[data-testid="reconciliation"]', { timeout: 30000 }).should('be.visible');
  cy.get('[data-testid="recon-row"]').should('have.length.at.least', 2);
  cy.get('[data-testid="recon-row"]').eq(0).find('[data-testid="recon-status-select"]').select('COMPLETE');
  cy.get('[data-testid="recon-row"]').eq(1).find('[data-testid="recon-status-select"]').select('INCOMPLETE');
  // Let the debounced PATCH flush and the diff refetch reflect both flags.
  cy.get('[data-testid="recon-row"][data-flag="COMPLETED"]', { timeout: 20000 }).should('exist');
  cy.get('[data-testid="recon-row"][data-flag="INCOMPLETE"]', { timeout: 20000 }).should('exist');
});

When('the manager marks the week reviewed', () => {
  const commitId = Cypress.env('lifecycleCommitId');
  asMember(manager0(), 'POST', `/api/commits/${commitId}/reconciled`).its('status').should('eq', 200);
  // Re-load the owner's reconciliation view so the lifecycle badge reflects RECONCILED for the
  // following "the week is RECONCILED" assertion (the previous page was the in-progress view).
  cy.visitAs('sana@solovis.test', { path: `/reconcile/${commitId}` });
  cy.get('[data-testid="reconciliation"]', { timeout: 30000 }).should('be.visible');
});

// The manager for the lifecycle owner (sana) is priya in the seed.
function manager0(): string {
  return 'priya@solovis.test';
}

When('the owner carries the unfinished work forward', () => {
  const commitId = Cypress.env('lifecycleCommitId');
  cy.visitAs('sana@solovis.test', { path: `/reconcile/${commitId}` });
  cy.get('[data-testid="reconciliation"]', { timeout: 30000 }).should('be.visible');
  cy.get('[data-testid="carry-forward"]', { timeout: 20000 }).click();
  cy.get('[data-testid="confirm-accept"]', { timeout: 20000 }).click();
});

Then('a new draft week is created carrying {int} item forward', (count: number) => {
  // Verify via the API: the owner now has a DRAFT next-week commit carrying `count` items.
  const commitId = Cypress.env('lifecycleCommitId');
  asMember<{ weekStart: string }>('sana@solovis.test', 'GET', `/api/commits/${commitId}`).then((res) => {
    const week = new Date(res.body.weekStart);
    week.setDate(week.getDate() + 7);
    const nextWeek = `${week.getFullYear()}-${String(week.getMonth() + 1).padStart(2, '0')}-${String(
      week.getDate(),
    ).padStart(2, '0')}`;
    asMember<Array<{ weekStart: string; lifecycleState: string; carriedInCount: number }>>(
      'sana@solovis.test',
      'GET',
      '/api/commits',
    ).then((listRes) => {
      const next = listRes.body.find((w) => w.weekStart === nextWeek);
      expect(next, 'next-week draft exists').to.not.equal(undefined);
      expect(next?.lifecycleState).to.equal('DRAFT');
      expect(next?.carriedInCount).to.equal(count);
    });
  });
});
