const path = require('node:path');
module.exports = {
  testDir: __dirname, testMatch: 'bridge.spec.cjs', workers: 1, retries: 0, timeout: 15000,
  outputDir: process.env.SAHA_BRIDGE_ARTIFACTS,
  use: { headless: true, launchOptions: { executablePath: process.env.SAHA_CHROMIUM_PATH }, trace: 'on' },
  reporter: [['line'], [path.resolve(__dirname, '../../scripts/testing-links/playwright-reporter.mjs'), { output: process.env.SAHA_LINKED_OUTPUT, metadata: process.env.SAHA_RUN_METADATA }]],
};
