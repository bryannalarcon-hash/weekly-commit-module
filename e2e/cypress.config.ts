// e2e/cypress.config.ts — Cypress config for the WCM live E2E suite. Wires the Gherkin pipeline:
// @badeball/cypress-cucumber-preprocessor parses .feature files and the esbuild preprocessor bundles
// the TS step definitions. specPattern points at the feature files; the host (baseUrl :4200) is the
// LIVE federated stack (host-shell loading wc-remote over Module Federation, backend on :8080 via the
// /api proxy). Identity is hermetic (X-Debug-Member), set per-scenario via cy.visit('/?member=...').
import { defineConfig } from 'cypress';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';
import {
  addCucumberPreprocessorPlugin,
  type ICypressConfiguration,
} from '@badeball/cypress-cucumber-preprocessor';
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild';

export default defineConfig({
  e2e: {
    baseUrl: process.env.WCM_HOST_URL ?? 'http://localhost:4200',
    specPattern: 'cypress/e2e/features/**/*.feature',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15000,
    // The federated remote + its lazy chunks can take a beat on first load; be patient.
    pageLoadTimeout: 60000,
    retries: { runMode: 1, openMode: 0 },
    async setupNodeEvents(on, config) {
      await addCucumberPreprocessorPlugin(on, config as unknown as ICypressConfiguration);
      on(
        'file:preprocessor',
        createBundler({
          plugins: [
            createEsbuildPlugin(config as unknown as ICypressConfiguration),
          ],
        }),
      );
      return config;
    },
  },
});
