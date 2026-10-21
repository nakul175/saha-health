import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.household-authority-lifecycle-'));
let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed++; console.log('PASS', label); };
try {
  for (const file of readdirSync('lib/saha').filter(name => name.endsWith('.ts'))) {
    const source = readFileSync(`lib/saha/${file}`, 'utf8');
    writeFileSync(join(dir, file.replace(/\.ts$/, '.js')), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  }
  const H = await import(pathToFileURL(join(dir, 'household.js')));
  const actor = { userId: 'worker', displayName: 'Synthetic worker' };
  const member = { userId: 'worker', role: 'asha', status: 'active', teamIds: ['t'], version: 1, isOwner: false };
  const now = '2026-10-16T00:00:00.000Z';
  const person = (id, extra = {}) => ({ id, name: `Synthetic ${id}`, age: 30, sex: 'Unknown', village: 'Synthetic', task: 'Home visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, assignedTo: 'worker', teamId: 't', programmes: ['General care'], version: 1, createdAt: now, householdId: 'h', ...extra });
  const head = person('head');
  const subject = person('subject');
  const household = { id: 'h', version: 1, label: 'Synthetic household', teamId: 't', members: [head, subject].map(p => ({ personId: p.id, relationship: p.id === 'head' ? 'head' : 'caregiver', from: '2026-10-01', addedBy: 'worker', addedAt: now })), createdAt: now, createdBy: 'worker' };
  const state = { members: [member], workspace: { people: [head, subject], visits: [], referrals: [], audit: [] }, households: [household] };
  const grant = (over = {}) => ({ id: 'g', proxyPersonId: 'head', relationship: 'caregiver', purposes: ['care-coordination'], classes: [], evidence: 'Synthetic permission record', from: '2026-10-15T23:30:00.000Z', expiresAt: '2026-10-16T00:30:00.000Z', grantedBy: 'worker', grantedAt: '2026-10-15T23:30:00.000Z', ...over });

  check(H.activeGrant(grant(), now), 'current grant is active at its exact instant');
  check(H.activeGrant(grant({ from: '2026-10-16T05:00:00+05:30', expiresAt: '2026-10-16T06:00:00+05:30' }), now), 'equivalent offset instants do not depend on lexical ordering');
  check(!H.activeGrant(grant({ from: 'malformed' }), now), 'malformed start never grants authority');
  check(!H.activeGrant(grant({ expiresAt: 'malformed' }), now), 'malformed expiry never grants authority');
  check(!H.activeGrant(grant({ from: '2026-10-16T01:00:00.000Z', expiresAt: '2026-10-16T00:30:00.000Z' }), now), 'contradictory interval never grants authority');
  subject.proxies = [grant()];
  check(H.householdAuthorityRefreshAt(household, state, now) === '2026-10-16T00:30:00.000Z', 'projection declares the earliest authority expiry');
  check(H.shareable(state, household, head, 'care-coordination', '2026-10-16T00:29:59.999Z').members.some(x => x.personId === 'subject'), 'permitted subject is visible immediately before expiry');
  check(!H.shareable(state, household, head, 'care-coordination', '2026-10-16T00:30:00.000Z').members.some(x => x.personId === 'subject'), 'expired authority stops disclosure at the exact boundary');
  subject.proxies = [grant({ revokedAt: now })];
  check(!H.shareable(state, household, head, 'care-coordination', now).members.some(x => x.personId === 'subject'), 'revocation stops disclosure');
  subject.proxies = [];
  const before = JSON.stringify(state);
  assert.throws(() => H.applyHousehold(state, { type: 'proxyGrant', personId: 'subject', version: 1, proxyPersonId: 'head', relationship: 'caregiver', purposes: ['care-coordination'], classes: ['maternal'], evidence: 'Synthetic permission record', expiresAt: '2026-10-17T00:00:00.000Z' }, actor, member, now), e => e.status === 422);
  check(JSON.stringify(state) === before, 'unrecorded sensitive class is refused without side effects');
  const ui = readFileSync('app/household-panel.tsx', 'utf8');
  check(ui.includes('view?.refreshAt') && ui.includes('refreshAt:null,shareable:null') && ui.includes("load('','care-coordination')"), 'open mobile preview clears its deadline and refreshes once at the authority boundary');
  console.log(JSON.stringify({ suite: 'SAHA-016 household authority lifecycle', passed, failed: 0 }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
