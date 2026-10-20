// SAHA-125 / APL-148: sensitive classes and proxy authority remain purpose, time and version bound.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.saha-125-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };

try {
  for (const f of readdirSync('lib/saha').filter(x => x.endsWith('.ts')).map(x => x.slice(0, -3)))
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const household = await import(pathToFileURL(join(dir, 'household.js')));
  const rights = await import(pathToFileURL(join(dir, 'rights.js')));
  const now = '2026-10-20T06:00:00.000Z';
  const actor = { userId: 'asha', displayName: 'Synthetic ASHA', email: 'asha@example.invalid' };
  const member = { userId: 'asha', displayName: 'Synthetic ASHA', accountCode: 'A', role: 'asha', isOwner: false, status: 'active', version: 1, teamIds: ['t'], createdAt: now };
  const base = { sex: 'Female', village: 'Synthetic', task: 'Home visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId: 't', assignedTo: 'asha' };
  const subject = { ...base, id: 'subject', name: 'Synthetic Subject', age: 28, programmes: ['Maternal care'], followUps: [{ id: 'f', enrolmentId: 'e', packId: 'maternal', title: 'Antenatal check', due: '2026-10-25', ownerId: 'asha', state: 'open' }] };
  const proxy = { ...base, id: 'proxy', name: 'Synthetic Proxy', age: 31, programmes: ['General care'] };
  const h = { id: 'household', version: 1, label: 'Synthetic household', teamId: 't', createdAt: now, createdBy: 'asha', members: [subject, proxy].map(p => ({ personId: p.id, relationship: p.id === 'subject' ? 'spouse' : 'head', from: '2026-10-01', addedBy: 'asha', addedAt: now })) };
  const state = { organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [{ id: 't', name: 'Team', createdAt: now }], invitations: [], members: [member], households: [h], operations: { version: 1, maintenance: false, reason: '', updatedAt: now, incidents: [], rates: null, rightsPolicies: [{ version: 1, rules: ['access','correction','restriction','deletion','grievance'].map(kind => ({ kind, dueDays: 30 })), responsibleOrganisation: 'Synthetic accountable health organisation', grievanceEscalationOrganisation: 'Synthetic grievance office', grievanceEscalationDays: 7, identityMethods: ['in-person-document','representative-grant'], basis: 'SYNTH-SAHA-125-POLICY', setBy: 'owner', setAt: now }] }, workspace: { schemaVersion: 1, revision: 1, role: 'asha', integrations: [], receipts: {}, audit: [], referrals: [], visits: [], submissions: [], people: [subject, proxy] } };
  const grant = (over = {}) => ({ type: 'proxyGrant', personId: subject.id, version: subject.version, proxyPersonId: proxy.id, relationship: 'spouse', purposes: ['care-coordination'], classes: ['maternal'], evidence: 'SYNTH-AUTHORITY', expiresAt: '2026-11-20T06:00:00.000Z', ...over });
  const create = (over = {}) => ({ type: 'rightsCreate', personId: subject.id, kind: 'grievance', channel: 'in-person', requester: 'proxy', proxyGrantId: subject.proxies?.[0]?.id ?? 'missing', identityMethod: 'representative-grant', identityEvidence: 'Authority evidence checked', detail: 'Representative reports a missed home visit', ...over });

  check(() => assert.deepEqual(household.sensitiveClasses(subject), ['maternal']));
  check(() => { const before = JSON.stringify(subject); status(() => household.applyHousehold(state, grant({ classes: ['child'] }), actor, member, now), 422); assert.equal(JSON.stringify(subject), before, 'an inapplicable future class must not mutate the patient'); });
  const created = household.applyHousehold(state, grant(), actor, member, now);
  check(() => { assert.ok(created.grantId); assert.equal(subject.version, 2); assert.equal(subject.proxies.length, 1); assert.deepEqual(subject.proxies[0].classes, ['maternal']); });
  check(() => status(() => household.applyHousehold(state, grant({ version: 1 }), actor, member, now), 409));

  const grievance = rights.applyRights(state, create({ proxyGrantId: created.grantId }), actor, member, now);
  check(() => { assert.ok(grievance.requestId); assert.equal(state.rightsRequests.length, 1); assert.equal(state.rightsRequests[0].kind, 'grievance'); });
  check(() => { for (const kind of ['access', 'correction', 'restriction', 'deletion']) { const before = state.rightsRequests.length; status(() => rights.applyRights(state, create({ proxyGrantId: created.grantId, kind, detail: `Representative asks for ${kind} of confidential history` }), actor, member, now), 403); assert.equal(state.rightsRequests.length, before); } });

  const active = subject.proxies[0];
  check(() => { active.from = '2026-10-21T06:00:00.000Z'; status(() => rights.applyRights(state, create({ proxyGrantId: active.id }), actor, member, now), 422); active.from = now; });
  check(() => { active.expiresAt = now; status(() => rights.applyRights(state, create({ proxyGrantId: active.id }), actor, member, now), 422); active.expiresAt = '2026-11-20T06:00:00.000Z'; });
  check(() => { active.revokedAt = now; status(() => rights.applyRights(state, create({ proxyGrantId: active.id }), actor, member, now), 422); delete active.revokedAt; });
  check(() => { const future = { ...active, id: 'future', from: '2026-10-21T06:00:00.000Z' }; subject.proxies.push(future); assert.deepEqual(rights.rightsView(state, member, subject.id, now).proxies.map(x => x.id), [active.id]); subject.proxies.pop(); });

  check(() => { active.classes = []; const shared = household.shareable(state, h, proxy, 'care-coordination', now).members.find(x => x.personId === subject.id); assert.ok(shared); assert.deepEqual(shared.items.map(x => x.title), ['Home visit'], 'maternal work stays hidden when the class is absent'); active.classes = ['maternal']; });
  check(() => { const shared = household.shareable(state, h, proxy, 'care-coordination', now).members.find(x => x.personId === subject.id); assert.deepEqual(shared.items.map(x => x.title), ['Antenatal check', 'Home visit']); assert.equal(household.shareable(state, h, proxy, 'appointments', now).members.some(x => x.personId === subject.id), false); });

  check(() => status(() => household.applyHousehold(state, { type: 'proxyRevoke', personId: subject.id, version: 1, grantId: active.id, reason: 'Synthetic stale withdrawal' }, actor, member, now), 409));
  household.applyHousehold(state, { type: 'proxyRevoke', personId: subject.id, version: 2, grantId: active.id, reason: 'Synthetic authority withdrawn' }, actor, member, now);
  check(() => { assert.equal(subject.version, 3); assert.equal(active.revokedAt, now); assert.equal(household.shareable(state, h, proxy, 'care-coordination', now).members.some(x => x.personId === subject.id), false); });
  check(() => { const app = readFileSync('app/rights-panel.tsx', 'utf8'); assert.match(app, /does not authorise access to or changes to confidential history/); assert.match(app, /kind!=='grievance'/); });

  const result = { suite: 'SAHA-125 sensitive data and proxy contract', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/saha-125-sensitive-proxy-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
