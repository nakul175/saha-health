// Starts the built Worker once for the whole run and returns the function that stops it (Playwright calls it as the teardown).
import { resolve } from 'node:path';
import { startWorker } from '../lib/worker.mjs';

export default async function globalSetup() {
  if (process.env.SAHA_UI_BASE) return undefined; // an already running Worker is used; nothing to start or stop
  process.chdir(resolve(import.meta.dirname, '../..')); // tests/lib/worker.mjs reads dist/ and drizzle/ relative to the repository root
  const worker = await startWorker({ port: process.env.SAHA_UI_PORT ?? '8821', name: 'saha-ui' });
  return async () => { await worker.stop(); };
}
