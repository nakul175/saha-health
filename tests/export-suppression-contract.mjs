// Slice 14g export suppression contract (BR-REP-04, BR-REP-05): small-number suppression on the operational export, the held
// download rules (expiry, single delivery, scope), and the inventory contract: every route handler, Content-Disposition source
// and outbound command is classified in lib/saha/export-routes.ts, so a new export path cannot ship unclassified.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.export-suppression-contract-'));
let passed = 0;
const check = async fn => { await fn(); passed++; };
try {
  for (const file of readdirSync('lib/saha').filter(f => f.endsWith('.ts'))) {
    const f = file.slice(0, -3);
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  }
  const load = f => import(pathToFileURL(join(dir, f + '.js')));
  const S = await load('export-suppression'), X = await load('report-export'), R = await load('export-routes'), H = await load('held-exports'), P = await load('purpose-scope'), A = await load('access-audit');
  const base = () => ({
    days: 7, since: '2026-09-24T00:00:00.000Z', until: '2026-09-30T06:00:00.000Z', scope: 'Current authorised teams', patients: 40, visitsStarted: 12, visitsConfirmed: 12, activeWorkers: 6,
    backlog: { drafts: 2, openFollowUps: 20, overdueFollowUps: 7, openReferrals: 9, overdueReferrals: 0, undatedReferrals: 1, unresolvedSubmissions: 12, unresolvedEhr: 0 },
    usage: { requests: 0, localCalls: 0, liveCalls: 0, inputTokens: 0, outputTokens: 0, missingUsage: 0, estimatedUsd: null, rates: null },
    programmes: [{ programme: 'tb', activeEpisodes: 11, openTasks: 3, overdueTasks: 2 }, { programme: 'maternal', activeEpisodes: 9, openTasks: 9, overdueTasks: 5 }, { programme: 'child', activeEpisodes: 6, openTasks: 8, overdueTasks: 0 }],
    destinations: [{ id: 'a', name: 'MIS A', mode: 'demo', accepted: 4, pending: 9, rejected: 0 }, { id: 'b', name: 'MIS B', mode: 'demo', accepted: 0, pending: 3, rejected: 6 }],
    daily: [{ date: '2026-09-28', confirmed: 6 }, { date: '2026-09-29', confirmed: 4 }, { date: '2026-09-30', confirmed: 2 }],
  });

  // 1. Primary suppression: 1 to 4 shown as "<5"; 0 and 5 or more shown.
  await check(() => {
    const { report, cells } = S.suppressCareReport(base());
    assert.equal(report.patients, 40); assert.equal(report.visitsConfirmed, 12); assert.equal(report.backlog.overdueReferrals, 0, 'zero is shown');
    assert.equal(report.backlog.undatedReferrals, '<5'); assert.equal(report.destinations[0].accepted, '<5'); assert.equal(report.destinations[1].pending, '<5'); assert.equal(report.destinations[1].rejected, 6);
    assert.equal(report.daily[1].confirmed, '<5'); assert.equal(report.daily[2].confirmed, '<5');
    assert.ok(cells > 0); assert.equal(report.suppression.cohortWithheld, false);
    assert.equal(structuredClone(base()).daily[1].confirmed, 4, 'the input report is not changed');
  });
  // 2. Complementary suppression: one suppressed cell under a displayed total costs the next smallest cell as well.
  await check(() => {
    const full = base(); full.daily = [{ date: 'd1', confirmed: 9 }, { date: 'd2', confirmed: 3 }, { date: 'd3', confirmed: 6 }]; full.visitsConfirmed = 18;
    const { report } = S.suppressCareReport(full);
    assert.deepEqual(report.daily.map(d => d.confirmed), [9, '<5', 'withheld'], 'the smallest other non-zero cell is withheld so the total cannot recover the suppressed one');
    const two = base(); two.daily = [{ date: 'd1', confirmed: 9 }, { date: 'd2', confirmed: 3 }, { date: 'd3', confirmed: 2 }]; two.visitsConfirmed = 14;
    assert.deepEqual(S.suppressCareReport(two).report.daily.map(d => d.confirmed), [9, '<5', '<5'], 'two suppressed cells need no third');
    const small = base(); small.visitsConfirmed = 3; small.daily = [{ date: 'd1', confirmed: 3 }, { date: 'd2', confirmed: 0 }]; assert.deepEqual(S.suppressCareReport(small).report.daily.map(d => d.confirmed), ['<5', 0]);
    const programmes = base().programmes; const r = S.suppressCareReport(base()).report;
    assert.equal(r.programmes[0].openTasks, '<5'); assert.equal(r.programmes[2].openTasks, 'withheld', 'open tasks 3 + (8 next smallest above 3): the next smallest non-zero is withheld'); assert.equal(programmes.length, 3);
  });
  // 3. A cohort of 1 to 4 withholds every count; a cohort of 0 shows zeros.
  await check(() => {
    const c = base(); c.patients = 3;
    const { report, cohortWithheld } = S.suppressCareReport(c); assert.equal(cohortWithheld, true);
    assert.equal(report.patients, '<5'); assert.equal(report.visitsConfirmed, 'withheld'); assert.equal(report.backlog.overdueReferrals, 'withheld', 'a zero is withheld too when the cohort is small'); assert.equal(report.usage.estimatedUsd, 'withheld');
    const z = base(); z.patients = 0; z.visitsStarted = 0; z.visitsConfirmed = 0; z.activeWorkers = 0; for (const k of Object.keys(z.backlog)) z.backlog[k] = 0; z.programmes = []; z.destinations = []; z.daily = [{ date: 'd', confirmed: 0 }];
    const e = S.suppressCareReport(z); assert.equal(e.cohortWithheld, false); assert.equal(e.cells, 0); assert.equal(e.report.patients, 0);
  });
  // 4. The CSV carries only the suppressed figures; the control totals and the manifest still verify.
  await check(async () => {
    const meta = { exportId: 'exp-14g', generatedBy: 'Synthetic Supervisor', role: 'supervisor', teams: ['North'], days: 7, filters: { team: 'North', programme: 'TB screening' } };
    const out = await X.exportCsv(base(), meta), lines = out.csv.split('\r\n').slice(0, -1);
    assert.equal(X.REPORT_DEFINITION.version, '1.2.0');
    assert.ok(lines.includes('"Filters","team: North","programme: TB screening"')); assert.ok(lines.some(l => l.startsWith('"Small-number suppression"')));
    assert.ok(lines.includes('"undatedReferrals","<5"')); assert.ok(lines.includes('"2026-09-29","<5"') && lines.includes('"2026-09-30","<5"'));
    assert.ok(!lines.includes('"2026-09-29","4"') && !lines.includes('"undatedReferrals","1"') && !lines.some(l => /,"3"$/.test(l) && l.startsWith('"MIS B"')), 'no suppressed raw figure is in the file');
    const totals = lines.slice(lines.indexOf('"Control total","Displayed measure","Sum of detail rows","Detail rows","Reconciled"') + 1, -2);
    assert.equal(totals.length, 4); assert.ok(totals.every(l => l.endsWith(',"withheld"') || l.endsWith(',"yes"')), totals.join('|'));
    assert.ok(totals[0].endsWith('"withheld"') && totals[0].includes('"withheld"'), 'a total over a suppressed breakdown does not show the row sum');
    assert.ok(out.reconciled, 'the underlying figures reconcile'); assert.ok(out.suppressedCells > 0);
    const v = await X.verifyExportCsv(out.csv); assert.equal(v.ok, true, JSON.stringify(v.problems));
    const broken = base(); broken.backlog.openFollowUps += 1; const bad = await X.exportCsv(broken, meta); assert.equal(bad.reconciled, false);
    assert.equal((await X.verifyExportCsv(bad.csv)).ok, false, 'a genuine mismatch is still caught');
  });
  // 5. Held export decisions: owner, replay, expiry, scope change.
  await check(async () => {
    const now = '2026-10-04T10:00:00.000Z', later = '2026-10-04T10:16:00.000Z';
    const row = { org_id: 'o', id: 'x', user_id: 'u1', kind: 'operations-csv', created_at: now, expires_at: new Date(Date.parse(now) + H.HELD_EXPORT_TTL_MS).toISOString(), downloaded_at: null, sha256: 'a'.repeat(64), bytes: 10, fingerprint: 'fp', content: 'data' };
    assert.equal(H.HELD_EXPORT_TTL_MS, 900000);
    assert.deepEqual(H.heldDecision(row, 'u1', 'fp', now), { ok: true });
    assert.equal(H.heldDecision(null, 'u1', 'fp', now).status, 404);
    const other = H.heldDecision(row, 'u2', 'fp', now); assert.equal(other.status, 404, 'another member is told nothing exists'); assert.equal(other.reason, 'not-yours');
    assert.equal(H.heldDecision({ ...row, downloaded_at: now }, 'u1', 'fp', later).reason, 'downloaded', 'replay');
    assert.equal(H.heldDecision(row, 'u1', 'fp', later).reason, 'expired'); assert.equal(H.heldDecision(row, 'u1', 'fp', later).status, 410);
    assert.equal(H.heldDecision({ ...row, content: '' }, 'u1', 'fp', now).reason, 'expired', 'blanked content is expired');
    assert.equal(H.heldDecision(row, 'u1', 'other', now).reason, 'scope-changed'); assert.equal(H.heldDecision(row, 'u1', 'other', now).status, 409);
    assert.equal(H.heldDecision({ ...row, expires_at: now }, 'u1', 'fp', now).reason, 'expired', 'expiry is inclusive');
  });
  await check(async () => {
    const s = { operations: { delegations: [] }, members: [], teams: [] };
    const m = (role, teams, owner = false) => ({ userId: 'u1', role, status: 'active', teamIds: teams, isOwner: owner });
    const a = await H.reachFingerprint(s, m('supervisor', ['t1', 't2'])), b = await H.reachFingerprint(s, m('supervisor', ['t2', 't1']));
    assert.equal(a, b, 'team order does not matter'); assert.notEqual(a, await H.reachFingerprint(s, m('supervisor', ['t1']))); assert.notEqual(a, await H.reachFingerprint(s, m('clinician', ['t1', 't2'], true)));
  });
  // 6. The patient-export purpose is separate from reporting.
  await check(() => {
    assert.ok(P.ACCESS_PURPOSES.includes('patient-export') && P.ACCESS_PURPOSES.includes('reporting')); assert.ok(P.ACCESS_PURPOSE_LABEL['patient-export']);
    const grant = { memberId: 'u1', programme: null, purposes: ['reporting'], revokedAt: null };
    const m = { userId: 'u1', role: 'supervisor', status: 'active', teamIds: ['t'] };
    assert.equal(P.purposeRefusal(m, 'reporting', [grant]), null); assert.match(P.purposeRefusal(m, 'patient-export', [grant]), /patient-level exports/i);
    const exp = { ...grant, purposes: ['patient-export'] }; assert.equal(P.purposeRefusal(m, 'patient-export', [exp]), null); assert.match(P.purposeRefusal(m, 'reporting', [exp]), /reporting/i);
    assert.equal(P.purposeRefusal(m, 'patient-export', []), null, 'without a limiting grant nothing changes');
    for (const [file, text] of [['lib/saha/data-exit-server.ts', "ensurePurpose(m,'patient-export')"], ['app/api/fhir/[id]/route.ts', "ensurePurpose(m,'patient-export')"], ['lib/saha/operations-server.ts', "ensurePurpose(m,'reporting')"], ['lib/saha/held-exports-server.ts', "ensurePurpose(m, 'reporting')"]]) assert.ok(readFileSync(file, 'utf8').includes(text), `${file} checks the purpose`);
  });

  // 7. Inventory completeness. Route handlers come from the files under app/api.
  const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const routeKeys = (files = walk('app/api').filter(f => /\/route\.tsx?$/.test(f))) => files.flatMap(f => {
    const path = '/' + f.replace(/^app\//, '').replace(/\/route\.tsx?$/, ''), src = readFileSync(f, 'utf8');
    return [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map(m => `${m[1]} ${path}`);
  });
  const unclassified = (keys, registry) => ({ missing: keys.filter(k => !(k in registry)), stale: Object.keys(registry).filter(k => !keys.includes(k)) });
  await check(() => {
    const keys = routeKeys(); assert.ok(keys.length > 60, `found ${keys.length} route handlers`);
    const { missing, stale } = unclassified(keys, R.ROUTES);
    assert.deepEqual(missing, [], 'route handlers not classified in lib/saha/export-routes.ts: ' + missing.join(', '));
    assert.deepEqual(stale, [], 'classified routes that no longer exist: ' + stale.join(', '));
  });
  await check(() => { // the check itself can fail
    const keys = [...routeKeys(), 'GET /api/new-report']; assert.deepEqual(unclassified(keys, R.ROUTES).missing, ['GET /api/new-report']);
    const { stale } = unclassified(routeKeys(), { ...R.ROUTES, 'GET /api/gone': {} }); assert.deepEqual(stale, ['GET /api/gone']);
  });
  await check(() => {
    const sources = [...walk('lib/saha'), ...walk('app/api')].filter(f => /\.tsx?$/.test(f) && f !== 'lib/saha/export-routes.ts' && /ontent-Disposition/.test(readFileSync(f, 'utf8')));
    const known = Object.keys(R.DISPOSITION_SOURCES);
    assert.deepEqual(sources.filter(f => !known.includes(f)), [], 'files that set Content-Disposition without being classified');
    assert.deepEqual(known.filter(f => !sources.includes(f)), [], 'classified Content-Disposition sources that no longer set it');
    for (const [f, rs] of Object.entries(R.DISPOSITION_SOURCES)) for (const r of rs) assert.ok(r in R.ROUTES, `${f} names an unclassified route ${r}`);
  });
  await check(() => { // screens that save a file only save the response of a classified route
    const screens = readdirSync('app').filter(f => /\.tsx$/.test(f)).map(f => `app/${f}`).filter(f => /createObjectURL|new Blob\(/.test(readFileSync(f, 'utf8')));
    const known = Object.keys(R.CLIENT_DOWNLOADS);
    assert.deepEqual(screens.filter(f => !known.includes(f)), [], 'screens that save a file without being classified');
    assert.deepEqual(known.filter(f => !screens.includes(f)), [], 'classified screens that no longer save a file');
    for (const [f, rs] of Object.entries(R.CLIENT_DOWNLOADS)) for (const r of rs) { assert.ok(r in R.ROUTES, `${f}: unclassified route ${r}`); assert.ok(readFileSync(f, 'utf8').includes(r.split(' ')[1]), `${f} no longer calls ${r}`); }
  });
  await check(() => { // every outbound command is classified, and nothing stale is listed
    const names = Object.keys(P.COMMAND_PURPOSE), classified = Object.keys(R.COMMANDS);
    assert.deepEqual(names.filter(n => !classified.includes(n)), [], 'commands in COMMAND_PURPOSE without a classification');
    assert.deepEqual(classified.filter(n => !names.includes(n)), [], 'classified commands that are not in COMMAND_PURPOSE');
    assert.deepEqual(classified.filter(n => R.COMMANDS[n].carries === 'aggregate'), ['sendAggregateReport'], 'the only aggregate send is the suppressed aggregate report');
  });
  await check(() => { // what the classification claims is still true
    const accessNames = Object.keys(A.ACCESS_ACTIONS);
    for (const [key, c] of Object.entries(R.ROUTES)) {
      if (c.content === 'aggregate' && (c.kind === 'file-export' || c.kind === 'outbound')) assert.ok(['applied', 'added-14g'].includes(c.suppression), `${key}: an aggregate file or send must be suppressed`);
      if (c.kind === 'file-export') assert.ok(c.audit, `${key}: a file export names its audit action`);
      if (c.purpose) assert.ok(P.ACCESS_PURPOSES.includes(c.purpose), `${key}: unknown purpose ${c.purpose}`);
      if (c.audit && accessNames.includes(c.audit)) assert.ok(c.audit in A.ACCESS_ACTIONS);
      if (c.evidence) assert.ok(readFileSync(c.evidence.file, 'utf8').includes(c.evidence.text), `${key}: ${c.evidence.file} no longer contains "${c.evidence.text}"`);
      if (c.audit) { const src = Object.entries(R.DISPOSITION_SOURCES).filter(([, rs]) => rs.includes(key)).map(([f]) => readFileSync(f, 'utf8')).join('\n') + (c.evidence ? readFileSync(c.evidence.file, 'utf8') : ''); assert.ok(src.includes(c.audit) || key.startsWith('POST /api/exports'), `${key}: audit action ${c.audit} is not written by its source`); }
    }
    assert.ok(R.ROUTES['GET /api/operations'].suppression === 'added-14g');
  });
  await check(() => { // the suppression rule is stated in one place and matches the indicator minimum
    const ind = readFileSync('lib/saha/indicators.ts', 'utf8'); assert.match(ind, /export const MIN_CELL=5;/); assert.equal(S.MIN_CELL, 5); assert.ok(S.SUPPRESSION_RULE.includes('1 to 4'));
  });
  writeFileSync('tests/export-suppression-contract-result.json', JSON.stringify({ suite: 'export suppression contract (slice 14g)', passed, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
