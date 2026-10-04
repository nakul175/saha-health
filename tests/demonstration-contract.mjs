// Slice 9a demonstration clinical package contract: the package is installed through the real governance commands
// (author, different reviewer, owner activation) only in the synthetic environment; every entry is active with no
// entry issues; the owner command is owner-only and refused when already installed; the preview flags the danger
// sign and the TB rule and nothing for a normal reading; fixture clinicians cannot sign in, are left out of roster
// sync and delegation; and a new home organisation written through the real store and migrations (foreign keys on)
// carries the package in synthetic and nothing elsewhere.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.demonstration-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, pattern) => { await assert.rejects(fn, e => pattern.test(e.message)); passed++; };
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
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'demonstration', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'roster', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const D = await import(pathToFileURL(join(dir, 'demonstration.js')));
  const G = await import(pathToFileURL(join(dir, 'governance.js')));
  const E = await import(pathToFileURL(join(dir, 'environment.js')));
  const { sitesPrincipal } = await import(pathToFileURL(join(dir, 'identity.js')));
  const { rosterDiff } = await import(pathToFileURL(join(dir, 'roster.js')));
  const { qualifies } = await import(pathToFileURL(join(dir, 'delegation.js')));
  const { seedWorkspace } = await import(pathToFileURL(join(dir, 'seed.js')));
  const store = await import(pathToFileURL(join(dir, 'store.js')));

  const now = new Date().toISOString(), today = now.slice(0, 10), inAYear = new Date(Date.parse(today + 'T00:00:00Z') + 365 * 86400000).toISOString().slice(0, 10);
  const ownerU = { userId: 'owner-9a', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  const orgState = () => {
    const w = E.fixturesFor({ SAHA_ENVIRONMENT: 'synthetic' }, seedWorkspace(now));
    for (const p of w.people) { p.version = 1; p.teamId = 'default'; p.assignedTo = 'asha-9a'; }
    return { organisation: { id: 'org_demo', name: 'Synthetic demo', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }],
      members: [{ userId: ownerU.userId, displayName: ownerU.displayName, accountCode: 'OWNER', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now },
        { userId: 'asha-9a', displayName: 'Synthetic ASHA', accountCode: 'ASHA', role: 'asha', isOwner: false, status: 'active', version: 1, teamIds: ['default'], createdAt: now },
        { userId: 'clinician-9a', displayName: 'Synthetic clinician', accountCode: 'CLIN', role: 'clinician', isOwner: false, status: 'active', version: 1, teamIds: ['default'], createdAt: now }],
      invitations: [], workspace: w };
  };
  const owner = s => s.members.find(m => m.userId === ownerU.userId), asha = s => s.members.find(m => m.userId === 'asha-9a');
  const codeOf = async id => store.accountCode(id);

  // 1. Installation through the real governance commands.
  const s = orgState();
  const result = await D.installDemonstration(s, { u: ownerU, m: owner(s) }, 'synthetic', codeOf, now);
  const entries = G.governanceState(s).entries, author = `fixture:org_demo:clinician-author`, reviewer = `fixture:org_demo:clinician-reviewer`;
  check(() => { assert.equal(result.installed, true); assert.deepEqual(result.fixtures, [author, reviewer]); assert.equal(entries.length, 7); assert.deepEqual(entries.map(e => e.spec.kind), ['source', 'source', 'service', 'service', 'service', 'protocol', 'protocol']); });
  check(() => { for (const e of entries) { assert.equal(e.state, 'active', e.spec.title); assert.deepEqual(G.entryIssues(s, e, now), [], e.spec.title); assert.equal(G.activeEntry(s, e, now), true); } });
  check(() => { for (const e of entries) { assert.equal(e.createdBy, author); assert.equal(e.review.by, reviewer); assert.notEqual(e.createdBy, e.review.by, 'author and reviewer differ'); assert.equal(e.spec.ownerId, author); assert.deepEqual(e.spec.teamIds, ['default']); assert.equal(e.spec.effectiveFrom, today); assert.equal(e.spec.reviewBy, inAYear); assert.equal(e.review.reference, 'synthetic-fixture'); assert.match(e.review.findings, /demonstration fixture, not a clinical review/i); assert.deepEqual(e.history.map(h => [h.state, h.by]), [['draft', author], ['reviewed', reviewer], ['active', ownerU.userId]]); } });
  check(() => { const fx = s.members.filter(m => D.isFixtureMember(m.userId)); assert.equal(fx.length, 2); assert.deepEqual(fx.map(m => m.displayName), ['Demonstration clinician — author (synthetic)', 'Demonstration clinician — reviewer (synthetic)']); for (const m of fx) { assert.equal(m.role, 'clinician'); assert.equal(m.isOwner, false); assert.equal(m.status, 'active'); assert.deepEqual(m.teamIds, ['default']); assert.match(m.accountCode, /^[A-F0-9]{24}$/); } });
  check(() => { const [anc, ntep] = entries; assert.equal(anc.spec.key, 'demo-source-mohfw-anc-anm-2005'); assert.equal(anc.spec.title, 'MoHFW guidelines for antenatal care and skilled attendance at birth by ANMs and LHVs (2005)'); assert.equal(anc.spec.publisher, 'Maternal Health Division, Ministry of Health and Family Welfare, Government of India'); assert.equal(anc.spec.edition, '2005'); assert.equal(anc.spec.url, 'https://nhmmeghalaya.nic.in/guidelines/gfac.pdf'); assert.match(anc.spec.summary, /^If the BP is more than 140\/90 mmHg \(or diastolic more than 90\), check again after 1 hour; .* Diastolic above 110 mmHg is a danger sign: refer to the CHC\/FRU immediately\.$/);
    assert.equal(ntep.spec.key, 'demo-source-ntep-tb-diagnostic-algorithm'); assert.equal(ntep.spec.title, 'NTEP diagnostic algorithm for TB disease'); assert.equal(ntep.spec.publisher, 'National TB Elimination Programme, India'); assert.equal(ntep.spec.edition, 'online, read 2 October 2026'); assert.equal(ntep.spec.url, 'https://www.ntep.in/node/1743/CP-diagnostic-algorithm-tb-disease-ntep'); assert.match(ntep.spec.summary, /cough of more than 2 weeks/); });
  check(() => { const services = entries.filter(e => e.spec.kind === 'service'); assert.deepEqual(services.map(e => e.spec.title), ['Rampur PHC medical officer (synthetic)', 'Kheda CHC / First Referral Unit (synthetic)', 'Kheda TB testing centre (synthetic)']); for (const e of services) { assert.equal(e.spec.verificationReference, 'synthetic-fixture-not-verified'); assert.equal(e.spec.verifiedOn, today); assert.match(e.spec.constraints, /Not verified/); } });
  check(() => { const [p1, p2] = entries.filter(e => e.spec.kind === 'protocol'); for (const p of [p1, p2]) { assert.match(p.spec.title, /\(demonstration, not clinically approved\)$/); assert.match(p.spec.changeSummary, /synthetic demonstration fixture/i); assert.deepEqual(p.spec.roles, ['asha', 'clinician']); assert.equal(p.spec.maxObservationAgeHours, 72); }
    assert.equal(p1.spec.programme, 'Maternal care'); assert.deepEqual([p1.spec.ageMin, p1.spec.ageMax], [15, 49]); assert.deepEqual(p1.spec.rules.map(r => [r.condition.field, r.condition.operator, r.condition.value, r.urgency]), [['systolic', 'gte', '140', 'review'], ['diastolic', 'gte', '90', 'review'], ['diastolic', 'gte', '111', 'urgent_review']]);
    assert.equal(p2.spec.programme, 'TB screening'); assert.deepEqual([p2.spec.ageMin, p2.spec.ageMax], [15, 120]); assert.deepEqual(p2.spec.rules.map(r => [r.condition.field, r.condition.operator, r.condition.value, r.urgency]), [['coughDays', 'gte', '15', 'review']]); });
  check(() => { const a = s.workspace.audit.filter(x => ['createGovernance', 'reviewGovernance', 'transitionGovernance', 'installDemonstrationPackage'].includes(x.action)); assert.equal(a.length, 22); assert.equal(a.at(-1).action, 'installDemonstrationPackage'); assert.equal(a.at(-1).actorId, ownerU.userId); assert.match(a.at(-1).detail, /Not clinically approved/); assert.equal(a.filter(x => x.action === 'reviewGovernance').every(x => x.actorId === reviewer), true); });

  // 2. The danger sign, the TB rule, and nothing for a normal reading (ASHA preview, current observations).
  const visitFor = (personId, facts, at = now) => ({ id: 'v_' + personId, personId, version: 1, recordVersion: 1, state: 'draft', facts: { date: at.slice(0, 16), systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: '', source: 'measured', ...facts } });
  const bp = await G.protocolPreview(s, asha(s), visitFor('p_meena', { systolic: '150', diastolic: '112' }), now);
  check(() => { assert.equal(bp.protocols.length, 1); assert.match(bp.protocols[0].title, /Antenatal blood pressure/); const urgent = bp.findings.filter(f => f.urgency === 'urgent_review'); assert.equal(urgent.length, 1); assert.equal(urgent[0].service.title, 'Kheda CHC / First Referral Unit (synthetic)'); assert.match(urgent[0].action, /danger sign: refer to the CHC\/FRU immediately/); assert.equal(urgent[0].sources[0].url, 'https://nhmmeghalaya.nic.in/guidelines/gfac.pdf');
    assert.deepEqual(bp.findings.map(f => f.ruleId), ['systolic-140', 'diastolic-90', 'diastolic-above-110']); assert.ok(bp.findings.filter(f => f.urgency === 'review').every(f => f.service.title === 'Rampur PHC medical officer (synthetic)')); assert.deepEqual(bp.unknowns, []); });
  const at140 = await G.protocolPreview(s, asha(s), visitFor('p_meena', { systolic: '140', diastolic: '90' }), now);
  check(() => assert.deepEqual(at140.findings.map(f => f.ruleId), ['systolic-140', 'diastolic-90'], 'fires at 140/90 or above; no danger sign at 110 or below'));
  const normal = await G.protocolPreview(s, asha(s), visitFor('p_meena', { systolic: '120', diastolic: '80' }), now);
  check(() => { assert.equal(normal.protocols.length, 1); assert.deepEqual(normal.findings, []); assert.deepEqual(normal.unknowns, []); });
  const cough = await G.protocolPreview(s, asha(s), visitFor('p_sunita', { coughDays: '16' }), now);
  check(() => { assert.equal(cough.protocols.length, 1); assert.match(cough.protocols[0].title, /Presumptive TB/); assert.equal(cough.findings.length, 1); assert.equal(cough.findings[0].urgency, 'review'); assert.equal(cough.findings[0].service.title, 'Kheda TB testing centre (synthetic)'); assert.match(cough.findings[0].action, /presumptive TB/); });
  const shortCough = await G.protocolPreview(s, asha(s), visitFor('p_sunita', { coughDays: '14' }), now);
  check(() => assert.deepEqual(shortCough.findings, []));
  const stale = await G.protocolPreview(s, asha(s), visitFor('p_meena', { systolic: '150', diastolic: '112' }, new Date(Date.now() - 73 * 3600000).toISOString()), now);
  check(() => { assert.deepEqual(stale.findings, [], 'an observation older than 72 hours is not current evidence'); assert.equal(stale.unknowns.length, 3); });
  const outOfAge = await G.protocolPreview({ ...s, workspace: { ...s.workspace, people: s.workspace.people.map(p => p.id === 'p_meena' ? { ...p, age: 52 } : p) } }, asha(s), visitFor('p_meena', { systolic: '150', diastolic: '112' }), now);
  check(() => assert.equal(outOfAge.protocols.length, 0, 'the maternal protocol covers ages 15 to 49'));
  // The governance checks still govern the package: a changed reviewer membership makes every reviewed entry unusable.
  check(() => { const t = structuredClone(s); t.members.find(m => m.userId === reviewer).version++; assert.equal(G.governanceState(t).entries.every(e => !G.activeEntry(t, e, now)), true); assert.ok(G.entryIssues(t, G.governanceState(t).entries[0], now).includes('Clinical reviewer authority changed')); });
  check(() => { const t = structuredClone(s); t.members.find(m => m.userId === author).status = 'suspended'; assert.equal(G.governanceState(t).entries.every(e => !G.activeEntry(t, e, now)), true); });
  await rejects(async () => { const t = structuredClone(s); const fx = t.members.find(m => m.userId === author); const created = await G.applyGovernance(t, { type: 'createGovernance', spec: { ...entries[0].spec, key: 'self-review-check' } }, { userId: author, displayName: fx.displayName, email: 'x@example.invalid' }, fx, now); await G.applyGovernance(t, { type: 'reviewGovernance', entryId: created.entryId, version: 1, reference: 'synthetic-fixture', findings: 'Attempted self review by the author.' }, { userId: author, displayName: fx.displayName, email: 'x@example.invalid' }, fx, now); }, /different clinician/);

  // 3. Owner-only command, refused when installed and outside the synthetic environment.
  await rejects(() => D.installDemonstration(s, { u: ownerU, m: owner(s) }, 'synthetic', codeOf, now), /already installed/);
  await rejects(() => D.applyDemonstration(s, { type: 'installDemonstrationPackage' }, ownerU, owner(s), 'synthetic', codeOf), /already installed/);
  check(() => assert.equal(G.governanceState(s).entries.length, 7, 'a refused second installation adds nothing'));
  for (const environment of ['training', 'staging', 'production', 'misconfigured']) {
    const t = orgState();
    await rejects(() => D.applyDemonstration(t, { type: 'installDemonstrationPackage' }, ownerU, owner(t), environment, codeOf), /only in the synthetic environment/);
    check(() => { assert.equal(t.governance, undefined); assert.equal(t.members.some(m => D.isFixtureMember(m.userId)), false); assert.equal(D.demonstrationAvailable(environment), false); assert.throws(() => D.authorizeDemonstration(owner(t), { type: 'installDemonstrationPackage' }, environment), /only in the synthetic environment/); });
  }
  for (const who of ['asha-9a', 'clinician-9a']) { const t = orgState(); await rejects(() => D.applyDemonstration(t, { type: 'installDemonstrationPackage' }, { userId: who, displayName: who, email: 'x@example.invalid' }, t.members.find(m => m.userId === who), 'synthetic', codeOf), /Only an organisation owner/); check(() => assert.equal(t.governance, undefined)); }
  check(() => assert.throws(() => D.authorizeDemonstration(orgState().members[2], { type: 'installDemonstrationPackage' }, 'synthetic'), /Only an organisation owner/));
  check(() => { assert.equal(D.authorizeDemonstration(orgState().members[1], { type: 'createTeam', name: 'x' }, 'production'), undefined); });
  { const t = orgState(); const r = await D.applyDemonstration(t, { type: 'createTeam', name: 'x' }, ownerU, owner(t), 'synthetic', codeOf); check(() => assert.equal(r, null)); }
  await rejects(async () => { const t = orgState(); t.teams = [{ id: 'other', name: 'Other', createdAt: now }]; await D.installDemonstration(t, { u: ownerU, m: owner(t) }, 'synthetic', codeOf, now); }, /default care team/);
  { const t = orgState(); await D.applyDemonstration(t, { type: 'installDemonstrationPackage' }, ownerU, owner(t), 'synthetic', codeOf); check(() => assert.equal(G.governanceState(t).entries.filter(e => G.activeEntry(t, e)).length, 7)); }

  // 4. Fixture clinicians: no sign-in, not managed by roster sync, no delegated authority.
  const headers = id => ({ get: n => ({ 'oai-authenticated-user-id': id, 'oai-authenticated-user-email': 'someone@example.invalid' })[n] ?? null });
  check(() => { assert.equal(sitesPrincipal(headers(author)), null); assert.equal(sitesPrincipal(headers('fixture:anything')), null); assert.equal(sitesPrincipal(headers('user-ordinary')).userId, 'user-ordinary'); });
  const diff = await rosterDiff(s, [{ accountCode: s.members.find(m => m.userId === author).accountCode, name: 'Fixture listed', role: 'asha', teams: ['default'], status: 'active' }], true, ownerU.userId);
  check(() => { const suspended = diff.actions.filter(a => a.action === 'suspend').map(a => a.userId); assert.ok(suspended.includes('asha-9a') && suspended.includes('clinician-9a')); assert.equal(suspended.some(id => D.isFixtureMember(id)), false); assert.equal(diff.actions.find(a => a.name === 'Fixture listed').action, 'none'); assert.match(diff.actions.find(a => a.name === 'Fixture listed').detail, /not managed by roster sync/); });
  check(() => { assert.equal(qualifies(s.members.find(m => m.userId === author), 'team-supervision', ['default']), false); assert.equal(qualifies(s.members.find(m => m.userId === reviewer), 'reporting', []), false); assert.equal(qualifies(s.members.find(m => m.userId === 'clinician-9a'), 'team-supervision', ['default']), true); });

  // 5. A new home organisation through the real store and migrations, with foreign keys enforced.
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort()) for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  check(() => assert.equal(d1.db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1));
  const home = async (userId, environment) => { const u = { userId, displayName: `Synthetic ${userId}`, email: `${userId}@example.invalid` }; await store.ensureAccount(d1, u, w => E.fixturesFor({ SAHA_ENVIRONMENT: environment }, w), state => D.prepareHome(d1, state, u, E.environmentOf({ SAHA_ENVIRONMENT: environment }).name, codeOf)); const org = await store.homeOrg(userId); return { u, org, state: await store.readState(d1, org) }; };
  const synth = await home('home-synthetic', 'synthetic');
  check(() => { const g = G.governanceState(synth.state); assert.equal(g.entries.length, 7); assert.ok(g.entries.every(e => G.activeEntry(synth.state, e))); const fx = synth.state.members.filter(m => D.isFixtureMember(m.userId)); assert.deepEqual(fx.map(m => m.displayName), ['Demonstration clinician — author (synthetic)', 'Demonstration clinician — reviewer (synthetic)']); assert.ok(fx.every(m => m.teamIds.includes('default') && m.status === 'active' && m.role === 'clinician')); });
  check(() => { const rows = d1.db.prepare("SELECT user_id,email,active_org_id FROM accounts WHERE user_id LIKE 'fixture:%' ORDER BY user_id").all(); assert.equal(rows.length, 2); assert.ok(rows.every(r => r.email.endsWith('@demonstration-fixture.invalid') && r.active_org_id === null)); assert.equal(d1.db.prepare('PRAGMA foreign_key_check').all().length, 0); });
  check(() => { const owner = synth.state.members.find(m => m.userId === synth.u.userId); assert.equal(owner.isOwner, true); assert.equal(synth.state.workspace.people.length, 6); assert.ok(synth.state.workspace.audit.some(a => a.action === 'installDemonstrationPackage')); });
  const fromStore = await G.protocolPreview(synth.state, store.scope(synth.state, synth.u.userId), visitFor('p_meena', { systolic: '150', diastolic: '112' }), new Date().toISOString());
  check(() => assert.equal(fromStore.findings.filter(f => f.urgency === 'urgent_review')[0].service.title, 'Kheda CHC / First Referral Unit (synthetic)'));
  for (const environment of ['training', 'staging', 'production', 'Prod']) {
    const other = await home(`home-${environment}`, environment);
    check(() => { assert.equal(other.state.governance, undefined, environment); assert.equal(other.state.members.length, 1); assert.equal(d1.db.prepare('SELECT count(*) AS n FROM accounts WHERE user_id LIKE ?').get(`fixture:${other.org}:%`).n, 0); });
  }
  // A later visit by the same account does not install again.
  await store.ensureAccount(d1, synth.u, w => w, state => D.prepareHome(d1, state, synth.u, 'synthetic', codeOf));
  check(() => assert.equal(d1.db.prepare("SELECT count(*) AS n FROM memberships WHERE user_id LIKE 'fixture:%'").get().n, 2));
  // A failed installation never blocks sign-in: the organisation is created without the package.
  const failing = { userId: 'home-failing', displayName: 'Synthetic failing', email: 'f@example.invalid' };
  await store.ensureAccount(d1, failing, w => w, state => { state.teams = [{ id: 'other', name: 'Other', createdAt: now }]; state.members[0].teamIds = ['other']; return D.prepareHome(d1, state, failing, 'synthetic', codeOf); });
  check(() => { const org = d1.db.prepare('SELECT active_org_id FROM accounts WHERE user_id=?').get('home-failing'); assert.ok(org.active_org_id); assert.equal(d1.db.prepare('SELECT count(*) AS n FROM governance WHERE org_id=?').get(org.active_org_id).n, 0); assert.equal(d1.db.prepare("SELECT count(*) AS n FROM memberships WHERE org_id=? AND user_id LIKE 'fixture:%'").get(org.active_org_id).n, 0); assert.match(d1.db.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='installDemonstrationPackage'").get(org.active_org_id).detail, /not installed: The demonstration package needs the organisation's default care team\./); });

  const out = { suite: 'demonstration clinical package contract (slice 9a)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/demonstration-contract-result.json', JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out));
} finally { rmSync(dir, { recursive: true, force: true }); }
