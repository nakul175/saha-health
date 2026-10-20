// Slice 6y trace contract: correlation stamping on execution steps, viewer scope and redaction, query
// validation, older steps shown as not linked, no clinical content, and stamping before every persist.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.trace-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of readdirSync('lib/saha').filter(file=>file.endsWith('.ts')).map(file=>file.slice(0,-3)))
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const T = await import(pathToFileURL(join(dir, 'trace.js'))), X = await import(pathToFileURL(join(dir, 'exceptions.js')));
  const now = '2026-10-01T12:00:00.000Z', at = n => new Date(Date.parse(now) - n * 60000).toISOString();
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const person = (id, over = {}) => ({ id, name: 'Secret Name ' + id, age: 30, sex: 'Female', village: 'V', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: true, exchangeConsent: true, consentVersion: 1, createdAt: now, version: 1, teamId: 't1', assignedTo: 'asha', assigned: false, ...over });
  const fresh = () => ({
    organisation: { id: 'org', name: 'Org', revision: 1 }, teams: [{ id: 't1', name: 'Team One' }, { id: 't2', name: 'Team Two' }], invitations: [],
    members: [member('asha', 'asha'), member('asha2', 'asha'), member('doc', 'clinician'), member('doc2', 'clinician', { teamIds: ['t2'] }), member('sup', 'supervisor'), member('sup2', 'supervisor', { teamIds: ['t2'] }), member('own', 'clinician', { isOwner: true, teamIds: ['t2'] }), member('adm', 'admin', { isOwner: true, teamIds: [] }), member('gone', 'supervisor', { status: 'suspended' })],
    workspace: { role: 'clinician', receipts: {}, integrations: [{ id: 'ehr1', name: 'Synthetic EHR', kind: 'ehr' }],
      audit: [{ id: 'old-audit', at: at(90), actor: 'ASHA', role: 'asha', action: 'sendSubmission', subject: 's1', detail: 'Delivery checkpoint saved', personId: 'p1' }],
      people: [person('p1', { ehr: { links: [{ id: 'l1', integrationId: 'ehr1' }], permissions: [], documents: [], operations: [{ id: 'op1', linkId: 'l1', visitId: 'v1', state: 'uncertain', at: at(80), bundle: { secret: 'document text' } }] } })],
      visits: [{ id: 'v1', personId: 'p1', version: 3, state: 'confirmed', facts: { notes: 'Secret clinical note' }, aiResults: [], recordVersion: 1, createdAt: at(200),
        agentRuns: [{ id: 'r-old', task: 'extract', status: 'review', actorId: 'asha', createdAt: at(150), startedAt: at(149), finishedAt: at(148), callCount: 1, provider: { name: 'Local rules' }, input: 'Secret input', inputHash: 'h', warnings: [], message: '', steps: [], limits: { timeMinutes: 5, attempts: 2 } }] }],
      submissions: [{ id: 's1', visitId: 'v1', personId: 'p1', connectorId: 'mis1', connectorName: 'Synthetic MIS', state: 'uncertain', mode: 'http', payloadHash: 'ph', attempts: 1, message: '', createdAt: at(100), updatedAt: at(90),
        delivery: { key: 's1', payload: { notes: 'Secret payload' }, events: [{ at: at(100), state: 'queued', detail: 'Approved payload saved to durable outbox.' }, { at: at(90), state: 'sending', detail: 'Delivery checkpoint saved before the programme request.' }] } }],
      referrals: [] },
  });

  // ---- stamping ----
  const s0 = fresh(), s1 = structuredClone(s0), sub = s1.workspace.submissions[0];
  sub.state = 'uncertain'; sub.attempts = 2; sub.delivery.events.push({ at: at(10), state: 'sending', detail: 'Delivery checkpoint saved before the programme request.' });
  s1.workspace.audit.push({ id: 'a-del', subject: 'v1', action: 'other' }, { id: 'a-send', subject: 's1', action: 'sendSubmission' });
  T.linkTrace(s0, s1, 'sendSubmission', 'key-2', 'asha');
  check(() => { const e = sub.delivery.events; assert.equal(e[0].ref, undefined, 'older events are never rewritten'); assert.equal(e[1].ref, undefined); assert.deepEqual(e[2].ref, { command: 'sendSubmission', key: 'key-2', actorId: 'asha', auditId: 'a-send' }); assert.equal(e[2].attempt, 2); });
  check(() => { const before = structuredClone(s1); T.linkTrace(s1, structuredClone(s1), 'saveVisit', 'k', 'asha'); assert.deepEqual(s1, before, 'a commit that adds no step stamps nothing'); });
  // EHR publication state change, a new demo submission and a new assistant request.
  const s2 = structuredClone(s1); const op = s2.workspace.people[0].ehr.operations[0]; op.state = 'running'; op.at = at(5);
  s2.workspace.submissions.push({ id: 's2', visitId: 'v1', personId: 'p1', connectorId: 'demo', connectorName: 'Demo', state: 'accepted', mode: 'demo', payloadHash: 'x', receipt: 'SIM-1', attempts: 1, message: '', createdAt: at(5), updatedAt: at(5) });
  s2.workspace.visits[0].agentRuns.push({ id: 'r-new', task: 'extract', status: 'pending', actorId: 'asha', createdAt: at(4), callCount: 0, provider: { name: 'Local rules' }, warnings: [], steps: [] });
  s2.workspace.audit.push({ id: 'a-ehr', subject: 'p1', action: 'lookupEhrPublish' });
  T.linkTrace(s1, s2, 'lookupEhrPublish', 'key-3', 'doc', now);
  check(() => { assert.deepEqual(op.events, [{ at: at(5), state: 'running', ref: { command: 'lookupEhrPublish', key: 'key-3', actorId: 'doc', auditId: 'a-ehr' } }]); assert.equal(s2.workspace.submissions[1].trace[0].state, 'accepted'); assert.equal(s2.workspace.submissions[1].trace[0].ref.key, 'key-3'); const r = s2.workspace.visits[0].agentRuns[1]; assert.deepEqual(r.trace.map(x => [x.at, x.state]), [[at(4), 'pending']]); assert.equal(s2.workspace.visits[0].agentRuns[0].trace, undefined); });
  // Running → result uses the finish time; a later transition (applied) uses the commit time.
  const s3 = structuredClone(s2), r3 = s3.workspace.visits[0].agentRuns[1]; r3.status = 'running'; r3.startedAt = at(3); r3.callCount = 1; T.linkTrace(s2, s3, 'executeAgent', 'key-4', 'asha', now);
  const s4 = structuredClone(s3), r4 = s4.workspace.visits[0].agentRuns[1]; r4.status = 'review'; r4.finishedAt = at(2); T.linkTrace(s3, s4, 'agentResult', 'agent_finish_r-new', 'asha', now);
  const s5 = structuredClone(s4), r5 = s5.workspace.visits[0].agentRuns[1]; r5.status = 'applied'; T.linkTrace(s4, s5, 'applyAgent', 'key-5', 'asha', now);
  check(() => assert.deepEqual(r5.trace.map(x => [x.at, x.state, x.ref.command, x.attempt]), [[at(4), 'pending', 'lookupEhrPublish', 0], [at(3), 'running', 'executeAgent', 1], [at(2), 'review', 'agentResult', 1], [now, 'applied', 'applyAgent', 1]]));

  // ---- query validation ----
  const q = s => T.parseTraceQuery(new URLSearchParams(s));
  check(() => { assert.deepEqual(q('visit=v1'), { visit: 'v1' }); assert.deepEqual(q('submission=s-1_x'), { submission: 's-1_x' }); assert.deepEqual(q('publication=op1'), { publication: 'op1' }); });
  check(() => { for (const bad of ['', 'visit=v1&submission=s1', 'visit=free%20text', 'visit=v1&note=x', 'visit=' + 'x'.repeat(201), 'patient=p1', 'visit=v1&visit=v2']) status(() => q(bad), 422); });

  // ---- scope ----
  const st = s5, m = id => st.members.find(x => x.userId === id), target = (id, query) => T.traceTarget(st, m(id), query, now);
  check(() => { for (const id of ['asha', 'doc', 'sup']) assert.equal(target(id, { visit: 'v1' }).scope, 'full', id); });
  check(() => { for (const id of ['asha2', 'doc2', 'sup2', 'own', 'adm']) status(() => target(id, { visit: 'v1' }), 404); status(() => target('gone', { visit: 'v1' }), 403); status(() => target('sup', { visit: 'nope' }), 404); status(() => target('sup', { submission: 'nope' }), 404); });
  check(() => { for (const id of ['own', 'adm']) { assert.equal(target(id, { submission: 's1' }).scope, 'redacted'); assert.equal(target(id, { publication: 'op1' }).scope, 'redacted'); } for (const id of ['asha2', 'doc2', 'sup2']) status(() => target(id, { submission: 's1' }), 404); });
  check(() => { const g = structuredClone(st); g.workspace.people[0].exceptionalAccess = [{ id: 'g1', userId: 'doc2', reason: 'x', from: at(10), until: '2026-10-02T00:00:00.000Z' }]; assert.equal(T.traceTarget(g, g.members.find(x => x.userId === 'doc2'), { visit: 'v1' }, now).scope, 'full', 'emergency access grant'); });
  check(() => { const t = target('sup', { submission: 's1' }); assert.equal(t.focus, 'submission:s1'); assert.equal(t.scope, 'full'); });

  // ---- assembly ----
  const tf = target('sup', { visit: 'v1' }), look = T.traceLookups(st, tf, now);
  check(() => { assert.deepEqual(look.subjects.sort(), ['op1', 'r-new', 'r-old', 's1', 's2', 'v1']); assert.ok(look.auditIds.includes('a-send') && look.auditIds.includes('a-ehr')); assert.equal(look.access, true); assert.ok(look.receipts.some(r => r.actorId === 'asha' && r.key === 'key-2')); });
  const audit = [{ id: 'old-audit', at: at(90), actor_name: 'ASHA', role: 'asha', action: 'sendSubmission', subject: 's1', seq: 4 }, { id: 'a-send', at: at(10), actor_name: 'ASHA', role: 'asha', action: 'sendSubmission', subject: 's1', seq: 9 }, { id: 'a-ehr', at: at(5), actor_name: 'DOC', role: 'clinician', action: 'lookupEhrPublish', subject: 'p1', seq: 10 }, { id: 'acc', at: at(1), actor_name: 'SUP', role: 'supervisor', action: 'downloadFhir', subject: 'p1', seq: 11 }];
  const receipts = [{ actor_id: 'asha', key: 'key-2', created_at: at(10) }];
  const full = T.assembleTrace(st, m('sup'), tf, audit, receipts, now);
  check(() => { assert.equal(full.scope, 'full'); assert.deepEqual(full.visit, { id: 'v1', personId: 'p1', state: 'confirmed', version: 3 }); assert.deepEqual(full.threads.map(t => t.id).sort(), ['assistant:r-new', 'assistant:r-old', 'ehr-publication:op1', 'submission:s1', 'submission:s2']); });
  const th = id => full.threads.find(t => t.id === id);
  check(() => { const s = th('submission:s1'); assert.deepEqual(s.steps.map(x => [x.state, x.linked, x.command]), [['queued', false, null], ['sending', false, null], ['sending', true, 'sendSubmission']]); const l = s.steps[2]; assert.equal(l.receiptId, 'key-2'); assert.equal(l.receiptFound, true); assert.equal(l.receiptAt, at(10)); assert.equal(l.auditSeq, 9); assert.equal(l.actor, 'ASHA'); assert.equal(l.attempt, 2); assert.deepEqual(s.attempts, { used: 2, limit: 3, rule: s.attempts.rule }); });
  check(() => { const e = th('ehr-publication:op1'); assert.equal(e.destination, 'Synthetic EHR'); assert.deepEqual(e.steps.map(x => [x.state, x.linked]), [['running', true]]); assert.equal(e.steps[0].receiptFound, false, 'no receipt row returned'); assert.equal(e.steps[0].source, 'command'); });
  check(() => { const o = th('assistant:r-old'); assert.deepEqual(o.steps.map(x => [x.state, x.linked]), [['pending', false], ['running', false], ['review', false]]); assert.deepEqual(o.limits, { timeMinutes: 5, attempts: 2 }); assert.equal(o.taskAttempt, 1); const n = th('assistant:r-new'); assert.equal(n.taskAttempt, 2); assert.equal(n.steps.find(x => x.state === 'review').source, 'destination'); });
  check(() => { assert.ok(full.notLinked >= 5); assert.deepEqual(full.events.map(e => [e.id, e.kind, e.steps]), [['old-audit', 'execution', []], ['a-send', 'execution', ['submission:s1']], ['a-ehr', 'execution', ['submission:s2', 'ehr-publication:op1', 'assistant:r-new']], ['acc', 'record-access', []]], 'one commit can link several steps'); });
  check(() => { const raw = JSON.stringify(full); for (const secret of ['Secret', 'document text', 'Delivery checkpoint saved', 'detail', 'payload']) assert.equal(raw.includes(secret), false, secret); });
  // Timed out: a sent request without a confirmed result past its time limit.
  check(() => { const g = structuredClone(st); const r = g.workspace.visits[0].agentRuns[1]; r.status = 'running'; r.limits = { timeMinutes: 1, attempts: null }; const out = T.assembleTrace(g, m('sup'), T.traceTarget(g, m('sup'), { visit: 'v1' }, now), [], [], now); assert.equal(out.threads.find(t => t.id === 'assistant:r-new').timedOut, true); });
  // Redacted: the one item, no visit or patient ids, no assistant requests, no access events, no subjects.
  const red = T.assembleTrace(st, m('adm'), target('adm', { submission: 's1' }), audit, receipts, now);
  check(() => { assert.equal(red.scope, 'redacted'); assert.equal(red.visit, null); assert.deepEqual(red.threads.map(t => t.id), ['submission:s1']); assert.deepEqual(red.events.map(e => e.id), ['old-audit', 'a-send']); assert.ok(red.events.every(e => e.subject === null)); const raw = JSON.stringify(red); for (const hidden of ['"p1"', '"v1"', 'r-new', 'downloadFhir', 'Secret']) assert.equal(raw.includes(hidden), false, hidden); assert.match(red.note, /outside your care scope/); });
  check(() => { const r = T.assembleTrace(st, m('own'), target('own', { publication: 'op1' }), audit, receipts, now); assert.deepEqual(r.threads.map(t => t.id), ['ehr-publication:op1']); assert.deepEqual(r.events.map(e => e.id), ['a-ehr']); });

  // ---- exception rows name the trace of delivery items ----
  check(() => { const e0 = fresh(), out = X.exceptionQueue(e0, m('sup'), now); assert.deepEqual(out.items.find(i => i.id === 'submission:s1').trace, { query: 'submission', id: 's1' }); assert.deepEqual(out.items.find(i => i.id === 'ehr-publication:op1').trace, { query: 'publication', id: 'op1' }); const a = X.exceptionQueue(e0, m('adm'), now); assert.ok(a.items.length === 2 && a.items.every(i => i.trace && i.patient === null)); });

  // ---- source order: steps are stamped before every persist that records them ----
  const src = f => readFileSync(f, 'utf8'), before = (text, a, b, label) => { const i = text.indexOf(a), j = text.indexOf(b, i); assert.ok(i >= 0 && j > i, label); };
  check(() => { const mis = src('lib/saha/mis-execution.ts'); before(mis, 'linkTrace(before,s,c.type,key,u.userId', 'await persist(db,before,s,u,c,key,hash,{submissionId', 'MIS checkpoint'); before(mis, "linkTrace(old,after,action,'mis_finish_'+operationId", "persist(db,old,after,u,{type:action}", 'MIS receipt'); assert.match(mis, /const action=withdrawn\?\(blocked\?'sendBlocked':'adapterOperationRefused'\):'misReceipt'/); });
  check(() => { const ehr = src('lib/saha/ehr-execution.ts'); before(ehr, 'linkTrace(before,s,c.type,key,u.userId', 'await persist(db,before,s,u,c,key,hash,{operationId', 'EHR checkpoint'); before(ehr, "linkTrace(old,after,action,finish", "persist(db,old,after,u,{type:action},finish", 'EHR receipt'); assert.match(ehr, /const action=operationRefused&&!receipt\?'adapterOperationRefused':blocked&&!receipt\?'sendBlocked':'ehrReceipt'/); });
  check(() => { const ag = src('lib/saha/agent-execution.ts'); before(ag, 'linkTrace(before,s,c.type,key,u.userId', "await persist(db,before,s,u,c,key,hash,{runId:r.id,status:'running'})", 'agent checkpoint'); before(ag, "linkTrace(old,after,'agentResult','agent_finish_'+run.id", "persist(db,old,after,u,{type:'agentResult'},'agent_finish_'+run.id", 'agent result'); });
  check(() => { before(src('app/api/mis/callback/route.ts'), "linkTrace(old,s,'misCallback',key,actor.userId)", "persist(db(),old,s,actor,{type:'misCallback'},key", 'callback'); before(src('lib/saha/server.ts'), 'linkTrace(before,state,c.type,key,u.userId)', 'await persist(db(),before,state,u,{...c,authorityDelegations},key,hash,result', 'generic command path'); });
  check(() => { const srv = src('lib/saha/trace-server.ts'); assert.equal(srv.includes('recordAccess'), false, 'not a material read'); assert.ok(srv.includes("cols='id,at,actor_name,role,action,subject,seq'") && !/SELECT (\*|detail)/.test(srv), 'audit detail text is never selected'); assert.ok(srv.includes('for(const part of chunks(l.subjects))') && srv.includes('for(const ids of chunks(l.auditIds))') && srv.includes('for(const part of chunks(l.receipts))') && /const CHUNK=40;/.test(srv), 'lookups are chunked under the D1 parameter limit (40 x 2 + 1 < 100)'); assert.ok(srv.includes("measured") === false && src('app/api/trace/route.ts').includes("measured(request,'trace'")); });

  writeFileSync('tests/trace-contract-result.json', JSON.stringify({ suite: 'trace contract (slice 6y)', passed, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
