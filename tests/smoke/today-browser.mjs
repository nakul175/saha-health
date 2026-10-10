// Built synthetic Worker/D1 only. Never send dispatcher-model headers to a hosted endpoint.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { globSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { startWorker, identity, client } from '../lib/worker.mjs';

const folder = 'tests/reports/today';
mkdirSync(folder, { recursive: true });
let worker,
  browser,
  sql,
  passed = 0;
const checks = [];
const check = (condition, label) => {
  assert.ok(condition, label);
  passed++;
  checks.push(label);
};
const ok = (response) => {
  assert.equal(response.status, 200, response.text);
  return response.json;
};
try {
  worker = await startWorker({ port: '9163', name: 'saha-d02', state: '.wrangler/d02-synthetic-test' });
  const api = client(worker.base),
    run = crypto.randomUUID().slice(0, 8);
  const owner = identity('owner', run),
    asha = identity('asha', run),
    stranger = identity('stranger', run);
  const wo = ok(await api.get(owner, '/api/workspace'));
  const wa = ok(await api.get(asha, '/api/workspace'));
  const ws = ok(await api.get(stranger, '/api/workspace'));
  const org = wo.organisation.id;
  const invite = ok(
    await api.command(
      owner,
      {
        type: 'createInvite',
        accountCode: wa.user.accountCode,
        label: 'Synthetic ASHA',
        role: 'asha',
        teamIds: ['default'],
      },
      org,
    ),
  );
  ok(await api.command(asha, { type: 'joinOrganisation', token: invite.result.token }));
  const file = globSync('.wrangler/d02-synthetic-test/**/*.sqlite').find((file) => !file.includes('cache'));
  assert.ok(file, 'fresh local D1 file');
  sql = new DatabaseSync(file);
  const raw = sql.prepare('SELECT * FROM patients WHERE org_id=? AND id=?').get(org, 'p_meena');
  assert.ok(raw);
  // Owned synthetic fixture: 52 assigned rows prove no 50-row truncation. No production route writes fixtures.
  for (let n = 0; n < 52; n++) {
    const id = `d02_${String(n).padStart(3, '0')}_same_suffix`;
    const person = {
      ...JSON.parse(raw.data),
      id,
      name: 'Synthetic Same Name',
      village: `Synthetic village ${n}`,
      assignedTo: asha.id,
      teamId: 'default',
    };
    sql
      .prepare(
        'INSERT INTO patients (org_id,id,version,name,team_id,assigned_to,data,rev) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(org, id, raw.version, person.name, 'default', asha.id, JSON.stringify(person), 0);
  }
  const merged = {
    ...JSON.parse(raw.data),
    id: 'd02_merged',
    name: 'Synthetic merged record',
    assignedTo: asha.id,
    teamId: 'default',
    mergedInto: { personId: 'p_meena' },
  };
  sql
    .prepare(
      'INSERT INTO patients (org_id,id,version,name,team_id,assigned_to,data,rev) VALUES (?,?,?,?,?,?,?,?)',
    )
    .run(org, merged.id, raw.version, merged.name, 'default', asha.id, JSON.stringify(merged), 0);
  const expected = sql
    .prepare(
      "SELECT id FROM patients WHERE org_id=? AND assigned_to=? AND json_extract(data,'$.mergedInto') IS NULL ORDER BY id",
    )
    .all(org, asha.id)
    .map((row) => row.id);
  const facts = () =>
    JSON.stringify({
      people: sql.prepare('SELECT * FROM patients ORDER BY org_id,id').all(),
      visits: sql.prepare('SELECT * FROM visits ORDER BY org_id,id').all(),
    });
  const before = facts();
  const list = await api.get(asha, '/api/today');
  check(
    list.status === 200 && list.headers.get('cache-control') === 'no-store',
    'A1: authorised uncached list',
  );
  check(
    JSON.stringify(list.json.records.map((row) => row.id)) === JSON.stringify(expected),
    'A1: full 52 rows in source order',
  );
  check(
    list.json.records.every((row) => Object.keys(row).sort().join(',') === 'id,name,village'),
    'A1: narrow response projection',
  );
  check(
    !list.text.includes('Synthetic merged record') &&
      (await api.get(asha, '/api/today?personId=d02_merged')).status === 404,
    'A1/A5: assigned merged record excluded and refused',
  );
  const id = expected[0],
    otherId = expected[1];
  const detail = await api.get(asha, '/api/today?personId=' + id);
  check(detail.status === 200 && detail.json.record.id === id, 'A2: exact selected record');
  check(
    Object.keys(detail.json.record).sort().join(',') === 'age,id,name,sex,village',
    'A3: read-only identity context projection',
  );
  check(facts() === before, 'A3: list/open leave all person and visit facts unchanged');
  check(
    !!sql
      .prepare("SELECT id FROM audit_events WHERE org_id=? AND actor_id=? AND action='listPatients'")
      .get(org, asha.id),
    'A3: durable list audit',
  );
  check(
    !!sql
      .prepare(
        "SELECT id FROM audit_events WHERE org_id=? AND actor_id=? AND person_id=? AND action='viewPatientRecord'",
      )
      .get(org, asha.id, id),
    'A3: durable exact-person read audit',
  );
  for (const [who, path, selectedOrg, status, label] of [
    [null, '/api/today', null, 401, 'anonymous'],
    [owner, '/api/today', org, 403, 'non-ASHA owner'],
    [stranger, '/api/today?personId=' + id, org, 403, 'cross-tenant'],
    [asha, '/api/today?personId=p_meena', null, 404, 'unassigned'],
    [asha, '/api/today?personId=missing', null, 404, 'unknown ID'],
    [asha, '/api/today?personId=%3Cscript%3E', null, 400, 'malformed ID'],
    [asha, '/api/today?personId=' + id + '&personId=' + otherId, null, 400, 'duplicate ID'],
    [asha, '/api/today?role=owner', null, 400, 'extra query'],
    [asha, '/api/today?personId=', null, 400, 'empty ID'],
  ]) {
    const response = await api.get(who, path, selectedOrg);
    check(
      response.status === status && !response.text.includes('Synthetic Same Name'),
      'A5: refusal ' + label,
    );
  }
  sql.prepare('UPDATE patients SET assigned_to=? WHERE org_id=? AND id=?').run(owner.id, org, id);
  check(
    (await api.get(asha, '/api/today?personId=' + id)).status === 404,
    'A5: reassignment enforced on next read',
  );
  sql.prepare('UPDATE patients SET assigned_to=? WHERE org_id=? AND id=?').run(asha.id, org, id);
  sql.prepare("UPDATE memberships SET status='suspended' WHERE org_id=? AND user_id=?").run(org, asha.id);
  check(
    (await api.get(asha, '/api/today', org)).status === 403,
    'A5: suspended membership refuses named organisation',
  );
  sql.prepare("UPDATE memberships SET status='active' WHERE org_id=? AND user_id=?").run(org, asha.id);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await api.call(asha, '/api/today', {
      method,
      body: { type: 'startVisit', personId: id },
    });
    check([404, 405].includes(response.status), 'A6: mutation refused ' + method);
  }
  check((await api.get(asha, '/api/today/commands')).status === 404, 'A6: no nested command route');
  sql.exec(
    "CREATE TRIGGER d02_reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'Synthetic audit outage'); END",
  );
  const failedAudit = await api.get(asha, '/api/today?personId=' + id);
  check(
    failedAudit.status >= 500 && !failedAudit.text.includes('Synthetic Same Name'),
    'A3: audit outage withholds detail',
  );
  const failedList = await api.get(asha, '/api/today');
  check(
    failedList.status >= 500 && !failedList.text.includes('Synthetic Same Name'),
    'A3: audit outage withholds list',
  );
  sql.exec('DROP TRIGGER d02_reject_audit');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    extraHTTPHeaders: asha.headers,
  });
  const page = await context.newPage();
  const errors = [],
    urls = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (request.url().includes('/api/')) urls.push(request.url());
  });
  page.setDefaultTimeout(20000);
  await page.goto(worker.base + '/today');
  await page.getByRole('button', { name: 'Open record ' + id, exact: true }).waitFor();
  check(
    (await page.getByRole('button', { name: /^Open record / }).count()) === 52,
    'A1: browser full assigned list',
  );
  check(
    (await page
      .getByText('Assigned records. This list is not a dated daily schedule.', { exact: true })
      .count()) === 1,
    'A1: truthful schedule label',
  );
  check(
    (await page.getByText(id, { exact: false }).count()) === 1 &&
      (await page.getByText(otherId, { exact: false }).count()) === 1,
    'A2: complete IDs distinguish shared suffix/name',
  );
  for (const selected of [id, otherId]) {
    await page.getByRole('button', { name: 'Open record ' + selected, exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByText('Read-only record context', { exact: true }).waitFor();
    check(
      (await page.locator('dd').nth(1).textContent()) === selected,
      'A2/A7: keyboard opens exact record ' + selected,
    );
    check(
      await page.locator('h1').evaluate((node) => node === document.activeElement),
      'A7: record heading receives focus',
    );
    await page.getByRole('button', { name: 'Back to Today', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Open record ' + id, exact: true }).waitFor();
  }
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const size of ['100%', '200%']) {
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, size);
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `A7: no overflow ${viewport.width} ${size}`,
      );
      const box = await page.getByRole('button', { name: 'Open record ' + id, exact: true }).boundingBox();
      check(box.height >= 44, `A7: touch target ${viewport.width} ${size}`);
    }
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '100%';
  });
  await page.screenshot({ path: folder + '/today.png', fullPage: false });
  check(
    urls.every((url) => new URL(url).pathname === '/api/today'),
    'A6: client calls only narrow story API',
  );
  check(
    (await page.locator('input,textarea,select,a').count()) === 0,
    'A6: no editing or legacy navigation controls',
  );
  check(
    await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0),
    'A8: no persistent plaintext browser records',
  );

  await page.route('**/api/today*', (route) =>
    route.fulfill({ status: 503, json: { error: 'Synthetic source outage' } }),
  );
  await page.getByRole('button', { name: 'Refresh assigned records' }).click();
  await page
    .getByText('Records unavailable. Check your connection and try again.', { exact: true })
    .waitFor();
  check(
    (await page.getByRole('button', { name: /^Open record / }).count()) === 0,
    'A4: failed refresh clears records',
  );
  await page.unroute('**/api/today*');
  for (const [status, text] of [
    [403, 'Access refused.'],
    [409, 'This workspace is not supported by Today.'],
  ]) {
    await page.route('**/api/today*', (route) =>
      route.fulfill({ status, json: { error: 'Synthetic refusal' } }),
    );
    await page.getByRole('button', { name: 'Refresh assigned records' }).click();
    await page.getByRole('status').filter({ hasText: text }).waitFor();
    check((await page.locator('li').count()) === 0, 'A4: distinct withheld state ' + status);
    await page.unroute('**/api/today*');
  }
  await page.route('**/api/today*', (route) => route.fulfill({ status: 200, json: { wrongShape: true } }));
  await page.getByRole('button', { name: 'Refresh assigned records' }).click();
  await page.getByRole('status').filter({ hasText: 'not supported' }).waitFor();
  check((await page.locator('li').count()) === 0, 'A4: unsupported source shape is not empty');
  await page.unroute('**/api/today*');
  sql
    .prepare('UPDATE patients SET assigned_to=? WHERE org_id=? AND assigned_to=?')
    .run(owner.id, org, asha.id);
  await page.getByRole('button', { name: 'Refresh assigned records' }).click();
  await page.getByText('No assigned records.', { exact: true }).waitFor();
  check((await page.locator('li').count()) === 0, 'A4: real empty assignment state');
  sql.prepare('UPDATE patients SET assigned_to=? WHERE org_id=? AND id LIKE ?').run(asha.id, org, 'd02_%');
  await page.getByRole('button', { name: 'Refresh assigned records' }).click();
  await page.getByRole('button', { name: 'Open record ' + id, exact: true }).waitFor();
  await context.setOffline(true);
  await page.getByRole('status').filter({ hasText: 'Records unavailable' }).waitFor();
  check((await page.locator('li').count()) === 0, 'A8: offline clears content');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Open record ' + id, exact: true }).waitFor();
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/today*', async (route) => {
    await barrier;
    await route.fulfill({ json: list.json }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Refresh assigned records' }).click();
  await page.getByRole('status').filter({ hasText: 'Loading' }).waitFor();
  await context.setOffline(true);
  release();
  await page.getByRole('status').filter({ hasText: 'Records unavailable' }).waitFor();
  check((await page.locator('li').count()) === 0, 'A8: aborted late response cannot restore old records');
  await page.unroute('**/api/today*');
  await context.setOffline(false);
  await context.setExtraHTTPHeaders(owner.headers);
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'Access refused' }).waitFor();
  check((await page.locator('li').count()) === 0, 'A5/A8: account change clears protected content');
  check(errors.length === 0, 'A9: no browser application errors');
  check(
    ok(await api.get(owner, '/api/workspace')).organisation.id === org,
    'A9: legacy workspace still works',
  );
  check(
    ok(await api.get(stranger, '/api/workspace')).organisation.id === ws.organisation.id,
    'A9: legacy tenant identity remains intact',
  );
  await worker.stop();
  worker = await startWorker({
    port: '9163',
    name: 'saha-d02-training',
    state: '.wrangler/d02-synthetic-test',
    fresh: false,
    vars: { SAHA_ENVIRONMENT: 'training' },
  });
  check(
    (await client(worker.base).get(asha, '/api/today', org)).status === 200,
    'A1: actual training environment allowed',
  );
  await worker.stop();
  worker = await startWorker({
    port: '9163',
    name: 'saha-d02-staging',
    state: '.wrangler/d02-synthetic-test',
    fresh: false,
    vars: { SAHA_ENVIRONMENT: 'staging' },
  });
  const staging = await client(worker.base).get(asha, '/api/today', org);
  check(
    staging.status === 409 && !staging.text.includes('Synthetic Same Name'),
    'A1/A5: actual staging environment withheld',
  );
  writeFileSync(
    folder + '/result.json',
    JSON.stringify(
      {
        passed,
        failed: 0,
        checks,
        limits:
          'Synthetic local Worker/D1 + desktop Chromium. No hosted, physical-phone, clinical or human acceptance.',
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed, failed: 0 }));
} catch (error) {
  writeFileSync(
    folder + '/result.json',
    JSON.stringify({ passed, failed: 1, checks, error: String(error) }, null, 2),
  );
  if (worker) writeFileSync(folder + '/worker-failure.log', worker.output());
  throw error;
} finally {
  sql?.close();
  await browser?.close();
  await worker?.stop();
}
