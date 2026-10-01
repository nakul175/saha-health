// Slice 0b-4 work-list contract: for every viewer of one synthetic organisation, the server-side work views
// (My work statistics and visit list, programme follow-ups, Submissions, the referral tracker) walked page by page
// return exactly the counts and order the unpaged workspace shows for the same viewer on the same data, before and
// after the organisation grows past the paging threshold. Also: the shared view functions keep the pre-0b-4
// browser order, request parsing refuses names, ids and free text, and the workspace uses the shared functions.
// Real migrations, in-memory SQLite, D1 shim (as tests/patient-directory-contract.mjs).
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.worklists-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); passed++; return e; } assert.fail(`expected ${code}`); };
const statusAsync = async (fn, code) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); passed++; return e; } assert.fail(`expected ${code}`); };

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  exec() { const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); this.batches = 0; }
  prepare(sql) { return new Statement(this.db, sql); }
  async batch(statements) { this.batches++; this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}

try {
  for (const f of ['worklists', 'worklist-views', 'referral-rules', 'patient-directory', 'store', 'partition', 'access', 'core', 'fact-provenance', 'delegation', 'mis', 'programmes', 'seed', 'types', 'audit-chain', 'delta'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const wl = await import(pathToFileURL(join(dir, 'worklists.js')));
  const views = await import(pathToFileURL(join(dir, 'worklist-views.js')));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const pd = await import(pathToFileURL(join(dir, 'patient-directory.js')));
  const { TERMINAL } = await import(pathToFileURL(join(dir, 'referral-rules.js')));
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const now = new Date().toISOString(), soon = new Date(Date.now() + 3600000).toISOString(), past = new Date(Date.now() - 3600000).toISOString();
  // Owner holds the clinician role in team A only: owner authority must not widen the care scope to team B.
  const users = [['owner', 'clinician', ['A'], true], ['asha', 'asha', ['A'], false], ['asha2', 'asha', ['A', 'B'], false], ['sup', 'supervisor', ['B'], false], ['docB', 'clinician', ['B'], false], ['docA', 'clinician', ['A'], false], ['admin', 'admin', ['A', 'B'], false], ['gone', 'clinician', ['A'], false], ['supAll', 'supervisor', ['A', 'B'], false]];
  users.forEach(([u], i) => d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run(u, `CODE${String(i).padStart(20, '0')}`, u.toUpperCase(), `${u}@example.invalid`, now));
  const members = users.map(([userId, role, teamIds, isOwner], i) => ({ userId, accountCode: `CODE${String(i).padStart(20, '0')}`, displayName: userId.toUpperCase(), role, isOwner, status: userId === 'gone' ? 'suspended' : 'active', version: 1, teamIds, createdAt: now }));
  const base = { age: 30, sex: 'Unknown', programmes: ['General care'], task: 'Visit', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: false, createdAt: now, version: 1 };
  // Names out of id order, with duplicates and mixed case; statuses and due values mixed so every sort key is exercised.
  const names = ['Mira', 'Anil', 'zoya', 'Anil', 'Kavya', 'Bela', 'Dev', 'esha', 'Anil', 'Farah', 'Gita', 'Hari', 'Ira', 'Jai', 'Bela', 'Óscar'];
  const statuses = [['due', 'Today'], ['due', 'Tomorrow'], ['in_progress', 'Today'], ['completed', 'Today'], ['due', 'Today'], ['completed', 'Yesterday'], ['in_progress', 'Next week'], ['due', 'Today']];
  const fu = (i, k, due, state = 'open') => ({ id: `f${i}-${k}`, enrolmentId: `e${i}`, packId: k % 2 ? 'maternal' : 'ncd', title: `Task ${k}`, due, ownerId: 'owner', state, createdAt: now, createdBy: 'owner' });
  const people = names.map((name, i) => ({ ...base, id: `p${String(i).padStart(2, '0')}`, name, village: `Village ${i % 3}`, programmes: [i % 2 ? 'Chronic care' : 'Maternal care'], status: statuses[i % 8][0], due: statuses[i % 8][1], teamId: i < 8 || i === 15 ? 'A' : 'B', assignedTo: i < 2 ? 'asha' : i === 2 || i === 9 ? 'asha2' : i < 8 ? 'owner' : null,
    ...(i % 3 === 0 ? { followUps: [fu(i, 0, `2026-10-0${1 + (i % 5)}`), fu(i, 1, '2026-10-03'), fu(i, 2, '2026-09-30', 'completed')] } : {}) }));
  people[4].mergedInto = 'p05';
  people[10].exceptionalAccess = [{ id: 'g1', userId: 'docA', reason: 'x', from: past, until: soon }];
  people[11].exceptionalAccess = [{ id: 'g2', userId: 'docA', reason: 'x', from: past, until: past }, { id: 'g3', userId: 'docA', reason: 'x', from: past, until: soon, closedAt: now }];
  people[12].exceptionalAccess = [{ id: 'g4', userId: 'asha', reason: 'x', from: past, until: soon }];
  const visits = [], submissions = [], referrals = [];
  const visitStates = [{ state: 'confirmed' }, { state: 'draft' }, { state: 'confirmed', voidedAt: now }, { state: 'confirmed', supersededBy: 'x' }, { state: 'confirmed' }];
  people.forEach((p, i) => {
    for (let k = 0; k <= i % 3; k++) visits.push({ id: `v${p.id}-${k}`, personId: p.id, version: 1, recordVersion: 1, facts: {}, aiResults: [], createdAt: `2026-09-2${k}T10:00:00.000Z`, ...visitStates[(i + k) % 5] });
    const sStates = ['accepted', 'uncertain', 'queued', 'rejected', 'retryable', 'sending', 'cancelled'];
    // Random-looking ids, with creation times that tie, so the shared order (time, then id) is exercised.
    for (let k = 0; k < 2; k++) submissions.push({ id: `s${(i * 7919 + k * 104729) % 9973}`, visitId: `v${p.id}-0`, personId: p.id, connectorId: 'c1', connectorName: `Programme ${k}`, state: sStates[(i + k) % 7], mode: 'demo', payloadHash: 'h', attempts: k, message: 'Synthetic', createdAt: `2026-09-2${(i + k) % 4}T09:00:00.000Z`, updatedAt: now });
    if (i % 2 === 0) referrals.push({ id: `r${(i * 31) % 97}`, personId: p.id, visitId: `v${p.id}-0`, facility: 'Synthetic PHC', reason: 'Synthetic reason', state: ['draft', 'sent', 'completed', 'scheduled', 'declined', 'cancelled'][i % 6], ...(i % 4 ? { due: `2026-10-${String(10 - (i % 5)).padStart(2, '0')}` } : {}), createdAt: now, version: 1 });
  });
  const state = { organisation: { id: 'org1', name: 'Work list contract', revision: 1, createdAt: now }, teams: [{ id: 'A', name: 'A', createdAt: now }, { id: 'B', name: 'B', createdAt: now }], members, invitations: [], workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people, visits, integrations: [], submissions, referrals, receipts: {}, audit: [] } };
  await store.createState(d1, state, { userId: 'owner', displayName: 'OWNER', email: 'owner@example.invalid' }, 'seed');
  const url = q => new URL(`https://saha.invalid/api/worklists?${q}`);

  // What the unpaged workspace shows: the viewer-scoped read, filtered as snapshotFor filters it, through the shared functions.
  const unpaged = async userId => {
    const s = await store.readState(d1, 'org1', undefined, userId);
    store.scope(s, userId);
    const w = s.workspace, permitted = new Set(w.people.filter(p => p.assigned).map(p => p.id));
    const ppl = w.people.filter(p => permitted.has(p.id)), vis = w.visits.filter(v => permitted.has(v.personId)), sub = w.submissions.filter(x => permitted.has(x.personId)), ref = w.referrals.filter(r => permitted.has(r.personId));
    const f = views.followUpGroups(ppl), sAll = views.submissionList(sub), sAtt = views.submissionList(sub, true);
    return { people: ppl, visits: vis, submissions: sub, referrals: ref, stats: views.workStats(ppl, vis, sub), work: views.visitList(ppl).map(p => p.id), followups: f.groups.map(g => `${g.person.id}:${g.tasks.map(t => t.id).join(',')}`), tasks: f.tasks, subs: sAll.rows.map(x => x.id), attention: sAtt.rows.map(x => x.id), all: sAll.all, attentionCount: sAll.attention, refs: views.referralList(ref).map(r => r.id) };
  };
  // The paged workspace: the server views, walked through their opaque offset cursors.
  const walk = async (m, view, tab = 'all', limit = 3) => {
    const rows = [], firsts = []; let cursor = null, pages = 0;
    do {
      const q = wl.worklistQuery(url(`view=${view}&limit=${limit}${tab === 'attention' ? '&tab=attention' : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`));
      const page = wl.worklistPage(await wl.worklistData(d1, 'org1', m, view, now), q);
      firsts.push(page); rows.push(...page.rows); cursor = page.nextCursor; pages++;
      if (cursor) assert.match(cursor, /^n:\d+$/);
    } while (cursor && pages < 400);
    for (const p of firsts) assert.equal(p.total, firsts[0].total);
    return { rows, first: firsts[0], pages };
  };
  const compare = async (m, label, limit = 3) => {
    const u = await unpaged(m.userId);
    const work = await walk(m, 'work', 'all', limit), followups = await walk(m, 'followups', 'all', limit), subs = await walk(m, 'submissions', 'all', limit), att = await walk(m, 'submissions', 'attention', limit), refs = await walk(m, 'referrals', 'all', limit);
    check(() => assert.deepEqual(work.first.stats, u.stats, `${label}: My work statistics`));
    check(() => assert.deepEqual([work.first.total, work.rows.map(r => r.id)], [u.work.length, u.work], `${label}: visit list count and order`));
    check(() => assert.deepEqual([followups.first.tasks, followups.first.total, followups.rows.map(g => `${g.personId}:${g.tasks.map(t => t.id).join(',')}`)], [u.tasks, u.followups.length, u.followups], `${label}: follow-ups`));
    check(() => assert.deepEqual([subs.first.all, subs.first.attention, subs.first.total, subs.rows.map(r => r.id)], [u.all, u.attentionCount, u.subs.length, u.subs], `${label}: submissions`));
    check(() => assert.deepEqual([att.first.total, att.rows.map(r => r.id)], [u.attention.length, u.attention], `${label}: needs attention`));
    check(() => assert.deepEqual([refs.first.total, refs.rows.map(r => r.id)], [u.refs.length, u.refs], `${label}: referral tracker`));
    return { u, work, followups, subs, refs };
  };

  // 1. Parity for every viewer, in pages of three.
  const seen = {};
  for (const m of members.filter(m => m.status === 'active')) seen[m.userId] = await compare(m, m.userId);
  // Owner authority does not widen the scope: the team-A owner sees no team-B patient; the all-teams supervisor does.
  check(() => assert.ok(seen.owner.u.people.length > 0 && seen.owner.u.people.every(p => p.teamId === 'A')));
  check(() => assert.ok(seen.owner.work.rows.every(r => people.find(p => p.id === r.id).teamId === 'A') && seen.owner.refs.rows.every(r => people.find(p => p.id === r.personId).teamId === 'A')));
  check(() => assert.ok(seen.supAll.work.rows.length === people.length));
  // ASHAs see their assigned patients only; an ASHA grant does not open a patient.
  check(() => assert.deepEqual(seen.asha.work.rows.map(r => r.id).sort(), ['p00', 'p01']));
  // A clinician's current emergency grant is included; expired and closed grants are not.
  check(() => assert.ok(seen.docA.work.rows.some(r => r.id === 'p10') && !seen.docA.work.rows.some(r => ['p11', 'p12'].includes(r.id))));
  // Administrators see nothing even with team rows; a suspended member is refused.
  check(() => assert.deepEqual([seen.admin.work.first.total, seen.admin.subs.first.all, seen.admin.refs.first.total, seen.admin.followups.first.tasks], [0, 0, 0, 0]));
  await statusAsync(() => wl.worklistData(d1, 'org1', members.find(m => m.userId === 'gone'), 'work', now), 403);
  // Rows carry summary fields only and never another patient's name; merged records are flagged.
  check(() => assert.deepEqual(Object.keys(seen.supAll.work.rows[0]).sort(), ['age', 'due', 'id', 'merged', 'name', 'programmes', 'sex', 'status', 'task', 'village']));
  check(() => assert.ok(seen.supAll.work.rows.find(r => r.id === 'p04').merged));
  check(() => assert.ok(seen.supAll.subs.rows.every(r => r.personName === people.find(p => p.id === r.personId).name && !('delivery' in r) && !('payloadHash' in r))));
  check(() => assert.ok(seen.supAll.refs.rows.every(r => !('events' in r) && !('sources' in r))));
  // The data in this fixture really exercises the ordering keys.
  check(() => assert.ok(seen.supAll.u.subs.length === 32 && new Set(seen.supAll.u.subs).size === 32 && seen.supAll.u.attention.length > 0 && seen.supAll.u.attention.length < 32));
  check(() => assert.ok(seen.supAll.refs.rows.some(r => TERMINAL.has(r.state)) && seen.supAll.refs.rows.some(r => !r.due)));
  check(() => assert.ok(seen.supAll.followups.rows.length > 1 && seen.supAll.followups.first.tasks > seen.supAll.followups.rows.length));

  // 2. The shared functions keep the pre-0b-4 browser order over the snapshot (id-ordered) arrays.
  {
    const u = seen.supAll.u;
    const oldWork = u.people.slice().sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || Number(b.due === 'Today') - Number(a.due === 'Today') || a.name.localeCompare(b.name)).map(p => p.id);
    check(() => assert.deepEqual(u.work, oldWork));
    const rows = u.people.flatMap(p => (p.followUps ?? []).filter(t => t.state === 'open').map(t => ({ p, t }))).sort((a, b) => a.t.due.localeCompare(b.t.due));
    check(() => assert.deepEqual(u.followups, [...new Set(rows.map(r => r.p.id))].map(id => `${id}:${rows.filter(r => r.p.id === id).map(r => r.t.id).join(',')}`)));
    const oldRefs = u.referrals.slice().sort((a, b) => Number(TERMINAL.has(a.state)) - Number(TERMINAL.has(b.state)) || (a.due ?? '9999').localeCompare(b.due ?? '9999')).map(r => r.id);
    check(() => assert.deepEqual(u.refs, oldRefs));
    const oldStats = { toDo: u.people.filter(p => p.status === 'due' && p.due === 'Today').length, inProgress: u.people.filter(p => p.status === 'in_progress').length, confirmed: u.visits.filter(v => v.state === 'confirmed' && !v.voidedAt && !v.supersededBy).length, attention: u.submissions.filter(s => ['uncertain', 'sending', 'queued', 'retryable'].includes(s.state)).length };
    check(() => assert.deepEqual(u.stats, oldStats));
    // Decision: submissions are now most recent first (creation time, then id); before, the reverse of random id order.
    check(() => assert.deepEqual(u.subs, u.submissions.slice().sort((a, b) => a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1).map(s => s.id)));
  }

  // 3. Request parsing: only view, tab, limit and an offset cursor; no names, ids or free text.
  check(() => assert.deepEqual(wl.worklistQuery(url('')), { view: 'work', limit: 50, offset: 0, attention: false }));
  check(() => assert.deepEqual(wl.worklistQuery(url('view=submissions&tab=attention&cursor=n:100&limit=100')), { view: 'submissions', limit: 100, offset: 100, attention: true }));
  check(() => assert.equal(wl.worklistQuery(url('limit=500')).limit, 100));
  status(() => wl.worklistQuery(url('view=people')), 400);
  status(() => wl.worklistQuery(url('q=Anil')), 400);
  status(() => wl.worklistQuery(url('personId=p01')), 400);
  status(() => wl.worklistQuery(url('cursor=after:p01')), 400);
  status(() => wl.worklistQuery(url(`cursor=${encodeURIComponent(JSON.stringify(['Anil', 'p01']))}`)), 400);
  status(() => wl.worklistQuery(url('cursor=n:-1')), 400);
  status(() => wl.worklistQuery(url('limit=abc')), 400);
  status(() => wl.worklistQuery(url('view=work&tab=attention')), 400);
  // A cursor beyond the end returns an empty page with the same total.
  { const p = wl.worklistPage(await wl.worklistData(d1, 'org1', members.find(m => m.userId === 'supAll'), 'work', now), wl.worklistQuery(url('cursor=n:9999'))); check(() => assert.deepEqual([p.rows.length, p.total, p.nextCursor], [0, people.length, null])); }

  // 4. Past the paging threshold: 520 more team-A people. Parity still holds for the paged viewers, in pages of 100.
  const more = Array.from({ length: 520 }, (_, i) => ({ ...base, id: `q${String(i).padStart(3, '0')}`, name: `Synthetic ${['Asha', 'bina', 'Chand', 'Devi'][i % 4]} ${i % 37}`, village: `Village ${i % 9}`, programmes: ['General care'], status: statuses[i % 8][0], due: statuses[i % 8][1], teamId: 'A', assignedTo: i % 50 === 0 ? 'asha' : 'owner', ...(i % 5 === 0 ? { followUps: [fu(1000 + i, 0, `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`)] } : {}) }));
  for (const p of more) d1.db.prepare('INSERT INTO patients (org_id,id,version,name,team_id,assigned_to,data,rev) VALUES (?,?,?,?,?,?,?,0)').run('org1', p.id, 1, p.name, p.teamId, p.assignedTo, JSON.stringify(p));
  for (const [i, p] of more.entries()) if (i % 4 === 0) {
    d1.db.prepare('INSERT INTO submissions (org_id,id,visit_id,person_id,state,data) VALUES (?,?,?,?,?,?)').run('org1', `t${i}`, 'vx', p.id, ['accepted', 'uncertain', 'queued'][i % 3], JSON.stringify({ id: `t${i}`, visitId: 'vx', personId: p.id, connectorId: 'c1', connectorName: 'Programme', state: ['accepted', 'uncertain', 'queued'][i % 3], mode: 'demo', payloadHash: 'h', attempts: 0, message: 'Synthetic', createdAt: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}T08:00:00.000Z`, updatedAt: now }));
    d1.db.prepare('INSERT INTO referrals (org_id,id,person_id,data) VALUES (?,?,?,?)').run('org1', `u${i}`, p.id, JSON.stringify({ id: `u${i}`, personId: p.id, visitId: 'vx', facility: 'Synthetic PHC', reason: 'Synthetic', state: ['sent', 'completed', 'draft'][i % 3], ...(i % 8 ? { due: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}` } : {}), createdAt: now, version: 1 }));
  }
  for (const id of ['owner', 'docA', 'supAll']) {
    const m = members.find(x => x.userId === id), r = await compare(m, `${id} at scale`, 100);
    const paging = await pd.pagedWindow(d1, 'org1', id, []);
    check(() => assert.ok(paging && paging.total > pd.PAGED_THRESHOLD && r.work.first.total === paging.total, `${id} is paged and the visit list covers the whole scope`));
  }
  // The ASHA is not paged and still matches.
  await compare(members.find(m => m.userId === 'asha'), 'asha at scale', 5);
  { const w = await pd.pagedWindow(d1, 'org1', 'asha', []); check(() => assert.equal(w, null)); }

  // 5. The unpaged workspace and the server use the same definitions; the paged workspace no longer says it lists
  // only opened records; the work-list address carries no free text.
  const workspace = readFileSync('app/workspace.tsx', 'utf8'), programmes = readFileSync('app/programmes.tsx', 'utf8'), referral = readFileSync('app/referral-panel.tsx', 'utf8'), panel = readFileSync('app/worklist-panel.tsx', 'utf8');
  check(() => assert.ok(/\.sort\(visitCompare\)/.test(workspace) && /workStats\(data\.people,data\.visits,data\.submissions\)/.test(workspace) && /submissionList\(/.test(workspace)));
  check(() => assert.ok(/followUpGroups\(data\.people\)/.test(programmes) && /referralList\(/.test(referral)));
  check(() => assert.ok(!/lists only the records opened/.test(workspace) && /PagedVisitList/.test(workspace) && /PagedReceipts/.test(workspace) && /PagedReferrals/.test(workspace) && /PagedFollowUps/.test(workspace)));
  check(() => assert.ok(/\/api\/worklists\?view=\$\{view\}/.test(panel) && !/[?&](q|search|name|personId)=/.test(panel)));

  writeFileSync('tests/worklists-contract-result.json', JSON.stringify({ suite: 'work lists contract (slice 0b-4)', passed, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ suite: 'work lists contract (slice 0b-4)', passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
