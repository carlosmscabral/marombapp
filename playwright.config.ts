/**
 * Playwright config for the 390x844 mobile as-is parity suite.
 * It builds the app with `vite.e2e.config.ts`, which swaps Firebase for local fakes, and serves it with `vite preview`.
 * Thus no spec reaches a real Firebase project and `npm run build` output stays untouched.
 * It uses the system Chromium because agent containers do not download browsers.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  // A cold 4-vCPU container needs up to ~50 s for a first test. These budgets absorb that without retries.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    ...devices['Pixel 5'],
    viewport: { width: 390, height: 844 },
    locale: 'en-US',
    timezoneId: 'America/Sao_Paulo',
    baseURL: `http://127.0.0.1:${PORT}`,
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-gpu-sandbox'],
    },
  },
  projects: [{ name: 'mobile-390x844', use: { browserName: 'chromium' } }],
  webServer: {
    command: `vite build --config vite.e2e.config.ts --logLevel warn && vite preview --config vite.e2e.config.ts --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
