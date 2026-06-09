// e2e/playwright.config.ts — config for the thin Playwright smoke (smoke.spec.ts). Tests live under
// playwright/; the app stack (host :4200 + remote :4201 + backend :8080) is started by run-e2e.sh, so
// no webServer block here. Single chromium project, headless, modest retries for first-load timing.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  timeout: 60000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.WCM_HOST_URL ?? 'http://localhost:4200',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
