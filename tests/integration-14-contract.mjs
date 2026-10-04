// Integration 14 contract: the seams where the seven round-14 slices (14a-14g) meet. Each check here is about the union, not about
// one slice: the migration chain, the shared module names, the inventory of outbound commands, the representative's permission
// under a notice (14b with 14d), and the consent-panel form that sends both. Slice-level behaviour stays in each slice's contract.
// The 14c seams (lapsed sharing permission, processing restriction on an EHR amendment) are in tests/withdrawal-contract.mjs.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const lib = 'lib/saha';
const dir = mkdtempSync(join(process.cwd(), '.integration-14-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code, pattern) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of readdirSync(lib).filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, f.replace(/\.ts$/, '') + '.js'), ts.transpileModule(readFileSync(`${lib}/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const imp = f => import(pathToFileURL(join(dir, f + '.js')));
  const [C, A, Core, R, WN] = await Promise.all(['consent', 'access', 'core', 'export-routes', 'withdrawal-notices'].map(imp));

  // 1. Migrations: 0018, 0020, 0021 and 0022 keep their numbers (0019 is unused); one ordered journal; one snapshot chain.
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')).entries;
  const sql = readdirSync('drizzle').filter(f => f.endsWith('.sql')).map(f => f.replace(/\.sql$/, '')).sort();
  check(() => { assert.deepEqual(journal.map(e => e.idx), journal.map((_, i) => i), 'idx counts up from 0 with no gap'); assert.deepEqual(journal.map(e => e.tag), sql, 'the journal lists every migration file, in order'); });
  check(() => { assert.deepEqual(journal.slice(-4).map(e => e.tag), ['0018_limit_slots', '0020_field_device', '0021_disposal', '0022_export_suppression']); assert.ok(!sql.some(t => t.startsWith('0019')), '0019 stays unused'); });
  check(() => { for (let i = 1; i < journal.length; i++) assert.ok(journal[i].when > journal[i - 1].when, `${journal[i].tag} is later than ${journal[i - 1].tag}`); });
  check(() => {
    const snap = tag => JSON.parse(readFileSync(`drizzle/meta/${tag.slice(0, 4)}_snapshot.json`, 'utf8'));
    for (let i = 1; i < journal.length; i++) { const a = snap(journal[i - 1].tag), b = snap(journal[i].tag); assert.equal(b.prevId, a.id, `${journal[i].tag} follows ${journal[i - 1].tag}`); for (const t of Object.keys(a.tables)) assert.ok(t in b.tables, `${journal[i].tag} keeps table ${t}`); }
    const last = snap('0022'); for (const t of ['limit_slots', 'field_sync_reports', 'disposals', 'held_exports']) assert.ok(t in last.tables, `the last snapshot has ${t}`);
    assert.equal(Object.keys(last.tables).length, 38);
  });
  check(() => { const src = readFileSync('lib/saha/data-exit.ts', 'utf8'); assert.match(src, /SCHEMA_MIGRATION = '0022_export_suppression'/); assert.equal(journal.at(-1).tag, '0022_export_suppression'); });
  check(() => { const src = readFileSync('lib/saha/data-exit.ts', 'utf8'); for (const t of ['field_sync_reports', 'disposals', 'held_exports', 'limit_slots']) assert.ok(src.includes(`'${t}'`), `data-exit.ts lists ${t} (as a table or as left out)`); });

  // 2. Two modules once exported a function called noticesOf with different meanings.
  check(() => { assert.equal(typeof Core.noticesOf, 'function'); assert.equal(Core.noticesOf({ operations: { consentNotices: [1] } }).length, 1, 'core: the organisation\'s consent notices'); assert.equal('noticesOf' in WN, false, 'withdrawal-notices no longer exports noticesOf'); assert.equal(typeof WN.withdrawalNoticesOf, 'function'); assert.deepEqual(WN.withdrawalNoticesOf({}), []); });

  // 3. Every route, file source, screen and outbound command of 14a-14f is classified (14g's completeness contract covers the rest).
  check(() => {
    for (const k of ['GET /api/field-device', 'POST /api/field-device', 'GET /api/retention/disposal-register', 'GET /api/exports', 'POST /api/exports']) assert.ok(k in R.ROUTES, k);
    assert.ok('lib/saha/disposal-server.ts' in R.DISPOSITION_SOURCES && 'app/retention-panel.tsx' in R.CLIENT_DOWNLOADS);
    assert.equal(R.ROUTES['GET /api/retention/disposal-register'].kind, 'file-export');
    const all = readdirSync(lib).filter(f => f.endsWith('.ts')).map(f => readFileSync(`${lib}/${f}`, 'utf8')).join('\n');
    for (const name of Object.keys(R.OTHER_OUTBOUND_COMMANDS)) assert.ok(all.includes(`z.literal('${name}')`), `${name} is a real command`);
    for (const name of ['executeWithdrawal', 'sendWithdrawalNotice']) assert.equal(R.OTHER_OUTBOUND_COMMANDS[name].carries, 'record');
  });

  // 4. 14b with 14d: a representative's permission is given under the notice in force, and records both who decided and the terms.
  const now = '2026-10-04T06:00:00.000Z', at = d => new Date(Date.parse(now) + d * 86400000).toISOString(), earlier = at(-10);
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: earlier, ...over });
  const base = { sex: 'Unknown', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: false, createdAt: earlier, version: 1, teamId: 't1', assignedTo: 'asha' };
  const P = { ...base, id: 'P', name: 'Adult P', age: 40, householdId: 'h1' }, Rep = { ...base, id: 'H', name: 'Relative H', age: 45, householdId: 'h1' };
  P.proxies = [{ id: 'gp', proxyPersonId: 'H', relationship: 'sibling', authority: 'nominated', purposes: ['consent-decisions'], classes: [], evidence: 'Synthetic nomination', from: earlier, expiresAt: at(30), grantedBy: 'asha', grantedAt: earlier }];
  const notice = (over = {}) => ({ id: 'n1', purpose: 'exchange', version: 1, effectiveFrom: earlier, material: false, texts: { en: 'Synthetic notice text for external record sharing, long enough to read.', hi: 'सिंथेटिक सूचना' }, summary: 'First', review: 'Synthetic reviewer', publishedAt: earlier, publishedBy: 'own', publishedByName: 'OWN', ...over });
  const s = {
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: earlier }, teams: [{ id: 't1', name: 'One', createdAt: earlier }], invitations: [],
    members: [member('asha', 'asha', ['t1']), member('doc', 'clinician', ['t1'])], operations: { consentNotices: [notice()] },
    households: [{ id: 'h1', version: 1, label: 'Synthetic', teamId: 't1', createdAt: earlier, createdBy: 'asha', members: ['P', 'H'].map(personId => ({ personId, relationship: 'other', from: '2026-09-01', addedBy: 'asha', addedAt: earlier })) }],
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [], referrals: [], visits: [], submissions: [], people: [P, Rep] },
  };
  const as = userId => { const m = s.members.find(x => x.userId === userId); s.workspace.role = m.role; for (const p of s.workspace.people) p.assigned = A.allowed(m, p); return m; };
  const consent = (userId, cmd, when = now) => { const m = as(userId); return C.applyConsent(s, cmd, { userId, displayName: userId.toUpperCase(), email: 'x@example.invalid' }, m, when); };
  const rep = { grantId: 'gp', proxyPersonId: 'H' }, give = over => ({ type: 'setConsent', personId: 'P', purpose: 'exchange', active: true, version: P.version, representative: rep, ...over });
  // A refused command is never committed (the server works on a copy), so the harness rolls the record back after each refusal.
  const refused = (fn, code, pattern) => { const snap = structuredClone(P), n = s.workspace.audit.length; try { return status(fn, code, pattern); } finally { for (const k of Object.keys(P)) delete P[k]; Object.assign(P, snap); s.workspace.audit.length = n; } };
  check(() => {
    refused(() => consent('asha', give()), 409, /Show the person the current external record sharing notice \(version 1\)/);
    refused(() => consent('asha', give({ notice: { id: 'old', language: 'en' } })), 409, /now version 1/);
    refused(() => consent('asha', give({ notice: { id: 'n1', language: 'hi' }, representative: { grantId: 'nope', proxyPersonId: 'H' } })), 422);
    assert.equal(P.consentHistory, undefined, 'refusals record nothing');
  });
  check(() => {
    const r = consent('asha', give({ notice: { id: 'n1', language: 'hi' } })), e = P.consentHistory.at(-1);
    assert.equal(r.decidedBy, 'representative'); assert.equal(e.decidedBy, 'representative'); assert.equal(e.representative.proxyPersonId, 'H');
    assert.deepEqual(e.notice, { id: 'n1', version: 1, language: 'hi' }); assert.equal(e.expiresAt, at(Core.CONSENT_PERIOD_DAYS.exchange));
    const actions = s.workspace.audit.map(a => a.action); assert.ok(actions.includes('proxyUse') && actions.includes('consentTerms') && actions.includes('setConsent'), actions.join());
    assert.equal(Core.consentStanding(P, 'exchange', now, Core.noticesOf(s)).state, 'in-force');
  });
  // The representative renews a lapsed permission under a material notice, as the person would.
  check(() => {
    s.operations.consentNotices.push(notice({ id: 'n2', version: 2, material: true, effectiveFrom: at(1), texts: { en: 'Second notice text, material, for external record sharing.' } }));
    const later = at(2);
    assert.equal(Core.consentStanding(P, 'exchange', later, Core.noticesOf(s)).state, 'renewal-needed');
    refused(() => consent('asha', give({ notice: { id: 'n1', language: 'en' } }), later), 409, /now version 2/);
    const r = consent('asha', give({ notice: { id: 'n2', language: 'en' } }), later), e = P.consentHistory.at(-1);
    assert.equal(r.decidedBy, 'representative'); assert.equal(e.notice.version, 2); assert.equal(e.renews.state, 'renewal-needed');
    assert.equal(Core.consentStanding(P, 'exchange', later, Core.noticesOf(s)).state, 'in-force');
  });

  // 5. The consent-panel form for a representative shows the notice and sends it (the form lists lapsed permissions too).
  check(() => {
    const src = readFileSync('app/consent-panel.tsx', 'utf8');
    assert.match(src, /noticeInForce\(list,/); assert.match(src, /data-testid="representative-notice"/); assert.match(src, /notice:\{id:giveNotice\.id,language:giveLang\}/); assert.match(src, /consentStanding\(p,x,now,list\)\.state!=='in-force'/);
    assert.match(src, /\.\.\.representative\(giveBy\)/); assert.match(src, /Language the notice was shown in/);
  });
  // 6. The withdrawal seams are code, not only tests (the behaviour is in withdrawal-contract.mjs).
  check(() => { const src = readFileSync('lib/saha/withdrawal.ts', 'utf8'); assert.match(src, /consentStanding\(p,'exchange',now,noticesOf\(s\)\)/); assert.match(src, /activeRestriction/); assert.match(src, /amendRestricted\(p,c\)/); });

  // 7. 14g: an anonymous POST /api/exports is a 401 (the authorisation matrix found a 422 about the body), so the caller is identified first.
  check(() => { const src = readFileSync('lib/saha/held-exports-server.ts', 'utf8'), post = src.slice(src.indexOf('export async function heldExportsPost')); assert.ok(post.indexOf('await identity()') > 0 && post.indexOf('await identity()') < post.indexOf('boundedJsonBody'), 'identity() runs before the body is read'); });

  writeFileSync('tests/integration-14-contract-result.json', JSON.stringify({ passed, suite: 'integration-14-contract', completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, suite: 'integration-14-contract' }));
} finally { rmSync(dir, { recursive: true, force: true }); }
