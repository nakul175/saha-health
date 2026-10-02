// Slice 6u fourth-review-fixes contract: regressions for defects a fourth independent review found in code already
// on GitHub main (reproductions in /tmp/claude-0/review4/*.mjs, 1 October 2026). Each numbered block fails on the
// code before 6u; run it from an export of the base tree with REPORT_ALL=1 to list every failing check.
//  1. Emergency-access guard resolves outreach plan and item references (and messageCreate).
//  2. Retention review shows only id, scope and times for holds on patients outside the viewer's scope.
//  3. Data exit scopes team-scoped rows (household members, caseload transfer patients); the verifier checks them.
//  5. Pilot and expansion exports commit their audit event through recordExportAudit (retry with authority recheck).
//  6. The programme callback is authenticated (grant, signature) before organisation data is read; one uniform refusal.
//  7. A processing restriction pauses FHIR downloads.
//  8. The merge view withholds reason and evidence when the counterpart record is outside the viewer's scope.
//  9. The ABHA duplicate check answers neutrally when the other record is outside the worker's scope.
// (4, the EHR publication refused before sending, is covered in tests/ehr-execution.mjs.)
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

const lib = 'lib/saha';
const dir = mkdtempSync(join(process.cwd(), '.fourth-review-fixes-contract-'));
let passed = 0;
const failed = [];
const fail = (name, e) => { if (process.env.REPORT_ALL) { failed.push(`${name}: ${String(e?.message ?? e).split('\n')[0]}`); return; } e.message = `${name}: ${e.message}`; throw e; };
const check = (name, fn) => { try { fn(); passed++; } catch (e) { fail(name, e); } };
const checkAsync = async (name, fn) => { try { await fn(); passed++; } catch (e) { fail(name, e); } };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
const statusAsync = async (fn, code) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
const sha = b => createHash('sha256').update(b).digest('hex');

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  exec() { const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.db, sql); }
  async batch(statements) { this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}

