// Observe the actual DB binding of the already owned application runtime.
// This adapter issues only the original read-only SQL, never a database/file guess.
import assert from 'node:assert/strict';
import { deadline } from './scoped-locality-containment.mjs';

const BODY_DEADLINE_MS = 30000;
export function nativeRows(result, organisation) {
  assert.equal(result?.success, true, 'The actual D1 query must succeed.');
  assert.ok(Array.isArray(result.results), 'Actual D1 rows are required; never substitute an empty result.');
  for (const row of result.results) {
    assert.ok(row !== null && typeof row === 'object' && !Array.isArray(row));
    assert.equal(row.org_id, organisation, 'Observe only the exact original organisation.');
    assert.equal(typeof row.id, 'string', 'The original ordered clinical row must have its actual ID.');
  }
  return result.results;
}
export function nativeCount(row) {
  assert.ok(row !== null && typeof row === 'object' && !Array.isArray(row), 'Actual count row is required; never substitute zero.');
  assert.ok(Number.isSafeInteger(row.n) && row.n >= 0, 'Actual native count must be a nonnegative integer.');
  return row.n;
}
export async function nativeDatabase(worker) {
  const db = await deadline('owned native DB binding lookup', () => worker.mf.getD1Database('DB'), BODY_DEADLINE_MS);
  assert.equal(typeof db?.prepare, 'function', 'The owned live Miniflare DB binding is required.');
  return db;
}
export async function clinicalSnapshot(db, org) {
  const snapshot = {};
  for (const table of ['patients', 'visits', 'submissions', 'referrals']) {
    const result = await deadline(`actual native ${table} rows`, () => db.prepare(`SELECT * FROM ${table} WHERE org_id=? ORDER BY id`).bind(org).all(), BODY_DEADLINE_MS);
    snapshot[table] = nativeRows(result, org);
  }
  return snapshot;
}
export async function receiptCount(db, actor, key) {
  const row = await deadline('actual native original actor/key receipt count', () => db.prepare('SELECT count(*) n FROM command_receipts WHERE actor_id=? AND key=?').bind(actor, key).first(), BODY_DEADLINE_MS);
  return nativeCount(row);
}
