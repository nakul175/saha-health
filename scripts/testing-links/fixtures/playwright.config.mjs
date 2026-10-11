import path from 'node:path';
import { fileURLToPath } from 'node:url';
const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url));
export default {
  testDir: fixtureDirectory, testMatch: 'bridge.spec.mjs', workers: 1, retries: 0, timeout: 15000,
  outputDir: process.env.SAHA_BRIDGE_ARTIFACTS,
  use: { headless: true, launchOptions: { executablePath: process.env.SAHA_CHROMIUM_PATH }, trace: 'on' },
  reporter: [['line'], [path.resolve(fixtureDirectory, '../playwright-reporter.mjs'), { output: process.env.SAHA_LINKED_OUTPUT, metadata: process.env.SAHA_RUN_METADATA }]],
};
