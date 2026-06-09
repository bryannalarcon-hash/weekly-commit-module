// e2e/playwright/smoke.spec.ts — the thin Playwright smoke (brief Dev-Tools line / U23). Proves the
// app loads end to end THROUGH THE HOST-SHELL: the host boots, lazy-loads the wc-remote over live
// Module Federation, and an employee (hermetic X-Debug-Member identity via the ?member= query) reaches
// the authenticated home screen. Complements — does not replace — the Cypress+Gherkin journeys.
import { test, expect } from '@playwright/test';

const HOST = process.env.WCM_HOST_URL ?? 'http://localhost:4200';

test('app loads through the host-shell and an employee reaches home', async ({ page }) => {
  // Visit the federated host authenticated as a seeded employee (hermetic E2E auth).
  await page.goto(`${HOST}/?member=lena@solovis.test&manager=false`);

  // The host chrome renders immediately…
  await expect(page.getByTestId('host-shell')).toBeVisible();

  // …and the federated remote mounts to the authenticated My-Week home (proves live MF + auth + API).
  await expect(page.getByTestId('my-week')).toBeVisible({ timeout: 30000 });

  // Lena has a LOCKED week in the seed — her lifecycle badge confirms real data flowed through /api.
  await expect(page.getByTestId('lifecycle-badge')).toContainText(/locked/i, { timeout: 20000 });
});
