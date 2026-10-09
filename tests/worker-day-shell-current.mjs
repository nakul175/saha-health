// Preserve the immutable historical driver. All 12 assertions run on the current shell
// under the original unit/field-shell ID and its original regression minimum.
import { readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
let source = readFileSync('tests/field-shell-current-assets.mjs', 'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'), '5d04b8316b3cd35ecf3ea822c2e572e79fb6e691ba7a055306ea378413f11bc8', 'Original twelve-assertion driver must remain unchanged');
const changes = [
  ["await life('install');check(()=>assert.equal(stored.size,12));", "await life('install');check(()=>assert.equal(stored.size,13));"],
  ["'/field/guided-capture.js'", "'/field/guided-capture.js','/field/worker-day.js'"],
  ["check(()=>assert.equal(stored.size,12));", "check(()=>assert.equal(stored.size,13));"],
  ['exact twelve static shell assets', 'exact thirteen static shell assets'],
  ['tests/evidence/app-first-offline-rawkey-broad/field-shell-current.json', 'tests/reports/worker-day-offline/field-shell-current.json'],
];
for (const [before, after] of changes) {
  assert.equal(source.split(before).length - 1, 1, 'Expected unique fixture replacement');
  source = source.replace(before, after);
}
mkdirSync('tests/reports/worker-day-offline', { recursive: true });
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
