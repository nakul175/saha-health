import assert from 'node:assert/strict';
// Slice 6n: declared environment, fixture marking and the owner-only configuration check over HTTP.
// The test Worker declares no SAHA_ENVIRONMENT, so it runs as the default synthetic environment.
export async function environmentSmoke({ get, post, check, accounts, org, base, sql }) {
  const { owner: o, worker: w, supervisor: sv, admin: a, clinician: c, stranger: x } = accounts;
  const read = async (who, orgId = org, status = 200) => { const r = await fetch(`${base}/api/environment`, { headers: { ...who.headers, 'x-saha-organisation': orgId } }); const j = await r.json(); check(() => assert.equal(r.status, status, JSON.stringify(j).slice(0, 300))); return j; };
  for (const who of [w, sv, a, c]) { const j = await read(who, org, 403); check(() => assert.match(j.error, /Only an organisation owner/)); }
  await read(x, org, 403);
  await get(o, '/api/workspace', 200, org);
  check(() => { assert.equal(o.state.environment, 'synthetic'); assert.equal(o.state.environmentLabel, 'Synthetic development and demonstration environment'); assert.equal(o.state.externalApisEnabled, false); });
  const report = await read(o);
  check(() => { assert.equal(report.environment, 'synthetic'); assert.equal(report.source, 'default'); assert.deepEqual(report.policy, { fixtures: true, live: 'switch', demoConnectors: true, syntheticRecordsLive: true }); assert.equal(report.live.allowed, false); assert.match(report.live.reason, /switch is off/); });
  check(() => { const ids = report.checks.map(c => c.id); for (const id of ['environment', 'identity', 'external-switch']) assert.ok(ids.includes(id), id); assert.equal(report.checks.find(c => c.id === 'environment').status, 'warning'); assert.equal(report.checks.find(c => c.id === 'identity').status, 'ok'); assert.equal(report.counts.ok + report.counts.warning + report.counts.error, report.checks.length); assert.match(report.notice, /no secret value/); });
  // Connections configured by earlier suites are listed by name and state; the test server holds no credentials.
  check(() => { const http = o.state.integrations.filter(i => i.mode === 'http'); for (const i of http) { const line = report.checks.find(c => c.id === `connection:${i.id}`); assert.ok(line, i.id); if (i.credentialBinding) assert.ok(line.message.includes(i.credentialBinding)); } });
  // A new account's seeded home organisation: six synthetic fixture people, each marked.
  const fresh = { headers: { 'oai-authenticated-user-id': `env-${crypto.randomUUID()}`, 'oai-authenticated-user-email': 'env-fresh@example.invalid' }, state: null };
  await get(fresh, '/api/workspace');
  check(() => { assert.equal(fresh.state.people.length, 6); assert.ok(fresh.state.people.every(p => p.synthetic === true)); assert.ok(fresh.state.integrations.some(i => i.mode === 'demo')); });
  const freshReport = await read(fresh, fresh.state.organisation.id);
  check(() => { assert.equal(freshReport.checks.some(c => c.id === 'synthetic-records' || c.id === 'demo-connectors'), false, 'fixtures are expected in the synthetic environment'); assert.equal(freshReport.counts.error, 0); });
  // In the synthetic environment the guards leave demonstration connectors usable.
  const demo = fresh.state.integrations.find(i => i.mode === 'demo' && i.status === 'active');
  await post(fresh, { type: 'toggleIntegration', integrationId: demo.id, version: demo.version }, 200, undefined, fresh.state.organisation.id);
  const paused = fresh.state.integrations.find(i => i.id === demo.id);
  // SAHA-133: reactivation targets the exact post-toggle release. Seed only this
  // synthetic fixture's release-3 assurance inventory; the command still has to
  // pass the product's provider-assurance activation gate.
  const assuranceRow = sql.prepare('SELECT data FROM operations WHERE org_id=?').get(fresh.state.organisation.id);
  const assuranceOperations = assuranceRow ? JSON.parse(assuranceRow.data) : { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null };
  const assuranceAt = new Date().toISOString();
  assuranceOperations.supplyChain = [...(assuranceOperations.supplyChain ?? []), { id: `environment-smoke-${demo.id}`, kind: 'provider', name: 'Synthetic completeness assistant assurance', release: '3', ownerId: fresh.state.user.userId, controls: ['Signed synthetic provider release'], subprocessors: [{ name: 'None disclosed', purpose: 'Explicit synthetic provider declaration', jurisdiction: 'Not applicable' }], incidentContact: 'SECURITY-CASE-QUEUE', updateObligation: 'Notify the accountable owner before this supported release changes.', supportUntil: '2099-01-01', materialChange: 'Exact synthetic release 3 assessed for the environment activation fixture.', componentId: demo.id, version: 1, updatedBy: fresh.state.user.userId, updatedAt: assuranceAt, findings: [], history: [] }];
  sql.prepare('INSERT INTO operations (org_id,data) VALUES (?,?) ON CONFLICT(org_id) DO UPDATE SET data=excluded.data').run(fresh.state.organisation.id, JSON.stringify(assuranceOperations));
  await post(fresh, { type: 'toggleIntegration', integrationId: demo.id, version: paused.version }, 200, undefined, fresh.state.organisation.id);
  check(() => assert.equal(fresh.state.integrations.find(i => i.id === demo.id).status, 'active'));
}
