// Hosted synthetic staging configuration (1 October 2026): the hosted Worker trusts Cloudflare Access
// only, runs synthetic or training, keeps external APIs off and serves only its workers.dev address.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { readConfig, hostedWorkerConfig, SCHEDULED_CRON } from '../scripts/cloudflare-staging.mjs';

let passed = 0; const check = fn => { fn(); passed++; };
const refuses = (fn, pattern) => check(() => assert.throws(fn, pattern));
const base = { workerName: 'saha-staging', d1DatabaseName: 'saha-staging', environment: 'synthetic', accountId: '', accessTeamDomain: '', accessAud: '' };
const text = o => JSON.stringify({ ...base, ...o });
const ID = '11111111-2222-4333-8444-555555555555';

// The committed configuration is valid and names a synthetic or training environment.
check(() => { const c = readConfig(readFileSync('deploy/cloudflare-staging.json', 'utf8')); assert.ok(['synthetic', 'training'].includes(c.environment)); });
// Staging, production or anything else is refused for this host.
for (const environment of ['staging', 'production', '', 'live']) refuses(() => readConfig(text({ environment })), /synthetic or training/);
// Access values must be well formed and set together.
refuses(() => readConfig(text({ accessTeamDomain: 'example.com', accessAud: 'a'.repeat(64) })), /cloudflareaccess\.com/);
refuses(() => readConfig(text({ accessTeamDomain: 'saha.cloudflareaccess.com' })), /together/);
refuses(() => readConfig(text({ accessAud: 'a'.repeat(64) })), /together/);
refuses(() => readConfig(text({ accountId: 'not-an-account' })), /account ID/);
check(() => assert.equal(readConfig(text({ accessTeamDomain: 'Saha.CloudflareAccess.com', accessAud: 'a'.repeat(64) })).accessTeamDomain, 'saha.cloudflareaccess.com'));

// The built Worker configuration is rewritten so that Sites identity headers are never trusted.
const built = { name: 'site-creator-vinext-starter', vars: { SAHA_IDENTITY_PROVIDER: 'sites-chatgpt', SAHA_EXTERNAL_APIS_ENABLED: 'true' }, routes: [{ pattern: 'example.com/*' }], d1_databases: [{ binding: 'DB', database_id: '00000000-0000-4000-8000-000000000000' }], assets: { directory: '../client' } };
const out = hostedWorkerConfig(built, readConfig(text({ accessTeamDomain: 'saha.cloudflareaccess.com', accessAud: 'b'.repeat(64) })), ID);
check(() => assert.equal(out.vars.SAHA_IDENTITY_PROVIDER, 'cloudflare-access'));
check(() => assert.equal(out.vars.SAHA_EXTERNAL_APIS_ENABLED, 'false'));
check(() => assert.equal(out.vars.SAHA_ENVIRONMENT, 'synthetic'));
check(() => assert.deepEqual([out.vars.SAHA_MIS_CONNECTIONS, out.vars.SAHA_EHR_CONNECTIONS], ['[]', '[]']));
check(() => assert.deepEqual([out.workers_dev, out.preview_urls, out.routes], [true, false, undefined]));
check(() => assert.deepEqual(out.d1_databases, [{ binding: 'DB', database_name: 'saha-staging', database_id: ID, migrations_dir: '../../drizzle' }]));
check(() => assert.deepEqual(out.assets, built.assets));
check(() => assert.equal(built.vars.SAHA_IDENTITY_PROVIDER, 'sites-chatgpt'));
// Without Access values the Worker is still configured, and the identity layer then refuses every request.
check(() => { const o = hostedWorkerConfig(built, readConfig(text({})), ID); assert.deepEqual([o.vars.SAHA_ACCESS_TEAM_DOMAIN, o.vars.SAHA_ACCESS_AUD], ['', '']); });
refuses(() => hostedWorkerConfig(built, readConfig(text({})), ''), /D1 database ID/);
refuses(() => hostedWorkerConfig(built, readConfig(text({})), 'not-a-uuid'), /D1 database ID/);

// Slice 10a: the hosted Worker carries one Cron Trigger (every five minutes) that runs the scheduled job.
check(() => assert.equal(SCHEDULED_CRON, '*/5 * * * *'));
check(() => assert.equal(readConfig(readFileSync('deploy/cloudflare-staging.json', 'utf8')).scheduledCron, '*/5 * * * *'));
check(() => assert.deepEqual(out.triggers, { crons: ['*/5 * * * *'] }));
check(() => assert.equal(readConfig(text({})).scheduledCron, '*/5 * * * *', 'omitted means the default'));
check(() => assert.deepEqual(hostedWorkerConfig(built, readConfig(text({ scheduledCron: '*/10 * * * *' })), ID).triggers, { crons: ['*/10 * * * *'] }));
check(() => assert.deepEqual(hostedWorkerConfig(built, readConfig(text({ scheduledCron: '' })), ID).triggers, { crons: [] }, 'empty turns the trigger off'));
check(() => assert.equal(built.triggers, undefined, 'the built configuration is not changed'));
check(() => assert.deepEqual(hostedWorkerConfig({ ...built, triggers: { crons: ['0 0 * * *'] } }, readConfig(text({})), ID).triggers, { crons: ['*/5 * * * *'] }, 'a trigger in the built file never survives'));
for (const scheduledCron of ['every five minutes', '* * * *', '*/5 * * * * *', '*/5 * * * *; rm', 5]) refuses(() => readConfig(text({ scheduledCron })), /scheduledCron/);
// The external-call switches are unchanged by the trigger: still off, still no connections.
check(() => assert.deepEqual([out.vars.SAHA_EXTERNAL_APIS_ENABLED, out.vars.SAHA_MIS_CONNECTIONS, out.vars.SAHA_EHR_CONNECTIONS], ['false', '[]', '[]']));

// Slice 9c: demo freeze. A merge (push) deploys nothing while SAHA_DEPLOY_FREEZE is "true"; a hand-started run still deploys.
const workflow = readFileSync('.github/workflows/deploy-staging.yml', 'utf8');
check(() => assert.match(workflow, /SAHA_DEPLOY_FREEZE: \$\{\{ vars\.SAHA_DEPLOY_FREEZE \}\}/));
check(() => assert.match(workflow, /\[ "\$TRIGGER" = "push" \] && \[ "\$SAHA_DEPLOY_FREEZE" = "true" \]/));
check(() => assert.match(workflow, /workflow_dispatch:/));
check(() => { const freeze = workflow.indexOf('SAHA_DEPLOY_FREEZE" = "true"'), creds = workflow.indexOf('configured=true'); assert.ok(freeze > 0 && freeze < creds); });

const result = { suite: 'Hosted synthetic staging configuration contract', passed, completedAt: new Date().toISOString() };
writeFileSync('tests/cloudflare-staging-contract-result.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
