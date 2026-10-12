// D03 A5/A6, BR-ID-02 and BR-SEC-08: actual built local HTTP/D1 current-authority regression.
// Synthetic native timing faults only; unchanged shared role/policy rules and immutable history are positive controls.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { globSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { startWorker, identity, client } from '../lib/worker.mjs';
import { suite } from '../lib/report.mjs';

const folder = process.env.SAHA_AUTH_EVIDENCE_DIR ?? 'tests/reports/routine-authority-http';
const state = process.env.SAHA_AUTH_TEST_STATE ?? '.wrangler/routine-authority-http-state';
const port = process.env.SAHA_TEST_PORT ?? '9475';
const mode = 'strict-current-authority';
const report = suite('Routine and Today current authority at disclosure', process.env.SAHA_AUTH_REPORT_FILE ?? 'tests/reports/routine-authority-http-result.json', { layer: 'integration', limits: ['Synthetic built local Worker/D1 HTTP with native timing faults only.', 'No full NFR/device/UAT/hosted/provider acceptance. Shared inherited helper boundary outside these routes remains unqualified.'] });
let finished = false;
assert.ok(folder && state && port, 'Explicit isolated output/state/port required');
mkdirSync(folder, { recursive: true });
let worker, sql, activeTrigger = null, pendingRestore = null;
const observations = [], checks = [];
const check = async (value, label) => { await report.check(label, () => assert.ok(value, label)); checks.push(label); if(value) console.log('PASS', label); };
const ok = response => { assert.equal(response.status, 200, response.text); return response.json; };
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const hash = value => createHash('sha256').update(value).digest('hex');
const privatePerson = response => response.json?.context?.person?.id === 'p_meena' || response.json?.person?.id === 'p_meena' || response.json?.record?.id === 'p_meena' || response.json?.records?.some(person => person.id === 'p_meena');

