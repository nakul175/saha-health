// Slice 14b: dates on the person record through the real Worker and local D1 in Miniflare. Synthetic people only, no external delivery.
import assert from 'node:assert/strict';
import { identity, client } from './lib/worker.mjs';
import { startMiniflare } from './lib/miniflare.mjs';

const w = await startMiniflare({ port: 20741, name: 'person-dates', bindings: { SAHA_EXTERNAL_APIS_ENABLED: 'false' } });
let passed = 0;
const check = (v, msg) => { assert.ok(v, msg); passed++; };
const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
try {
  const api = client(w.base);
  const o = identity('person-dates-owner'), org = (await api.get(o, '/api/workspace')).json.organisation.id;
  const cmd = async (body, status = 200) => { const r = await api.command(o, body, org); check(r.status === status, `${body.type} expected ${status}, got ${r.status}: ${r.text}`); return r.json; };
  const snap = async () => (await api.get(o, '/api/workspace', org)).json;
  const team = (await cmd({ type: 'createTeam', name: 'Synthetic dates team' })).result.teamId;
  const s0 = await snap(), me = s0.members.find(x => x.userId === o.id);
  await cmd({ type: 'updateMember', userId: o.id, version: me.version, role: 'asha', teamIds: [team], isOwner: true, status: 'active', reason: 'Synthetic dates fixture' });
  const pid = (await cmd({ type: 'createPerson', name: 'Dates Person', age: 24, sex: 'Female', village: 'Synthetic locality', programme: 'Maternal care', teamId: team })).result.personId;
  const person = async () => (await snap()).people.find(p => p.id === pid);
  const rec = async (over, status = 200) => cmd({ type: 'personDateRecord', personId: pid, version: (await person()).version, kind: 'lmp', value: day(-90), source: 'reported', ...over }, status);

  const r1 = await rec({});
  check(r1.result.ok === true && r1.result.warnings.length === 0, 'first LMP recorded without warning');
  let p = await person();
  check(p.dateEntries.length === 1 && p.dateEntries[0].value === day(-90) && p.dateEntries[0].kind === 'lmp', 'entry is on the person record');
  // Refusals
  await cmd({ type: 'personDateRecord', personId: pid, version: 1, kind: 'dob', value: '2002-01-01', source: 'document' }, 409);
  await rec({ value: day(1) }, 422);
  await rec({ value: day(-80) }, 422);            // replacement without a reason
  await rec({ value: day(-400) }, 422);           // older than 320 days
  await rec({ kind: 'edd', value: '2026-02-30' }, 422);
  await cmd({ type: 'personDateRecord', personId: pid, version: (await person()).version, kind: 'lmp', value: day(-80), source: 'reported', location: '1,2' }, 422); // strict schema
  p = await person(); check(p.dateEntries.length === 1, 'refused commands wrote nothing');
  // Replacement keeps history; EDD disagreeing with LMP warns but is kept
  await rec({ value: day(-80), source: 'document', reason: 'Card shows a later date' });
  p = await person(); check(p.dateEntries.length === 2 && p.dateEntries[1].supersedes === p.dateEntries[0].id && p.dateEntries[0].value === day(-90), 'history is kept');
  const w1 = await rec({ kind: 'edd', value: day(150) });
  check(w1.result.warnings.length === 1, 'an EDD more than 14 days from LMP+280 warns');
  // Audit is neutral
  const rows = (await snap()).audit?.filter(x => x.personId === pid && /^personDate/.test(x.action)) ?? [];
  check(rows.length >= 3 && rows.every(x => !/lmp|edd|\d{4}-\d{2}-\d{2}/i.test(x.detail)), 'audit detail names neither kind nor value');
  // Withdrawal
  p = await person();
  await cmd({ type: 'personDateWithdraw', personId: pid, version: p.version, entryId: p.dateEntries.at(-1).id, reason: 'Entered on the wrong person' });
  p = await person(); check(p.dateEntries.length === 3 && p.dateEntries.at(-1).withdrawn?.reason === 'Entered on the wrong person', 'withdrawal keeps the entry');
  await cmd({ type: 'personDateWithdraw', personId: pid, version: p.version, entryId: p.dateEntries.at(-1).id, reason: 'Entered on the wrong person' }, 409);
  console.log(JSON.stringify({ passed, failed: 0, skipped: 0 }));
} finally { await w.stop(); }