try {
  // Every library module is transpiled; `server` (Next.js runtime) and `store.persist` are replaced by stubs below.
  for (const f of readdirSync(lib).filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, (f === 'store.ts' ? 'store-real' : f.replace(/\.ts$/, '')) + '.js'), ts.transpileModule(readFileSync(`${lib}/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  // The real store keeps every export; persist is replaced by a test double that can inject commit conflicts.
  writeFileSync(join(dir, 'store.js'), `export * from './store-real.js';
import { AppError } from './core.js';
export const calls = { persist: [], conflicts: 0 };
export async function persist(db, before, after, u, c) { calls.persist.push({ type: c.type, audit: after.workspace.audit.at(-1) }); if (calls.conflicts > 0) { calls.conflicts--; throw new AppError(409, 'Injected commit conflict'); } return { ok: true }; }`);
  writeFileSync(join(dir, 'server.js'), `export const harness = { state: null, reload: null, loads: 0, user: { userId: 'owner', displayName: 'Synthetic owner', email: 'x@example.invalid' } };
export async function identity() { return harness.user; }
export async function loadFor() { harness.loads++; return structuredClone(harness.loads > 1 && harness.reload ? harness.reload() : harness.state); }
export function db() { return {}; }
export function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }`);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const imp = f => import(pathToFileURL(join(dir, f + '.js')));
  const [E, A, , Ret, DX, P, OS, MC, Rights, M, B, St, Srv, Seed] = await Promise.all(['exceptional', 'access', 'outreach', 'retention', 'data-exit', 'pilot-server', 'outreach-server', 'mis-callback', 'rights', 'merge', 'abdm', 'store', 'server', 'seed'].map(imp));
  const now = new Date().toISOString(), until = new Date(Date.now() + 3600e3).toISOString();
  const member = x => ({ status: 'active', version: 1, isOwner: false, displayName: x.userId, accountCode: 'CODE' + x.userId, createdAt: now, ...x });
  const P_ = (id, x) => ({ id, name: 'Synthetic ' + id, age: 40, sex: 'Female', village: 'V', programmes: ['General care'], version: 1, teamId: 't1', status: 'due', due: 'Today', assignedTo: null, createdAt: now, ...x });
  const visible = (s, m) => { for (const p of s.workspace.people) p.assigned = A.allowed(m, p); };

  // 1. Emergency access: owner-clinician doc (team t1) reaches x (team t2) only through an emergency grant.
  {
    const doc = member({ userId: 'doc', role: 'clinician', isOwner: true, teamIds: ['t1'] }), docN = member({ userId: 'docN', role: 'clinician', teamIds: ['t1'] }), doc2 = member({ userId: 'doc2', role: 'clinician', teamIds: ['t1'] }), asha2 = member({ userId: 'asha2', role: 'asha', teamIds: ['t2'] });
    const grant = u => ({ id: 'g' + u, userId: u, reason: 'r'.repeat(20), from: now, until });
    const x = P_('x', { teamId: 't2', assignedTo: 'asha2', exceptionalAccess: [grant('doc'), grant('docN')] }), own = P_('own', { assignedTo: null });
    const plan = { id: 'pl', version: 1, title: 'Camp', date: now.slice(0, 10), teamId: 't2', criteria: 'c', createdAt: now, createdBy: 'asha2', state: 'scheduled', items: [{ id: 'it', personId: 'x', ownerId: 'asha2', reason: 'TB follow-up', state: 'planned', events: [] }], history: [] };
    const ownPlan = { ...structuredClone(plan), id: 'pl2', teamId: 't1', items: [{ id: 'it2', personId: 'own', ownerId: 'doc', reason: 'Follow-up', state: 'planned', events: [] }] };
    const s = { organisation: { id: 'o' }, teams: [{ id: 't1' }, { id: 't2' }], members: [doc, docN, doc2, asha2], outreach: { plans: [plan, ownPlan], messages: [], templates: [] }, workspace: { people: [x, own], visits: [], referrals: [], submissions: [], audit: [], role: 'clinician' } };
    check('control: a command naming the grant-only patient directly is refused', () => status(() => E.ensureExceptionalScope(s, doc, { type: 'setContactPreferences', personId: 'x' }), 403));
    check('outreachAssign on a grant-only patient\'s item is refused', () => status(() => E.ensureExceptionalScope(s, doc, { type: 'outreachAssign', planId: 'pl', itemId: 'it', version: 1, ownerId: 'asha2', reason: 'moving it to another worker' }), 403));
    check('outreachRecord cancelling a grant-only patient\'s item is refused', () => status(() => E.ensureExceptionalScope(s, doc, { type: 'outreachRecord', planId: 'pl', itemId: 'it', version: 1, state: 'cancelled', note: 'not needed any more', reference: 'ref' }), 403));
    check('outreachTransition cancelling a plan holding a grant-only patient is refused', () => status(() => E.ensureExceptionalScope(s, doc, { type: 'outreachTransition', planId: 'pl', version: 1, state: 'cancelled', reason: 'cancel whole plan' }), 403));
    check('messageCreate for a grant-only patient\'s item is refused (non-owner clinician)', () => status(() => E.ensureExceptionalScope(s, docN, { type: 'messageCreate', planId: 'pl', itemId: 'it', templateId: 't', scheduledAt: until }), 403));
    check('control: a plan with only normally visible patients is not blocked', () => E.ensureExceptionalScope(s, doc, { type: 'outreachTransition', planId: 'pl2', version: 1, state: 'cancelled', reason: 'cancel own plan' }));
    check('control: a clinician without the grant is not blocked by this check', () => E.ensureExceptionalScope(s, doc2, { type: 'outreachRecord', planId: 'pl', itemId: 'it', version: 1, state: 'attempted', note: 'tried', reference: 'ref' }));
  }

  // 2. Retention review: owner B (team t1) and an administrator-role owner; y (team t2) is outside both scopes.
  {
    const ownerB = member({ userId: 'B', role: 'clinician', isOwner: true, teamIds: ['t1'] }), admin = member({ userId: 'adm', role: 'admin', isOwner: true, teamIds: ['t1', 't2'] });
    const y = P_('y', { teamId: 't2' }), z = P_('z', { teamId: 't1' });
    const s = () => ({ organisation: { id: 'o' }, teams: [{ id: 't1' }, { id: 't2' }], members: [ownerB, admin], retention: { policies: [], holds: [{ id: 'h1', scope: 'person', personId: 'y', reason: 'SECRET-HOLD-REASON subpoena', reference: 'COURT-REF-42', placedBy: 'A', placedAt: now }, { id: 'h2', scope: 'person', personId: 'z', reason: 'Visible hold reason', reference: 'REF-Z', placedBy: 'B', placedAt: now }, { id: 'h3', scope: 'organisation', reason: 'Organisation-wide audit hold', reference: 'ORG-REF', placedBy: 'B', placedAt: now }] }, workspace: { people: [structuredClone(y), structuredClone(z)], visits: [], submissions: [], referrals: [], audit: [] } });
    const sb = s(); visible(sb, ownerB);
    const v = Ret.retentionReview(sb, ownerB, { total: 0, pastSchedule: 0 }, now), out = v.holds.find(h => h.id === 'h1'), text = JSON.stringify(v.holds);
    check('hold on an out-of-scope patient withholds reason, reference and person id', () => { assert.ok(!text.includes('SECRET-HOLD-REASON') && !text.includes('COURT-REF-42'), text); assert.equal(out.personId, undefined); assert.equal(out.placedBy, undefined); assert.equal(out.outsideScope, true); assert.equal(out.scope, 'person'); assert.equal(out.placedAt, now); });
    check('the review counts holds outside scope', () => assert.equal(v.holdsOutsideScope, 1));
    check('control: in-scope and organisation holds keep their reason and reference', () => { const h2 = v.holds.find(h => h.id === 'h2'), h3 = v.holds.find(h => h.id === 'h3'); assert.equal(h2.reason, 'Visible hold reason'); assert.equal(h2.reference, 'REF-Z'); assert.equal(h2.personName, 'Synthetic z'); assert.equal(h3.reference, 'ORG-REF'); });
    const sa = s(); visible(sa, admin);
    check('an administrator-role owner sees no patient hold reasons', () => { const t = JSON.stringify(Ret.retentionReview(sa, admin, { total: 0, pastSchedule: 0 }, now).holds); assert.ok(!t.includes('SECRET-HOLD-REASON') && !t.includes('Visible hold reason'), t); });
  }

  // 3. Data exit: p_kamla moved to the north team (outside the exporter's scope) but is still in a default-team
  // household and in a default-team caseload transfer.
  {
    const verify = await import(pathToFileURL(join(process.cwd(), process.env.SAHA_SCRIPTS ?? 'scripts', 'verify-export.mjs')));
    const d1 = new D1();
    for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort()) for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
    const t0 = '2026-09-30T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'x@example.invalid' };
    d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'x@example.invalid', t0);
    const owner = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: t0 };
    const w = Seed.seedWorkspace(t0), kamla = w.people.find(p => p.id === 'p_kamla'), other = w.people.find(p => p.id !== 'p_kamla');
    kamla.teamId = 'north'; kamla.householdId = 'h1';
    const state = { organisation: { id: 'org_hh', name: 'HH org', revision: 1, createdAt: t0 }, teams: [{ id: 'default', name: 'Care team', createdAt: t0 }, { id: 'north', name: 'North team', createdAt: t0 }], members: [owner], invitations: [], workspace: w,
      households: [{ id: 'h1', version: 1, label: 'Home', teamId: 'default', createdAt: t0, createdBy: 'x', members: [{ personId: other.id, relationship: 'self', from: '2026-01-01', addedBy: 'x', addedAt: t0 }, { personId: 'p_kamla', relationship: 'spouse', from: '2026-01-01', addedBy: 'x', addedAt: t0, to: '2026-09-01', endedBy: 'x', endReason: 'SECRET-END-REASON moved out' }] }],
      caseloads: [{ id: 'ct1', version: 1, teamId: 'default', fromUserId: 'owner', toUserId: 'owner', personIds: [other.id, 'p_kamla'], effectiveAt: t0, reason: 'Synthetic caseload handover', state: 'applied', createdBy: 'owner', createdAt: t0, applied: { by: 'owner', at: t0, moved: [other.id, 'p_kamla'], skipped: [], assignments: { [other.id]: 'owner', p_kamla: 'owner' } } }] };
    await St.createState(d1, state, actor, 'createOrganisation');
    const ct = d1.db.prepare('SELECT count(*) AS n FROM caseload_transfers').get().n;
    if (!ct) d1.db.prepare('INSERT INTO caseload_transfers (org_id,id,version,team_id,state,created_at,data) VALUES (?,?,?,?,?,?,?)').run('org_hh', 'ct1', 1, 'default', 'applied', t0, JSON.stringify(state.caseloads[0]));
    const built = await DX.buildExport(d1, { orgId: 'org_hh', member: owner, exporter: { userId: 'owner', name: 'Synthetic owner', accountCode: 'CODE0000000000000000000A' }, exportId: 'e1', now: '2026-09-30T06:00:00.000Z', includeFhir: false, environment: 'synthetic' });
    const files = verify.readTar(Buffer.from(built.archive)), table = n => files.get(`tables/${n}.jsonl`).toString('utf8');
    check('control: the out-of-scope patient row is withheld', () => assert.ok(!table('patients').includes('p_kamla')));
    check('household export leaves out the out-of-scope member and its end reason', () => { const t = table('households'); assert.ok(t.includes(other.id), 'in-scope member kept'); assert.ok(!t.includes('p_kamla') && !t.includes('SECRET-END-REASON'), t); });
    check('caseload transfer export leaves out the out-of-scope patient', () => { const t = table('caseload_transfers'); assert.ok(t.includes('ct1')); assert.ok(!t.includes('p_kamla'), t); });
    check('the manifest counts the withheld entries and marks the export incomplete', () => { const f = built.manifest.files.find(x => x.table === 'households'), c = built.manifest.files.find(x => x.table === 'caseload_transfers'); assert.equal(f.withheldEntries, 1); assert.equal(c.withheldEntries, 3); assert.equal(built.manifest.scope.complete, false); assert.ok(built.manifest.scope.entriesWithheld >= 4); });
    check('control: the offline verifier accepts the scoped archive', () => { const r = verify.verifyFiles(files); assert.equal(r.ok, true, JSON.stringify(r.failures)); });
    // A forged archive whose household names a patient that is not exported is rejected by the verifier.
    const forged = new Map(files), hh = JSON.parse(table('households').split('\n')[0]), doc = JSON.parse(hh.data);
    doc.members.push({ personId: 'p_missing', relationship: 'child', from: '2026-01-01' }); hh.data = JSON.stringify(doc);
    forged.set('tables/households.jsonl', Buffer.from(JSON.stringify(hh) + '\n'));
    const manifest = JSON.parse(forged.get('manifest.json').toString('utf8')), entry = manifest.files.find(x => x.path === 'tables/households.jsonl');
    entry.bytes = forged.get('tables/households.jsonl').length; entry.sha256 = sha(forged.get('tables/households.jsonl'));
    forged.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
    forged.set('SHA256SUMS', Buffer.from([...forged.keys()].filter(p => p !== 'SHA256SUMS').map(p => `${sha(forged.get(p))}  ${p}`).join('\n') + '\n'));
    check('the verifier rejects a household naming a patient outside the export', () => { const r = verify.verifyFiles(forged); assert.equal(r.ok, false); assert.ok(r.checks.some(c => c.name === 'relationships' && !c.ok && /households\.data/.test(c.detail)), JSON.stringify(r.checks.filter(c => !c.ok))); });
  }

  // 5. Pilot dossier and expansion pack exports retry only the audit commit, with authority checked again.
  {
    const owner = member({ userId: 'owner', role: 'clinician', isOwner: true, teamIds: ['t1'] });
    const base = () => ({ organisation: { id: 'o', name: 'Synthetic org', revision: 1 }, teams: [{ id: 't1', name: 'T1' }], members: [structuredClone(owner)], invitations: [], workspace: { people: [], visits: [], referrals: [], submissions: [], integrations: [], audit: [], role: 'clinician' },
      expansions: [{ id: 'x1', version: 1, spec: { name: 'Synthetic expansion' }, ownerId: 'owner', reviewerId: 'owner', createdBy: 'owner', createdAt: now, state: 'draft', evidence: [] }] });
    const req = q => new Request('https://saha.example/api/x?' + q, { headers: { 'x-saha-organisation': 'o' } });
    for (const [label, call, action] of [['pilot dossier', () => P.pilotRead(req('format=export')), 'pilotExport'], ['expansion pack', () => OS.expansionRead(req('format=pack&id=x1')), 'expansionExport']]) {
      await checkAsync(`${label} export survives one concurrent commit and records its audit event once`, async () => {
        Srv.harness.state = base(); Srv.harness.reload = null; Srv.harness.loads = 0; St.calls.persist.length = 0; St.calls.conflicts = 1;
        const res = await call(); assert.equal(res.status, 200); assert.equal(St.calls.persist.length, 2); assert.equal(St.calls.persist[1].audit.action, action); assert.equal(St.calls.persist[0].audit.id, St.calls.persist[1].audit.id);
      });
      await checkAsync(`${label} export is refused when the exporter lost access before the retry`, async () => {
        Srv.harness.state = base(); Srv.harness.loads = 0; Srv.harness.reload = () => { const s = base(); s.members[0].isOwner = false; return s; }; St.calls.persist.length = 0; St.calls.conflicts = 1;
        await statusAsync(() => call(), 403); assert.equal(St.calls.persist.length, 1);
      });
    }
    Srv.harness.reload = null; St.calls.conflicts = 0;
  }

  // 6. Programme callback: grant and signature before any organisation read; one uniform refusal.
  {
    const grants = [{ organisationId: 'org', integrationId: 'mis1', origin: 'https://programme.example', credentialBinding: 'SAHA_MIS_TEST', callbackBinding: 'SAHA_MIS_CALLBACK' }];
    const env = { SAHA_EXTERNAL_APIS_ENABLED: 'true', SAHA_MIS_CONNECTIONS: JSON.stringify(grants), SAHA_MIS_TEST: 'test-secret', SAHA_MIS_CALLBACK: 'callback-test-secret' };
    const i = { id: 'mis1', kind: 'mis', mode: 'http', status: 'active', version: 1, endpoint: 'https://programme.example/receive', credentialBinding: 'SAHA_MIS_TEST' };
    const sign = async (raw, ts, secret = 'callback-test-secret') => { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return Buffer.from(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(ts + '.' + raw))).toString('hex'); };
    const body = (org, int) => ({ organisationId: org, integrationId: int, submissionId: 's1', receipt: { status: 'accepted' } });
    let reads = 0; const load = async (org, id) => { reads++; return org === 'org' && id === 'mis1' ? i : null; };
    const auth = MC.authenticateCallback, ts0 = String(Date.now());
    const refusal = async (b, sig) => { const e = await statusAsync(() => auth(JSON.stringify(b), b, ts0, sig, env, load), 401); return e.message; };
    await checkAsync('unknown organisation, unknown connection and a bad signature get the same refusal without any read', async () => {
      reads = 0; const raw = b => JSON.stringify(b);
      const a = await refusal(body('org_other', 'mis1'), await sign(raw(body('org_other', 'mis1')), ts0)), b = await refusal(body('org', 'mis_other'), await sign(raw(body('org', 'mis_other')), ts0)), c = await refusal(body('org', 'mis1'), await sign(raw(body('org', 'mis1')), ts0, 'wrong-secret'));
      assert.equal(a, b); assert.equal(b, c); assert.equal(reads, 0);
    });
    await checkAsync('a correctly signed callback reads one integration and is accepted', async () => { reads = 0; const b = body('org', 'mis1'), raw = JSON.stringify(b); const out = await auth(raw, b, ts0, await sign(raw, ts0), env, load); assert.equal(out.id, 'mis1'); assert.equal(reads, 1); });
    await checkAsync('disabled external services refuse with the same answer', async () => { const b = body('org', 'mis1'), raw = JSON.stringify(b); const e = await statusAsync(() => auth(raw, b, ts0, 'x', { ...env, SAHA_EXTERNAL_APIS_ENABLED: 'false' }, load), 401); assert.equal(e.message, MC.CALLBACK_REFUSED); });
    check('the route no longer reads the organisation before the signature check', () => { const src = readFileSync('app/api/mis/callback/route.ts', 'utf8'); assert.ok(src.indexOf('authenticateCallback(') > 0 && src.indexOf('authenticateCallback(') < src.indexOf('readState('), 'readState before authentication'); });
  }

  // 7. Processing restriction pauses FHIR downloads (either format) of the restricted patient's visits.
  {
    const p = P_('p', { restrictions: [{ id: 'rs', requestId: 'rq', at: now }] }), q = P_('q', {});
    const s = { outreach: { messages: [], plans: [] }, workspace: { people: [p, q], visits: [{ id: 'v1', personId: 'p' }, { id: 'v2', personId: 'q' }], referrals: [], submissions: [], audit: [] } };
    check('a FHIR download of a restricted patient\'s visit is refused', () => status(() => Rights.ensureNotRestricted(s, { type: 'exportFhir', visitId: 'v1' }), 409));
    check('control: another patient\'s FHIR download is not affected', () => Rights.ensureNotRestricted(s, { type: 'exportFhir', visitId: 'v2' }));
    check('the FHIR route applies the restriction check', () => assert.match(readFileSync('app/api/fhir/[id]/route.ts', 'utf8'), /ensureNotRestricted\(s,\{type:'exportFhir'/));
  }

  // 8. Merge view: a case whose counterpart is outside the viewer's scope.
  {
    const asha = member({ userId: 'asha', role: 'asha', teamIds: ['t1'] }), sup = member({ userId: 'sup', role: 'supervisor', teamIds: ['t1'] });
    const a = P_('a', { assignedTo: 'asha' }), b = P_('b', { assignedTo: 'other' });
    const k = { id: 'k1', version: 2, survivorId: 'a', duplicateId: 'b', state: 'merged', reason: 'SECRET-MERGE-REASON same mother name', evidence: 'SECRET-EVIDENCE card 77', proposedAt: now, proposedBy: 'sup', decided: { by: 'sup2', at: now, decision: 'approve', reason: 'SECRET-DECISION matched card' }, items: [] };
    const mk = () => ({ members: [asha, sup], identityCases: [structuredClone(k)], workspace: { people: [structuredClone(a), structuredClone(b)], visits: [], referrals: [], submissions: [], audit: [] } });
    const s1 = mk(); visible(s1, asha); const v = M.mergeView(s1, asha, 'a'), t = JSON.stringify(v);
    check('merge view withholds reason, evidence and decision reason when the counterpart is outside scope', () => { assert.ok(!t.includes('SECRET-'), t); assert.equal(v.cases[0].duplicate.id, null); assert.equal(v.cases[0].detailWithheld, true); assert.equal(v.cases[0].decided.decision, 'approve'); });
    const s2 = mk(); visible(s2, sup); const w = M.mergeView(s2, sup, 'a');
    check('control: a viewer who may see both records sees reason and evidence', () => { assert.equal(w.cases[0].reason, k.reason); assert.equal(w.cases[0].evidence, k.evidence); assert.equal(w.cases[0].decided.reason, k.decided.reason); });
  }

  // 9. ABHA link duplicate check: the other record holding the number is outside the worker's scope.
  {
    const own = member({ userId: 'own', role: 'clinician', isOwner: true, teamIds: ['t1'] }), asha = member({ userId: 'asha', role: 'asha', teamIds: ['t1'] });
    const mine = P_('mine', { assignedTo: 'asha' }), theirs = P_('theirs', { assignedTo: 'other', abha: { state: 'linked', number: '91-1234-5678-9012', at: now, by: 'x', history: [] } });
    const mk = () => { const s = { organisation: { id: 'o' }, members: [own, asha], teams: [{ id: 't1' }], workspace: { people: [structuredClone(mine), structuredClone(theirs)], visits: [], referrals: [], submissions: [], integrations: [], audit: [] } };
      B.applyAbdm(s, { type: 'abdmConfigure', environment: 'mock', modules: { abha: true, hip: false, hiu: false }, facilityId: 'FAC-SYNTH', approvals: [{ module: 'abha', reference: 'APPROVAL-SYNTH' }], reason: 'Synthetic mock gateway configuration' }, { userId: 'own', displayName: 'Owner' }, own, now); return s; };
    const link = { type: 'abhaLink', personId: 'mine', version: 1, abhaNumber: '91-1234-5678-9012', otp: B.MOCK_OTP };
    const s1 = mk(); visible(s1, asha);
    // Slice 6z (sixth review): the 6u refusal used its own status (409) and text, which still told the requester the number
    // is held elsewhere. It is now the ordinary link refusal (422, the gateway-refusal text); the status below changed for that.
    check('ABHA duplicate held by an out-of-scope record gets a neutral refusal', () => { const e = status(() => B.applyAbdm(s1, link, { userId: 'asha', displayName: 'ASHA' }, asha, now), 422); assert.ok(!/another record/.test(e.message), e.message); assert.match(e.message, /identity steward/); });
    const s2 = mk(); visible(s2, own);
    check('control: a worker who may see the other record is told it is linked there', () => { const e = status(() => B.applyAbdm(s2, link, { userId: 'own', displayName: 'Owner' }, own, now), 409); assert.match(e.message, /linked to another record/); });
  }

  if (failed.length) { console.log(JSON.stringify({ passed, failed }, null, 2)); process.exitCode = 1; }
  else {
    const result = { passed, suite: 'Slice 6u fourth-review fixes: outreach emergency-access references, retention hold scope, data exit team rows, export audit retry, callback authentication, FHIR restriction, merge view and ABHA duplicate scope', completedAt: new Date().toISOString() };
    writeFileSync('tests/fourth-review-fixes-contract-result.json', JSON.stringify(result, null, 2) + '\n'); console.log(result);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