try {
  worker = await startWorker({ port, name: 'saha-authority-independent', state });
  const api = client(worker.base), run = crypto.randomUUID().slice(0, 8), owner = identity('owner', run), asha = identity('asha', run);
  const home = ok(await api.get(owner, '/api/workspace')), actor = ok(await api.get(asha, '/api/workspace')), org = home.organisation.id;
  const invite = ok(await api.command(owner, { type: 'createInvite', accountCode: actor.user.accountCode, label: 'Synthetic authority-read ASHA', role: 'asha', teamIds: ['default'] }, org));
  ok(await api.command(asha, { type: 'joinOrganisation', token: invite.result.token }));
  const assign = async () => {
    const workspace = ok(await api.get(owner, '/api/workspace', org)), person = workspace.people.find(p => p.id === 'p_meena');
    ok(await api.command(owner, { type: 'assignPatient', personId: person.id, version: person.version, teamId: 'default', assignedTo: asha.id, reason: 'Synthetic independent current-authority read fixture assignment' }, org));
  };
  await assign();
  const initialGrant = ok(await api.command(owner, { type: 'setAccessPurpose', memberId: asha.id, version: 0, programme: 'General care', purposes: [], reason: 'Synthetic initialize purpose history for independent disclosure fault' }, org));
  ok(await api.command(owner, { type: 'revokeAccessPurpose', grantId: initialGrant.result.grantId, version: initialGrant.result.version, reason: 'Synthetic restore unrestricted care scope before diagnostic cases' }, org));
  ok(await api.command(owner, { type: 'addFacility', version: 0, name: 'Synthetic authority fixture facility', localityId: null }, org));
  const file = globSync(state + '/**/*.sqlite').find(path => !path.includes('cache')); assert.ok(file);
  sql = new DatabaseSync(file);
  const member = () => sql.prepare('SELECT role,status,version,is_owner FROM memberships WHERE org_id=? AND user_id=?').get(org, asha.id);
  const patient = () => sql.prepare('SELECT assigned_to,version,data FROM patients WHERE org_id=? AND id=?').get(org, 'p_meena');
  const ops = () => JSON.parse(sql.prepare('SELECT data FROM operations WHERE org_id=?').get(org).data);
  const audit = () => sql.prepare('SELECT * FROM audit_events WHERE org_id=? ORDER BY id').all(org);
  const routes = [
    { name: 'routine', path: '/api/routine-visit?personId=p_meena', action: 'viewPatientRecord' },
    { name: 'today-detail', path: '/api/today?personId=p_meena', action: 'viewPatientRecord' },
    { name: 'today-list', path: '/api/today', action: 'listPatients' },
  ];
  for (const mutation of ['membership', 'assignment', 'programme-purpose', 'facility', 'role-owner']) {
    for (const route of routes) {
      for (const timing of ['BEFORE', 'AFTER']) {
        const beforeMember = member(), beforePerson = patient(), beforeOps = ops();
        await check(beforeMember.status === 'active' && beforeMember.role === 'asha', 'Fixture current ASHA active before ' + mutation + '/' + route.name + '/' + timing);
        const positive = await api.get(asha, route.path, org);
        await check(positive.status === 200 && privatePerson(positive), 'Actual positive HTTP scope before ' + mutation + '/' + route.name + '/' + timing);
        const previousAudit = audit(), previousMap = new Map(previousAudit.map(row => [row.id, JSON.stringify(row)]));
        const grantId = 'qa-read-fault-' + crypto.randomUUID();
        const grant = { id: grantId, memberId: asha.id, programme: 'Child health', purposes: [], version: 1, setBy: owner.id, setAt: new Date().toISOString(), reason: 'Synthetic during-audit programme scope restriction fault' };
        let change;
        if (mutation === 'membership') {
          change = 'UPDATE memberships SET status=\'suspended\',version=version+1 WHERE org_id=' + literal(org) + ' AND user_id=' + literal(asha.id) + ' AND status=\'active\' AND version=' + beforeMember.version + ';';
        } else if (mutation === 'assignment') {
          change = 'UPDATE patients SET assigned_to=' + literal(owner.id) + ',data=json_set(data,\'$.assignedTo\',' + literal(owner.id) + ',\'$.version\',version+1),version=version+1 WHERE org_id=' + literal(org) + ' AND id=\'p_meena\' AND version=' + beforePerson.version + ';';
        } else if (mutation === 'programme-purpose') {
          change = 'UPDATE operations SET data=json_set(data,\'$.purposeGrants\',json(' + literal(JSON.stringify([...(beforeOps.purposeGrants ?? []), grant])) + ')) WHERE org_id=' + literal(org) + ';';
        }
        if (mutation === 'facility') change = 'UPDATE operations SET data=json_set(data,\'$.accessScope.enforceFacility\',json(\'true\'),\'$.accessScope.version\',' + (beforeOps.accessScope.version + 1) + ') WHERE org_id=' + literal(org) + ';';
        if (mutation === 'role-owner') change = 'UPDATE memberships SET role=\'clinician\',is_owner=1,version=version+1 WHERE org_id=' + literal(org) + ' AND user_id=' + literal(asha.id) + ' AND version=' + beforeMember.version + ';';
        const trigger = 'qa_auth_' + mutation.replaceAll('-', '_') + '_' + route.name.replaceAll('-', '_') + '_' + timing.toLowerCase();
        pendingRestore = async () => {
          if (mutation === 'membership') {
            const current = member();
            if (current.status !== 'active') ok(await api.command(owner, { type: 'updateMember', userId: asha.id, version: current.version, role: current.role, teamIds: ['default'], isOwner: !!current.is_owner, status: 'active', reason: 'Synthetic restore membership through actual owner command after diagnostic' }, org));
          } else if (mutation === 'assignment') {
            if (patient().assigned_to !== asha.id) await assign();
          } else if (mutation === 'programme-purpose') {
            const current = ops().purposeGrants?.find(g => g.id === grantId);
            if (current && !current.revokedAt) ok(await api.command(owner, { type: 'revokeAccessPurpose', grantId, version: current.version, reason: 'Synthetic revoke appended scope fault through actual owner command' }, org));
          } else if (mutation === 'facility') {
            const current = ops().accessScope;
            if (current.enforceFacility) ok(await api.command(owner, {type:'setAccessScope',version:current.version,enforceFacility:false,enforceLocality:false}, org));
          } else {
            const current = member();
            if (current.role !== 'asha' || current.is_owner) ok(await api.command(owner, {type:'updateMember',userId:asha.id,version:current.version,role:'asha',teamIds:['default'],isOwner:false,status:'active',reason:'Synthetic restore ASHA role and remove fault owner flag through actual command'}, org));
          }
        };
        activeTrigger = trigger;
        sql.exec('CREATE TRIGGER ' + trigger + ' ' + timing + ' INSERT ON audit_events WHEN NEW.org_id=' + literal(org) + ' AND NEW.actor_id=' + literal(asha.id) + ' AND NEW.action=' + literal(route.action) + ' BEGIN ' + change + ' END');
        let response, afterMember, afterPerson, afterOps, afterAudit;
        try {
          response = await api.get(asha, route.path, org);
          afterMember = member(); afterPerson = patient(); afterOps = ops(); afterAudit = audit();
        } finally {
          sql.exec('DROP TRIGGER IF EXISTS ' + trigger); activeTrigger = null;
        }
        for (const row of afterAudit) if (previousMap.has(row.id)) assert.equal(JSON.stringify(row), previousMap.get(row.id), 'Existing immutable audit row remains exact');
        const inserted = afterAudit.filter(row => !previousMap.has(row.id));
        const targeted = inserted.filter(row => row.actor_id === asha.id && row.action === route.action);
        await check(targeted.length > 0, 'Actual targeted native audit insertion occurred ' + mutation + '/' + route.name + '/' + timing);
        const changed = mutation === 'membership'
          ? afterMember.status === 'suspended' && afterMember.version === beforeMember.version + 1
          : mutation === 'assignment'
            ? afterPerson.assigned_to === owner.id && afterPerson.version === beforePerson.version + 1
            : mutation === 'programme-purpose' ? afterOps.purposeGrants?.some(g => g.id === grantId && g.programme === 'Child health' && !g.revokedAt)
              : mutation === 'facility' ? afterOps.accessScope.enforceFacility === true && afterOps.accessScope.version === beforeOps.accessScope.version + 1
                : afterMember.role === 'clinician' && afterMember.is_owner === 1 && afterMember.version === beforeMember.version + 1;
        await check(changed, 'Native current authority really changed during audit ' + mutation + '/' + route.name + '/' + timing);
        if (mutation === 'programme-purpose') await check(JSON.stringify(afterOps.purposeGrants.slice(0, beforeOps.purposeGrants.length)) === JSON.stringify(beforeOps.purposeGrants), 'Prior purpose grant history preserved exactly; only new narrowing grant appended');
        const disclosure = privatePerson(response);
        const observation = {
          caseId: 'CASE-AUTH-' + mutation.toUpperCase() + '-' + route.name.toUpperCase() + '-' + timing,
          mode, mutation, triggerTiming: timing, route: route.path, action: route.action,
          beforeMember, afterMember, beforePerson: { assignedTo: beforePerson.assigned_to, version: beforePerson.version }, afterPerson: { assignedTo: afterPerson.assigned_to, version: afterPerson.version },
          actualStatus: response.status, actualBody: response.json, responseBodySha256: hash(response.text), privatePersonDisclosed: disclosure,
          currentAuthorityChanged: changed, newlyInsertedTargetAudits: targeted.map(row => ({ id: row.id, role: row.role, action: row.action, detail: row.detail })),
          previousAuditRowsBytePreserved: true, hypothesis: 'Before candidate may disclose a precomputed private projection after authority changed during the authorized audit.'
        };
        observations.push(observation); writeFileSync(folder + '/observations.json', JSON.stringify(observations, null, 2) + '\n');
        {
          await check(!disclosure, 'Current authority checked before actual HTTP disclosure ' + mutation + '/' + route.name + '/' + timing);
          await check(response.status >= 400 && response.status < 500 && Object.keys(response.json ?? {}).join(',') === 'error', 'Changed current-authority response is error-only4xx ' + mutation + '/' + route.name + '/' + timing);
        }
        // Restore only through the existing owner command, adding ordinary immutable history.
        await pendingRestore(); pendingRestore = null;
        await check(!sql.prepare('SELECT name FROM sqlite_master WHERE type=\'trigger\' AND name=?').get(trigger), 'Unique fault trigger removed after actual HTTP case');
      }
    }
  }
  // Purpose-only narrowing leaves ordinary care reads permitted; it is not a programme restriction.
  const purposeOnly = ok(await api.command(owner, {type:'setAccessPurpose',memberId:asha.id,version:0,programme:null,purposes:['reporting'],reason:'Synthetic verify purpose-only grant does not widen or remove ordinary record scope'}, org));
  try {
    for (const route of routes) {
      const response = await api.get(asha, route.path, org);
      await check(response.status === 200 && privatePerson(response), 'Shared rule: purpose-only grant retains ordinary authorized ' + route.name + ' read');
    }
  } finally {
    ok(await api.command(owner, {type:'revokeAccessPurpose',grantId:purposeOnly.result.grantId,version:purposeOnly.result.version,reason:'Synthetic restore ordinary scope after purpose-only positive control'}, org));
  }

  // Explicit POST tests distinguish a pre-command refusal from a committed save whose readback becomes unauthorized.
  const post = (body, key) => api.call(asha, '/api/routine-visit', {method:'POST',org,headers:{'Idempotency-Key':key},body});
  ok(await post({personId:'p_meena',command:{type:'startVisit',personId:'p_meena'}}, crypto.randomUUID()));
  const clinical = () => JSON.stringify({people:sql.prepare('SELECT org_id,id,version,data FROM patients ORDER BY org_id,id').all(),visits:sql.prepare('SELECT org_id,id,version,data FROM visits ORDER BY org_id,id').all()});
  const boundedCount = () => sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewPatientRecord' AND detail LIKE 'Bounded routine visit context.%'").get(org, asha.id).n;
  const writes = () => sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='saveVisit'").get(org).n;
  for (const stage of ['pre-command', 'post-save-context']) {
    for (const timing of ['BEFORE', 'AFTER']) {
      const current = ok(await api.get(asha, '/api/routine-visit?personId=p_meena', org)), beforeMember = member(), beforeAudit = audit(), previousMap = new Map(beforeAudit.map(row => [row.id,JSON.stringify(row)]));
      const beforeClinical = clinical(), beforeWrites = writes(), beforeBounded = boundedCount(), key = crypto.randomUUID(), at = new Date().toISOString().slice(0,16);
      const facts = {...current.visit.facts,date:at,weight:'51.5',systolic:'120',diastolic:'80',temperature:'36.5',weeks:'20',coughDays:'3',notes:'Synthetic exact-operation ' + stage + ' ' + timing,source:'measured',provenance:{weight:{source:'measured',at},weeks:{source:'reported',at},coughDays:{source:'reported',at}}};
      const body = {personId:'p_meena',command:{type:'saveVisit',visitId:current.visit.id,version:current.visit.version,facts}};
      const trigger = 'qa_auth_post_' + stage.replaceAll('-','_') + '_' + timing.toLowerCase();
      // AFTER already counts NEW; BEFORE does not. Both thresholds select the second bounded read.
      const atReadback = stage === 'post-save-context' ? " AND (SELECT count(*) FROM audit_events WHERE org_id=" + literal(org) + " AND actor_id=" + literal(asha.id) + " AND action='viewPatientRecord' AND detail LIKE 'Bounded routine visit context.%') >= " + (beforeBounded + (timing === 'AFTER' ? 2 : 1)) : '';
      pendingRestore = async () => {
        const latest = member();
        if (latest.status !== 'active') ok(await api.command(owner, {type:'updateMember',userId:asha.id,version:latest.version,role:'asha',teamIds:['default'],isOwner:false,status:'active',reason:'Synthetic restore POST current-authority fault through actual owner command'},org));
      };
      activeTrigger = trigger;
      sql.exec('CREATE TRIGGER ' + trigger + ' ' + timing + ' INSERT ON audit_events WHEN NEW.org_id=' + literal(org) + ' AND NEW.actor_id=' + literal(asha.id) + " AND NEW.action='viewPatientRecord' AND NEW.detail LIKE 'Bounded routine visit context.%'" + atReadback + ' BEGIN UPDATE memberships SET status=\'suspended\',version=version+1 WHERE org_id=' + literal(org) + ' AND user_id=' + literal(asha.id) + ' AND status=\'active\' AND version=' + beforeMember.version + '; END');
      let response;
      try { response = await post(body, key); }
      finally { sql.exec('DROP TRIGGER IF EXISTS ' + trigger); activeTrigger = null; }
      const afterMember = member(), receipt = sql.prepare('SELECT * FROM command_receipts WHERE actor_id=? AND key=?').get(asha.id,key), saved = sql.prepare('SELECT version,data FROM visits WHERE org_id=? AND id=?').get(org,current.visit.id), savedVisit = JSON.parse(saved.data), afterAudit = audit();
      for (const row of afterAudit) if (previousMap.has(row.id)) assert.equal(JSON.stringify(row),previousMap.get(row.id),'POST leaves prior immutable audit exact');
      await check(afterMember.status === 'suspended' && afterMember.version === beforeMember.version+1, 'POST actual membership changed at ' + stage + '/' + timing);
      await check(response.status === 403 && Object.keys(response.json ?? {}).join(',') === 'error' && !privatePerson(response), 'POST revoked current authority receives error-only403 ' + stage + '/' + timing);
      if (stage === 'pre-command') {
        await check(!receipt && saved.version === current.visit.version && clinical() === beforeClinical && writes() === beforeWrites, 'Pre-command refusal has no write receipt clinical mutation or save event ' + timing);
      } else {
        await check(!!receipt && saved.version === current.visit.version+1 && savedVisit.facts.notes === facts.notes && writes() === beforeWrites+1, 'Save really committed original receipt once before unauthorized readback ' + timing);
      }
      const observation = {caseId:'CASE-AUTH-POST-' + stage.toUpperCase() + '-' + timing,mode,mutation:'membership',triggerTiming:timing,route:'/api/routine-visit',action:'viewPatientRecord',stage,beforeMember,afterMember,actualStatus:response.status,actualBody:response.json,privatePersonDisclosed:!!privatePerson(response),currentAuthorityChanged:afterMember.status==='suspended',receiptPresent:!!receipt,visitVersionBefore:current.visit.version,visitVersionAfter:saved.version,originalKey:key,requestBodySha256:hash(JSON.stringify(body)),previousAuditRowsBytePreserved:true};
      observations.push(observation);writeFileSync(folder+'/observations.json',JSON.stringify(observations,null,2)+'\n');
      await pendingRestore();pendingRestore=null;
      const exact = ok(await post(body,key)), afterExact = sql.prepare('SELECT * FROM command_receipts WHERE actor_id=? AND key=?').get(asha.id,key);
      await check(exact.context.person.id==='p_meena' && exact.context.organisationId===org && exact.context.visit.id===current.visit.id && exact.context.visit.version===current.visit.version+1 && exact.context.visit.facts.notes===facts.notes && exact.replayed===(stage==='post-save-context'), 'Real owner restoration permits same original key/body exact readback with one save ' + stage+'/'+timing);
      if(receipt) await check(JSON.stringify(receipt)===JSON.stringify(afterExact), 'Committed original receipt remains exact after restore/replay '+timing);
      const replay = ok(await post(body,key));
      await check(replay.replayed===true && replay.context.visit.version===current.visit.version+1 && writes()===beforeWrites+1 && JSON.stringify(sql.prepare('SELECT * FROM command_receipts WHERE actor_id=? AND key=?').get(asha.id,key))===JSON.stringify(afterExact), 'Repeated exact original POST cannot duplicate mutation or rewrite receipt '+stage+'/'+timing);
      await check(!sql.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name=?").get(trigger),'POST unique native fault trigger removed '+stage+'/'+timing);
    }
  }
  const result = await report.finish({ recordedAtUtc: new Date().toISOString(), mode, actualHttpCases: observations.length, unsafeDisclosuresObserved: observations.filter(o => o.privatePersonDisclosed && o.currentAuthorityChanged).length, observations, caseScope:'Actual local built HTTP GET and POST boundaries; source/dist binding recorded separately by executing reviewer' }); finished = true;
  writeFileSync(folder + '/result.json', JSON.stringify(result, null, 2) + '\n');

} catch (error) {
  await report.check('Native fixture completed without environment/setup exception',()=>{throw error});
  writeFileSync(folder + '/failure.json', JSON.stringify({ recordedAtUtc: new Date().toISOString(), mode, checks, observations, error: String(error) }, null, 2) + '\n');
  throw error;
} finally {
  if (activeTrigger && sql) sql.exec('DROP TRIGGER IF EXISTS ' + activeTrigger);
  if (pendingRestore) {
    try { await pendingRestore(); writeFileSync(folder + '/failure-cleanup.json', JSON.stringify({ restoredThroughActualOwnerCommand: true }) + '\n'); }
    catch (error) { writeFileSync(folder + '/failure-cleanup.json', JSON.stringify({ restoredThroughActualOwnerCommand: false, error: String(error) }) + '\n'); }
  }
  sql?.close(); await worker?.stop();
  if (!finished) await report.finish({mode,observations,fixtureIncomplete:true});
}
