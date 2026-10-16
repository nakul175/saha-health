import assert from 'node:assert/strict';
// Slice 4f: governed installation of a programme pack over HTTP and local D1: who may read and act, strict manifest
// validation and the size bound, staging with replay, independent clinician review (the uploader is refused), owner
// activation, episodes and visit capture on the activated version only, the pack in the migration catalogue, retirement
// that keeps the version and its pinned episode, and one audit event per step with an intact chain.
export async function packInstallationSmoke({ get, post, check, accounts, org, sql, base }) {
  const { worker: w, stranger: x } = accounts;
  const fresh = (label) => ({ headers: { 'oai-authenticated-user-id': `pi-${label}-${crypto.randomUUID()}`, 'oai-authenticated-user-email': `pi-${label}@example.invalid` }, state: null });
  const o = fresh('owner'), rv = fresh('reviewer');
  await get(o, '/api/workspace'); await get(rv, '/api/workspace');
  const mine = o.state.organisation.id;
  const inv = (await post(o, { type: 'createInvite', accountCode: rv.state.user.accountCode, label: 'Pack reviewer', role: 'clinician', teamIds: ['default'] }, 200, undefined, mine)).result;
  await post(rv, { type: 'joinOrganisation', token: inv.token });
  const read = async (who, status = 200) => { const r = await fetch(`${base}/api/pack-installations`, { headers: { ...who.headers, 'x-saha-organisation': mine } }); const j = await r.json(); check(() => assert.equal(r.status, status, JSON.stringify(j).slice(0, 300))); return j; };
  await read(x, 403);
  { const r = await fetch(`${base}/api/pack-installations`, { headers: { ...w.headers, 'x-saha-organisation': org } }); check(() => assert.equal(r.status, 403, 'an ASHA cannot read installations')); }
  let view = await read(o);
  check(() => { assert.equal(view.canStage, true); assert.equal(view.installations.length, 0); assert.match(view.notice, /not clinical approval/); assert.equal(view.limits.manifestCharacters, 8000); });
  const manifest = { format: 'saha-pack-manifest-1', id: 'child_growth', version: 1, name: 'Child growth check', programme: 'Child health', purpose: 'Record a synthetic child growth check and a reported feeding concern.',
    questions: [{ id: 'weight', label: 'Weight', fact: 'weight', unit: 'kg', required: true }, { id: 'feeding_concern', label: 'Does the carer report a feeding concern?', options: ['Yes', 'No'], required: true }],
    schedule: { followUpWithinDays: 30 }, adoption: { identityReuse: 'organisation-person', observationReuse: ['weight'], roleBoundaries: [{ role: 'asha', actions: ['capture'] }, { role: 'clinician', actions: ['review'] }], destinationRules: [{ destinationId: 'child_registry', mappingVersion: 'synthetic-v1', readiness: 'ready', rule: 'Owner-approved synthetic routing only; no automatic send.' }], workflowReadiness: { status: 'ready', evidenceRef: 'SYNTH-WORKFLOW-001' } }, escalation: [{ id: 'feeding-concern', label: 'Reported feeding concern', condition: { questionId: 'feeding_concern', operator: 'eq', value: 'Yes' }, urgency: 'review' }], changeNote: 'Synthetic illustrative pack for the installation smoke; not clinically approved.' };
  const stage = (m, reason = 'Stage a synthetic child growth pack') => ({ type: 'packInstallStage', manifest: m, reason });
  // Invalid manifests are refused with the reason; nothing is staged.
  const bad = await post(o, stage({ ...manifest, questions: [{ ...manifest.questions[0], unit: 'g' }, manifest.questions[1]] }), 422, undefined, mine);
  check(() => assert.match(bad.error, /manifest is invalid/));
  await post(o, stage({ ...manifest, run: 'code' }), 422, undefined, mine);
  await post(o, stage({ ...manifest, purpose: 'x'.repeat(9000) }), 422, undefined, mine);
  await post(rv, stage(manifest), 403, undefined, mine);
  const key = crypto.randomUUID();
  const staged = (await post(o, stage(manifest), 200, key, mine)).result;
  const replay = await post(o, stage(manifest), 200, key, mine);
  check(() => { assert.equal(staged.state, 'staged'); assert.equal(replay.replayed, true); assert.equal(replay.result.installationId, staged.installationId); });
  await post(o, stage(manifest), 409, undefined, mine);
  const review = (decision = 'approve') => ({ type: 'packInstallReview', installationId: staged.installationId, manifestHash: staged.manifestHash, decision, reason: 'Structure and conflicts checked on synthetic data' });
  await post(o, review(), 403, undefined, mine);
  view = await read(rv);
  check(() => { assert.equal(view.canStage, false); const i = view.installations[0]; assert.deepEqual([i.state, i.canReview, i.canActivate, i.conflicts.length], ['staged', true, false, 0]); });
  // Nothing opens on a staged or approved pack.
  const person = id => o.state.people.find(p => p.id === id);
  const enrol = (id, status = 200) => post(o, { type: 'enrolProgramme', personId: id, version: person(id).version, packId: 'child_growth', episodeLabel: 'Synthetic child episode', startDate: null }, status, undefined, mine);
  await enrol('p_meena', 422);
  await post(rv, review(), 200, undefined, mine);
  await enrol('p_meena', 422);
  const approve=(kind,reference=`SYNTH-${kind.toUpperCase()}-001`)=>({type:'packInstallApproval',installationId:staged.installationId,manifestHash:staged.manifestHash,kind,reference});
  await post(o,approve('buyer'),200,undefined,mine); await post(rv,approve('clinical'),200,undefined,mine); await post(o,approve('workflow'),200,undefined,mine);
  const activate = { type: 'packInstallActivate', installationId: staged.installationId, manifestHash: staged.manifestHash, reason: 'Activate the reviewed synthetic pack' };
  await post(rv, activate, 403, undefined, mine);
  await post(o, activate, 200, undefined, mine);
  await enrol('p_meena');
  check(() => { const e = person('p_meena').enrolments.find(e => e.packId === 'child_growth'); assert.equal(e.packVersion, 1); assert.ok(o.state.programmePacks.some(p => p.id === 'child_growth' && p.enrollable && p.installed)); });
  const started = (await post(o, { type: 'startVisit', personId: 'p_meena' }, 200, undefined, mine)).result;
  check(() => { const v = o.state.visits.find(v => v.id === started.visitId); assert.ok(v.programmeCapture.packs.some(p => p.pack.id === 'child_growth' && p.pack.questions.some(q => q.id === 'feeding_concern'))); });
  const migration = await (await fetch(`${base}/api/programme-migration`, { headers: { ...o.headers, 'x-saha-organisation': mine } })).json();
  check(() => { const c = migration.catalogue.find(p => p.packId === 'child_growth'); assert.deepEqual([c.versions, c.installedVersions, c.adoptedVersion], [[1], [1], 1]); });
  // Retirement keeps the version and the pinned episode; no new episode opens on it.
  await post(rv, { type: 'packInstallRetire', installationId: staged.installationId, reason: 'Withdraw the synthetic pack after the smoke' }, 403, undefined, mine);
  const retired = (await post(o, { type: 'packInstallRetire', installationId: staged.installationId, reason: 'Withdraw the synthetic pack after the smoke' }, 200, undefined, mine)).result;
  check(() => assert.deepEqual([retired.state, retired.openEpisodes], ['retired', 1]));
  await enrol('p_aarav', 422);
  view = await read(o);
  check(() => { const i = view.installations[0]; assert.deepEqual(i.history.map(h => h.state), ['staged', 'approved', 'active', 'retired']); assert.equal(i.openEpisodes, 1); assert.equal(person('p_meena').enrolments.find(e => e.packId === 'child_growth').state, 'active'); assert.equal(JSON.stringify(view).includes('Meena'), false, 'no patient names in the read'); });
  check(() => assert.deepEqual(sql.prepare("SELECT action FROM audit_events WHERE org_id=? AND action LIKE 'packInstall%' ORDER BY at, rowid").all(mine).map(r => r.action), ['packInstallStage', 'packInstallReview', 'packInstallApproval', 'packInstallApproval', 'packInstallApproval', 'packInstallActivate', 'packInstallRetire']));
  const chain = await (await fetch(`${base}/api/audit/chain`, { headers: { ...o.headers, 'x-saha-organisation': mine } })).json();
  check(() => assert.equal(chain.status, 'intact'));
  return { mine };
}
