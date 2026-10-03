// Slice 11c: browser UI tests (end-to-end journeys, screenshot regression, accessibility) for the built Worker.
// Run from the repository root after `npm run build`:
//   npx playwright test -c tests/ui/playwright.config.mjs
// A global setup starts the built Worker once (tests/lib/worker.mjs, fresh local D1, synthetic data) on SAHA_UI_PORT (default 8821)
// and stops it afterwards. Set SAHA_UI_BASE=http://127.0.0.1:<port> to reuse a Worker you already started (the setup then starts none).
// Chromium only; two projects: desktop 1280x720 and phone 390x844. One worker process (the machine has 2 cores).
import { defineConfig } from '@playwright/test';

const port = process.env.SAHA_UI_PORT ?? '8821';
const baseURL = process.env.SAHA_UI_BASE ?? `http://127.0.0.1:${port}`;
// The journeys send the local dispatcher's identity headers, which a hosted Site must never receive: refuse any base that is not this machine.
if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/?$/.test(baseURL)) throw new Error(`SAHA_UI_BASE must be a local Worker (http://127.0.0.1:<port>); got ${baseURL}. These tests send local identity headers and write data.`);

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  outputDir: '../../test-results/ui',           // git-ignored (/test-results/)
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  globalSetup: './global-setup.mjs',
  reporter: [
    ['list'],
    ['./reporter.mjs'],                          // writes tests/reports/ui-result.json in the tests/lib/report.mjs shape
  ],
  use: {
    baseURL,
    browserName: 'chromium',
    locale: 'en-IN',                             // the workspace formats dates as en-IN
    timezoneId: 'Asia/Kolkata',
    colorScheme: 'light',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'desktop', testIgnore: /phone\.spec\.mjs$/, use: { viewport: { width: 1280, height: 720 } } },
    { name: 'phone', testMatch: /phone\.spec\.mjs$/, use: { viewport: { width: 390, height: 844 } } },
  ],
});
