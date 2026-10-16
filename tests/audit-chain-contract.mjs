// Slice 6j audit chain contract: hashing, linear chaining under the commit guards, genesis over
// earlier events, verification of deliberate tampering and the auditor export. Runs the real
// migrations in an in-memory SQLite database through the minimal D1 shim of the storage contract.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

const dir = mkdtempSync(join(process.cwd(), '.audit-chain-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, pattern) => { await assert.rejects(fn, pattern); passed++; };
// An auditor's offline recomputation, independent of the application code.
const sha = text => createHash('sha256').update(text).digest('hex');
const offlineContent = e => sha(JSON.stringify([e.org_id, e.id, e.person_id ?? null, e.actor_id, e.actor_name, e.role, e.action, e.subject, e.detail, e.at]));
const offlineHash = (seq, prev, content) => sha(JSON.stringify(['saha-audit-chain-v1', seq, prev, content]));

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  exec() { const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); this.batches = 0; this.beforeBatch = null; }
  prepare(sql) { return new Statement(this.db, sql); }
  async batch(statements) {
    // A test may interleave another commit between a commit's head read and its batch.
    if (this.beforeBatch) { const f = this.beforeBatch; this.beforeBatch = null; await f(); }
    this.batches++; this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
}

try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const chain = await import(pathToFileURL(join(dir, 'audit-chain.js')));
  const { seedWorkspace } = await import(pathToFileURL(join(dir, 'seed.js')));
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const now = '2026-09-30T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'owner@example.invalid', now);
  const sql = (q, ...a) => d1.db.prepare(q).all(...a);
  const chained = orgId => sql('SELECT * FROM audit_events WHERE org_id=? AND seq IS NOT NULL ORDER BY seq', orgId);
  // Simulates someone with raw database access: the append-only triggers are dropped for one edit.
  const tamper = (q, ...a) => { d1.db.exec('DROP TRIGGER audit_events_no_update; DROP TRIGGER audit_events_no_delete;'); try { d1.db.prepare(q).run(...a); } finally { d1.db.exec("CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END; CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END;"); } };

  const makeOrg = async (orgId, withVisits = true) => {
    const w = seedWorkspace(now);
    for (const p of w.people) { p.version = 1; p.teamId = 'default'; p.assignedTo = 'owner'; }
    w.visits = withVisits ? w.people.slice(0, 3).map((p, i) => ({ id: `${orgId}-visit-${i}`, personId: p.id, version: 1, state: 'draft', facts: { date: '2026-09-29T08:00', systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: '', source: 'measured' }, createdAt: now, aiResults: [], recordVersion: 1 })) : [];
    const state = { organisation: { id: orgId, name: 'Audit chain contract organisation', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }], members: [{ userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now }], invitations: [], workspace: w };
    await store.createState(d1, state, actor, 'createOrganisation');
    return w;
  };
  const load = async (orgId, ids) => { const s = await store.readState(d1, orgId, ids); store.scope(s, 'owner'); return s; };
  const save = (s, visitId, weight, at = now) => { const after = structuredClone(s); const v = after.workspace.visits.find(x => x.id === visitId); v.facts = { ...v.facts, weight }; v.version++; after.workspace.audit.push({ id: crypto.randomUUID(), at, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'saveVisit', subject: visitId, detail: `Weight ${weight}` }); return after; };
  const commit = (before, after, type = 'saveVisit') => store.persist(d1, before, after, actor, { type }, crypto.randomUUID(), 'hash', { ok: true });

  // 1. Hashing matches an independent offline recomputation.
  const sample = { org_id: 'o', id: 'e1', person_id: null, actor_id: 'a', actor_name: 'Synthetic', role: 'clinician', action: 'x', subject: 's', detail: 'd "quoted" ü', at: now };
  const content = await chain.contentDigest(sample);
  check(() => { assert.equal(content, offlineContent(sample)); assert.match(content, /^[0-9a-f]{64}$/); });
  check(() => assert.notEqual(offlineContent({ ...sample, detail: 'd' }), content, 'any field change alters the content digest'));
  const linked = await chain.linkHash(1, chain.GENESIS_PREV, content);
  check(() => assert.equal(linked, offlineHash(1, '0'.repeat(64), content)));

  // 2. A new organisation starts its chain at creation: genesis (seq 0, nothing earlier) then its events.
  const A = 'org_chain_a'; const wa = await makeOrg(A);
  let rows = chained(A);
  check(() => { assert.equal(rows[0].seq, 0); assert.equal(rows[0].id, chain.GENESIS_ID); assert.equal(rows[0].prev_hash, chain.GENESIS_PREV); assert.match(rows[0].detail, /count=0; last=none\|none/); });
  check(() => { assert.ok(rows.length >= 2); rows.forEach((r, i) => { assert.equal(r.seq, i); if (i) assert.equal(r.prev_hash, rows[i - 1].hash); assert.equal(r.hash, offlineHash(r.seq, r.prev_hash, offlineContent(r))); }); });
  check(() => assert.equal(sql('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND seq IS NULL', A)[0].n, 0));

  // 3. Commits extend the chain; verification reports it intact with the current head.
  const [pa, pb, pc] = wa.people.map(p => p.id);
  let s = await load(A, [pa]); await commit(s, save(s, `${A}-visit-0`, '51'));
  s = await load(A); await commit(s, save(s, `${A}-visit-1`, '52'));
  let v = await chain.verifyChain(d1, A);
  rows = chained(A);
  check(() => { assert.equal(v.status, 'intact'); assert.equal(v.events, rows.length); assert.equal(v.head.seq, rows.length - 1); assert.equal(v.head.hash, rows.at(-1).hash); assert.equal(v.firstBreak, null); assert.equal(v.priorEvents, 0); });
  check(() => assert.equal(JSON.stringify(v).includes('Weight 51'), false, 'verification returns no event content'));

  // 4. Two patient-scoped commits read the same head: the unique (org, seq) index refuses the
  // second batch, which is rebuilt on the new head. Both commit; the chain stays linear.
  const s1 = await load(A, [pa]), s2 = await load(A, [pb]);
  const headBefore = (await chain.chainHead(d1, A)).seq, batchesBefore = d1.batches;
  d1.beforeBatch = async () => { const r = await commit(s2, save(s2, `${A}-visit-1`, '62')); check(() => assert.equal(r.attempts, 1)); };
  const raced = await commit(s1, save(s1, `${A}-visit-0`, '61'));
  rows = chained(A);
  check(() => { assert.equal(raced.attempts, 2); assert.deepEqual(raced.patients, [pa]); assert.equal(d1.batches - batchesBefore, 3, 'interleaved commit, refused batch, rebuilt batch'); });
  check(() => { assert.equal(rows.at(-1).seq, headBefore + 2); assert.equal(new Set(rows.map(r => r.prev_hash)).size, rows.length, 'no two events share a predecessor'); assert.deepEqual(rows.map(r => r.seq), rows.map((_, i) => i)); });
  check(() => { assert.equal(rows.at(-2).detail.split('\nCommand authority: ')[0], 'Weight 62'); assert.equal(rows.at(-1).detail.split('\nCommand authority: ')[0], 'Weight 61'); for(const r of rows.slice(-2)){const authority=JSON.parse(r.detail.split('\nCommand authority: ')[1]);assert.equal(authority.format,'saha-command-authority-v1');assert.equal(authority.initiatorId,'owner');assert.deepEqual(authority.membership,{role:'clinician',status:'active',version:1,isOwner:true});} assert.equal(rows.at(-1).prev_hash, rows.at(-2).hash); });
  check(() => { const saved = id => JSON.parse(sql('SELECT data FROM visits WHERE org_id=? AND id=?', A, id)[0].data).facts.weight; assert.equal(saved(`${A}-visit-0`), '61'); assert.equal(saved(`${A}-visit-1`), '62'); });
  v = await chain.verifyChain(d1, A); check(() => assert.equal(v.status, 'intact'));

  // 5. A real patient conflict is still a 409 and extends nothing.
  const c1 = await load(A, [pc]), c2 = await load(A, [pc]);
  await commit(c1, save(c1, `${A}-visit-2`, '71'));
  const headNow = (await chain.chainHead(d1, A)).seq;
  await rejects(() => commit(c2, save(c2, `${A}-visit-2`, '72')), /patient record/);
  check(() => assert.equal(chained(A).at(-1).seq, headNow));

  // 6. A batch that fails for another reason (a duplicate event id) is not retried.
  const d0 = await load(A, [pa]), dup = save(d0, `${A}-visit-0`, '81'); dup.workspace.audit.at(-1).id = rows[1].id;
  const beforeDup = d1.batches;
  await rejects(() => commit(d0, dup), /UNIQUE|constraint/i);
  check(() => { assert.equal(d1.batches - beforeDup, 1); assert.equal(chained(A).at(-1).seq, headNow); });

  // 7. Organisation-wide commits chain too, and exports list every chained event.
  s = await load(A); const withTeam = structuredClone(s); withTeam.teams.push({ id: 'team-2', name: 'Second team', createdAt: now }); withTeam.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'createTeam', subject: 'team-2', detail: 'Team created' }); await commit(s, withTeam, 'createTeam');
  v = await chain.verifyChain(d1, A); rows = chained(A);
  check(() => { assert.equal(v.status, 'intact'); assert.equal(rows.at(-1).action, 'createTeam'); });

  // 8. Export: every line verifies offline; patient-linked events are digests only for an administrator.
  d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('admin', 'CODE0000000000000000000B', 'Synthetic admin', 'admin@example.invalid', now);
  d1.db.prepare("INSERT INTO memberships (org_id,user_id,role,is_owner,status,version,created_at) VALUES (?,?,'admin',0,'active',1,?)").run(A, 'admin', now);
  const ownerExport = await chain.exportRows(d1, A, { userId: 'owner', role: 'clinician' }, 0);
  const adminExport = await chain.exportRows(d1, A, { userId: 'admin', role: 'admin' }, 0);
  check(() => { assert.equal(ownerExport.lines.length, rows.length); assert.equal(ownerExport.redacted, 0); assert.equal(ownerExport.more, false); assert.equal(ownerExport.to, rows.at(-1).seq); });
  check(() => { const patientLines = adminExport.lines.filter(l => l.redacted); assert.ok(patientLines.length >= 4); assert.equal(adminExport.redacted, patientLines.length); assert.ok(patientLines.every(l => !('event' in l))); assert.equal(JSON.stringify(adminExport.lines).includes('Weight 61'), false); });
  let offline = true; for (const l of [...ownerExport.lines, ...adminExport.lines]) { const c = l.event ? offlineContent({ org_id: A, id: l.id, person_id: l.event.personId, actor_id: l.event.actorId, actor_name: l.event.actorName, role: l.event.role, action: l.event.action, subject: l.event.subject, detail: l.event.detail, at: l.event.at }) : l.content; offline &&= c === l.content && offlineHash(l.seq, l.prevHash, c) === l.hash && await chain.checkExportLine(A, l); }
  check(() => assert.ok(offline, 'every export line recomputes to its hash, redacted lines from their digest'));
  check(() => { for (let i = 1; i < adminExport.lines.length; i++) assert.equal(adminExport.lines[i].prevHash, adminExport.lines[i - 1].hash); });
  const paged = await chain.exportRows(d1, A, { userId: 'owner', role: 'clinician' }, 2, 3);
  check(() => { assert.equal(paged.lines.length, 3); assert.equal(paged.lines[0].seq, 2); assert.equal(paged.more, true); assert.equal(paged.to, 4); });
  const altered = structuredClone(ownerExport.lines.find(l => l.event?.detail.split('\nCommand authority: ')[0] === 'Weight 61')); altered.event.detail = 'Weight 16';
  check(() => assert.equal(offlineContent({ org_id: A, id: altered.id, person_id: altered.event.personId, actor_id: altered.event.actorId, actor_name: altered.event.actorName, role: altered.event.role, action: altered.event.action, subject: altered.event.subject, detail: altered.event.detail, at: altered.event.at }) === altered.content, false));
  const alteredOk = await chain.checkExportLine(A, altered); check(() => assert.equal(alteredOk, false, 'an edited export line is detected'));

  // 9. Deliberate tampering is detected, and the first break is reported.
  // 9a. Altered content.
  const target = rows.find(r => r.detail.split('\nCommand authority: ')[0] === 'Weight 61');
  tamper('UPDATE audit_events SET detail=? WHERE org_id=? AND id=?', 'Weight 16', A, target.id);
  v = await chain.verifyChain(d1, A);
  check(() => { assert.equal(v.status, 'broken'); assert.equal(v.firstBreak.seq, target.seq); assert.equal(v.firstBreak.id, target.id); assert.match(v.firstBreak.reason, /content or its hash was altered/); });
  // 9b. Content and its own hash rewritten: the next event's link exposes it.
  const forged = offlineHash(target.seq, target.prev_hash, offlineContent({ ...target, detail: 'Weight 16' }));
  tamper('UPDATE audit_events SET hash=? WHERE org_id=? AND id=?', forged, A, target.id);
  v = await chain.verifyChain(d1, A);
  check(() => { assert.equal(v.status, 'broken'); assert.equal(v.firstBreak.seq, target.seq + 1); assert.match(v.firstBreak.reason, /link to the previous event/); });
  tamper('UPDATE audit_events SET detail=?,hash=? WHERE org_id=? AND id=?', target.detail, target.hash, A, target.id);
  v = await chain.verifyChain(d1, A); check(() => assert.equal(v.status, 'intact', 'restoring the original values restores the chain'));
  // 9c. A deleted event leaves a gap.
  const victim = rows[3];
  tamper('DELETE FROM audit_events WHERE org_id=? AND id=?', A, victim.id);
  v = await chain.verifyChain(d1, A);
  check(() => { assert.equal(v.status, 'broken'); assert.equal(v.firstBreak.seq, 3); assert.match(v.firstBreak.reason, /missing/); });
  d1.db.prepare('INSERT INTO audit_events (org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at,seq,prev_hash,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...['org_id', 'id', 'person_id', 'actor_id', 'actor_name', 'role', 'action', 'subject', 'detail', 'at', 'seq', 'prev_hash', 'hash'].map(k => victim[k]));
  // 9d. A forged event appended without the chain rule.
  const last = chained(A).at(-1);
  d1.db.prepare('INSERT INTO audit_events (org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at,seq,prev_hash,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(A, 'forged', null, 'owner', 'Synthetic owner', 'clinician', 'createTeam', 'x', 'Forged', now, last.seq + 1, 'f'.repeat(64), 'e'.repeat(64));
  v = await chain.verifyChain(d1, A);
  check(() => { assert.equal(v.status, 'broken'); assert.equal(v.firstBreak.seq, last.seq + 1); assert.equal(v.firstBreak.id, 'forged'); });
  // A commit after the forged row still chains on the stored head; the break remains reported.
  s = await load(A, [pa]); await commit(s, save(s, `${A}-visit-0`, '91'));
  v = await chain.verifyChain(d1, A); check(() => { assert.equal(v.firstBreak.seq, last.seq + 1); assert.equal(chained(A).at(-1).prev_hash, 'e'.repeat(64)); });

  // 10. An organisation with events from before the chain: genesis seals them without rewriting.
  const B = 'org_chain_b';
  d1.db.prepare("INSERT INTO organisations (id,name,revision,last_command,created_at) VALUES (?,?,1,'legacy',?)").run(B, 'Pre-chain organisation', now);
  d1.db.prepare("INSERT INTO teams (org_id,id,name,created_at) VALUES (?,?,?,?)").run(B, 'default', 'Care team', now);
  d1.db.prepare("INSERT INTO memberships (org_id,user_id,role,is_owner,status,version,created_at) VALUES (?,?,'clinician',1,'active',1,?)").run(B, 'owner', now);
  d1.db.prepare("INSERT INTO team_members (org_id,team_id,user_id) VALUES (?,?,?)").run(B, 'default', 'owner');
  const earlier = Array.from({ length: 1203 }, (_, i) => ({ id: `pre-${String(i).padStart(5, '0')}`, at: new Date(Date.parse('2026-01-01T00:00:00Z') + i * 1000).toISOString() }));
  for (const e of earlier) d1.db.prepare('INSERT INTO audit_events (org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(B, e.id, null, 'owner', 'Synthetic owner', 'clinician', 'legacyAction', B, 'Before the chain', e.at);
  v = await chain.verifyChain(d1, B); check(() => { assert.equal(v.status, 'not-started'); assert.equal(v.priorEvents, 1203); });
  s = await load(B); const bAfter = structuredClone(s); bAfter.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'renameOrganisation', subject: B, detail: 'First chained event' }); bAfter.organisation.name = 'Renamed'; await commit(s, bAfter, 'renameOrganisation');
  rows = chained(B);
  check(() => { assert.equal(rows.length, 2); assert.equal(rows[0].id, chain.GENESIS_ID); assert.match(rows[0].detail, /count=1203; last=2026-01-01T00:20:02.000Z\|pre-01202; digest=[0-9a-f]{64}; page=500\./); assert.equal(rows[1].prev_hash, rows[0].hash); });
  check(() => assert.equal(sql('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND seq IS NULL', B)[0].n, 1203, 'earlier events keep null chain columns'));
  v = await chain.verifyChain(d1, B); check(() => { assert.equal(v.status, 'intact'); assert.equal(v.priorEvents, 1203); assert.equal(v.events, 2); assert.equal(v.genesisAt, rows[0].at); });
  // Offline: the sealed digest is reproducible from the earlier events alone.
  let seal = sha(JSON.stringify(['saha-audit-chain-v1', 'prior', B])); const pre = sql('SELECT org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at FROM audit_events WHERE org_id=? AND seq IS NULL ORDER BY at,id', B);
  for (let i = 0; i < pre.length; i += 500) seal = sha(JSON.stringify([seal, pre.slice(i, i + 500).map(e => [e.org_id, e.id, e.person_id, e.actor_id, e.actor_name, e.role, e.action, e.subject, e.detail, e.at])]));
  check(() => assert.ok(rows[0].detail.includes(`digest=${seal};`)));
  tamper('UPDATE audit_events SET detail=? WHERE org_id=? AND id=?', 'Rewritten', B, 'pre-00777');
  v = await chain.verifyChain(d1, B); check(() => { assert.equal(v.status, 'broken'); assert.equal(v.firstBreak.seq, 0); assert.match(v.firstBreak.reason, /sealed by the genesis marker was altered/); });
  tamper('UPDATE audit_events SET detail=? WHERE org_id=? AND id=?', 'Before the chain', B, 'pre-00777');
  d1.db.prepare('INSERT INTO audit_events (org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(B, 'late-unchained', null, 'owner', 'Synthetic owner', 'clinician', 'x', B, 'Inserted outside the application', now);
  v = await chain.verifyChain(d1, B); check(() => { assert.equal(v.status, 'broken'); assert.match(v.firstBreak.reason, /1203 sealed, 1204 now/); });

  // 11. Two first commits race for genesis: one genesis, one linear chain.
  const C = 'org_chain_c';
  d1.db.prepare("INSERT INTO organisations (id,name,revision,last_command,created_at) VALUES (?,?,1,'legacy',?)").run(C, 'Genesis race', now);
  d1.db.prepare("INSERT INTO memberships (org_id,user_id,role,is_owner,status,version,created_at) VALUES (?,?,'clinician',1,'active',1,?)").run(C, 'owner', now);
  const g1 = await load(C), g2 = await load(C);
  const event = (st, detail) => { const x = structuredClone(st); x.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'opsExport', subject: C, detail }); return x; };
  // Both are organisation-wide: the interleaved one wins and the other gets the normal 409; its genesis is never written.
  d1.beforeBatch = async () => { await commit(g2, event(g2, 'second'), 'opsExport'); };
  await rejects(() => commit(g1, event(g1, 'first'), 'opsExport'), /organisation/);
  rows = chained(C);
  check(() => { assert.deepEqual(rows.map(r => [r.seq, r.id === chain.GENESIS_ID ? 'genesis' : r.detail.split('\nCommand authority: ')[0]]), [[0, 'genesis'], [1, 'second']]); });
  v = await chain.verifyChain(d1, C); check(() => assert.equal(v.status, 'intact'));

  // 12. Clock regressions are reported but are not a break; a verification limit reports incomplete.
  s = await load(A, [pb]); await commit(s, save(s, `${A}-visit-1`, '99', '2026-09-29T00:00:00.000Z'));
  const D = 'org_chain_d'; await makeOrg(D, false);
  s = await load(D); await commit(s, event(s, 'later'), 'opsExport');
  s = await load(D); const early = structuredClone(s); early.workspace.audit.push({ id: crypto.randomUUID(), at: '2026-09-29T23:00:00.000Z', actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'opsExport', subject: D, detail: 'skewed clock' }); await commit(s, early, 'opsExport');
  v = await chain.verifyChain(d1, D);
  check(() => { assert.equal(v.status, 'intact'); assert.equal(v.clockRegressions.count, 1); assert.equal(v.clockRegressions.largestMs, 3600000); assert.equal(v.clockRegressions.firstSeq, v.head.seq); });
  v = await chain.verifyChain(d1, D, 2);
  check(() => { assert.equal(v.status, 'incomplete'); assert.equal(v.events, 2); assert.equal(v.firstBreak, null); });

  // 13. Chain columns cannot be changed through the application's database constraints.
  check(() => assert.throws(() => d1.db.prepare('UPDATE audit_events SET hash=? WHERE org_id=?').run('x', D), /append-only/));
  check(() => assert.throws(() => d1.db.prepare('INSERT INTO audit_events (org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at,seq,prev_hash,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(D, 'dup-seq', null, 'owner', 'Synthetic owner', 'clinician', 'x', D, 'x', now, 1, 'a', 'b'), /UNIQUE/));

  // 14. A commit that keeps losing the race gives up after the attempt limit with a 409 and writes nothing.
  const E = 'org_chain_e'; const we = await makeOrg(E); const [ea, eb] = we.people.map(p => p.id);
  let storms = 0; const storm = async () => { storms++; const x = await load(E, [eb]); await commit(x, save(x, `${E}-visit-1`, String(100 + storms))); if (storms < store.CHAIN_ATTEMPTS) d1.beforeBatch = storm; };
  const loser = await load(E, [ea]); d1.beforeBatch = storm;
  await rejects(() => commit(loser, save(loser, `${E}-visit-0`, 'lost')), /at once/);
  v = await chain.verifyChain(d1, E);
  check(() => { assert.equal(storms, store.CHAIN_ATTEMPTS); assert.equal(v.status, 'intact'); assert.equal(chained(E).some(r => r.detail.split('\nCommand authority: ')[0] === 'Weight lost'), false); assert.equal(JSON.parse(sql('SELECT data FROM visits WHERE org_id=? AND id=?', E, `${E}-visit-0`)[0].data).facts.weight, ''); });

  const result = { suite: 'audit chain contract (slice 6j)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/audit-chain-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
