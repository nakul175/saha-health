import { test, expect } from './support/fixtures.mjs';
import { team } from './support/flows.mjs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const url = t => `/follow-ups?personId=${encodeURIComponent(t.meenaId)}&organisationId=${encodeURIComponent(t.org)}`;
async function setup(lab) {
  const t = await team(lab);
  let state = await lab.workspace(t.owner, t.org), person = state.people.find(p => p.id === t.meenaId);
  t.ownerUserId = state.user.userId;
  const made = await lab.command(t.owner, { type: 'householdCreate', personId: person.id, version: person.version,
    label: 'Synthetic follow-up household', relationship: 'head' }, t.org);
  t.householdId = made.result.householdId;
  state = await lab.workspace(t.owner, t.org); person = state.people.find(p => p.id === t.meenaId);
  const episode = await lab.command(t.owner, { type: 'enrolProgramme', personId: person.id, version: person.version,
    packId: 'tb', episodeLabel: 'Synthetic existing follow-up episode', startDate: null }, t.org);
  state = await lab.workspace(t.owner, t.org); person = state.people.find(p => p.id === t.meenaId);
  const followup = await lab.command(t.owner, { type: 'scheduleFollowUp', personId: person.id, version: person.version,
    enrolmentId: episode.result.enrolmentId, title: 'Existing scoped follow-up', due: day(-2), ownerId: t.ashaId }, t.org);
  t.followupId = followup.result.taskId;
  const created = await lab.command(t.asha, { type: 'householdVisitSchedule', householdId: t.householdId, version: 1,
    date: day(1), window: 'morning', covers: [{ personId: t.meenaId, items: [{ kind: 'follow-up', id: t.followupId }] }] }, t.org);
  t.slotId = created.result.visitId;
  return t;
}

function stored(org) {
  const script = `import pathlib,sqlite3,json,sys
files=[]
for candidate in (pathlib.Path(sys.argv[1])/'v3'/'d1').rglob('*.sqlite'):
 probe=sqlite3.connect('file:'+str(candidate)+'?mode=ro',uri=True,timeout=5)
 names={row[0] for row in probe.execute("SELECT name FROM sqlite_master WHERE type='table'")}
 probe.close()
 if {'patients','visits','households','command_receipts'} <= names: files.append(candidate)
assert len(files)==1, str(files)
con=sqlite3.connect('file:'+str(files[0])+'?mode=ro',uri=True,timeout=5)
result={}
for table in ['patients','visits','households','command_receipts']:
 result[table]=con.execute('SELECT * FROM '+table+' WHERE org_id=? ORDER BY rowid',(sys.argv[2],)).fetchall()
print(json.dumps(result))
con.close()`;
  return JSON.parse(execFileSync('python3', ['-c', script, resolve('.wrangler/saha-ui-state'), org], { timeout: 10000, maxBuffer: 16 * 1024 * 1024 }).toString());
}
async function plan(lab, t, who = t.asha) {
  const r = await lab.api.get(who, '/api/household?personId=' + encodeURIComponent(t.meenaId), t.org);
  expect(r.status).toBe(200); return r.json.visitPlan;
}
async function open(lab, t, viaToday = false) {
  const page = await lab.open(t.asha, { viewport: { width: 390, height: 844 } });
  if (viaToday) {
    await page.goto('/today');
    await page.getByRole('button', { name: 'Open record ' + t.meenaId, exact: true }).click();
    const entry = page.getByRole('link', { name: 'View planned follow-ups', exact: true });
    await expect(entry).toHaveAttribute('href', url(t)); await entry.click();
  } else await page.goto(url(t));
  await expect(page.getByRole('heading', { name: 'Meena Devi', exact: true })).toBeVisible();
  return page;
}

test('assigned mobile worker cancels without writes, then confirms an existing slot without changing clinical work', async ({ lab }) => {
  const t = await setup(lab), page = await open(lab, t, true), before = stored(t.org);
  const posts = []; page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/commands') posts.push(request.postDataJSON()); });
  await expect(page.getByText('Currently 2 days overdue', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Change visit time' }).click();
  await expect(page.getByLabel('New visit date')).toBeFocused();
  await page.getByLabel('New visit date').fill(day(3));
  await page.getByRole('button', { name: 'Keep current visit time' }).click();
  await expect(page.getByRole('button', { name: 'Change visit time' })).toBeFocused();
  expect(posts).toHaveLength(0); expect(stored(t.org)).toEqual(before);
  await page.getByRole('button', { name: 'Change visit time' }).click();
  await page.getByLabel('New visit date').fill(day(3)); await page.getByLabel('Time of day').selectOption('afternoon');
  await page.getByRole('button', { name: 'Confirm new visit time' }).click();
  await expect(page.getByRole('status')).toHaveText('New visit time saved and confirmed from the server plan.');
  await expect(page.getByRole('heading', { name: day(3) + ' · Afternoon' })).toBeVisible();
  await expect(page.getByText('Currently 2 days overdue', { exact: false })).toBeVisible();
  expect(posts).toHaveLength(1); expect(posts[0].type).toBe('householdVisitReschedule');
  expect(posts[0]).not.toHaveProperty('reason'); expect(posts[0]).not.toHaveProperty('approval');
  const after = stored(t.org), current = await plan(lab, t), previous = current.visits.find(v => v.id === t.slotId), replacement = current.visits.find(v => v.replacesVisitId === t.slotId);
  expect(after.patients).toEqual(before.patients); expect(after.visits).toEqual(before.visits);
  expect(after.command_receipts.length).toBe(before.command_receipts.length + 1);
  expect(previous.state).toBe('cancelled'); expect(previous.replacedByVisitId).toBe(replacement.id);
  expect(current.visits.filter(v => v.state === 'planned')).toHaveLength(1);
  expect(replacement.covers[0].items.map(i => ({ id: i.id, due: i.due, open: i.open }))).toEqual(previous.covers[0].items.map(i => ({ id: i.id, due: i.due, open: i.open })));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await lab.scan(page, 'Frontline follow-up result · 390 phone');
  await test.info().attach('actual-reschedule-state.json', { body: JSON.stringify({ before, after, posts, previous, replacement }), contentType: 'application/json' });
});

test('stale member version refuses atomically with an explicit refresh path', async ({ lab }) => {
  lab.allow(/status of 409 \(Conflict\) \S*\/api\/commands$/, 'The deliberate stale-version proposal is refused by the existing server command.');
  const t = await setup(lab), page = await open(lab, t);
  await page.getByRole('button', { name: 'Change visit time' }).click(); await page.getByLabel('New visit date').fill(day(3));
  let state = await lab.workspace(t.owner, t.org), p = state.people.find(p => p.id === t.meenaId);
  await lab.command(t.owner, { type: 'scheduleFollowUp', personId: p.id, version: p.version,
    enrolmentId: p.followUps.find(f => f.id === t.followupId).enrolmentId, title: 'Separately added open task', due: day(4), ownerId: t.ashaId }, t.org);
  const before = stored(t.org);
  const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/commands');
  await page.getByRole('button', { name: 'Confirm new visit time' }).click();
  expect((await response).status()).toBe(409);
  await expect(page.getByRole('status')).toHaveText('The proposal was refused. Refresh the plan before choosing another time.');
  expect(stored(t.org)).toEqual(before);
  await page.getByRole('button', { name: 'Refresh current plan' }).click();
  await expect(page.getByRole('heading', { name: 'Meena Devi', exact: true })).toBeVisible();
  expect((await plan(lab, t)).visits.filter(v => v.state === 'planned')).toHaveLength(1);
  await lab.scan(page, 'Frontline stale-proposal refreshed plan');
});

test('assignment revocation refuses the write and clears protected content', async ({ lab }) => {
  lab.allow(/status of 403 \(Forbidden\) \S*\/api\/commands$/, 'The deliberately revoked assignment refuses this protected reschedule.');
  const t = await setup(lab), page = await open(lab, t);
  await page.getByRole('button', { name: 'Change visit time' }).click(); await page.getByLabel('New visit date').fill(day(3));
  const state = await lab.workspace(t.owner, t.org), p = state.people.find(p => p.id === t.meenaId);
  await lab.command(t.owner, { type: 'assignPatient', personId: p.id, version: p.version, teamId: 'default', assignedTo: t.ownerUserId, reason: 'Synthetic authority revocation' }, t.org);
  const before = stored(t.org), response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/commands');
  await page.getByRole('button', { name: 'Confirm new visit time' }).click(); expect((await response).status()).toBe(403);
  await expect(page.getByRole('status')).toHaveText('Access refused. Protected content cleared.');
  await expect(page.getByText('Meena Devi', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Existing scoped follow-up', { exact: true })).toHaveCount(0);
  expect(stored(t.org)).toEqual(before);
  await lab.scan(page, 'Frontline revoked record refusal');
});

test('direct anonymous and cross-organisation selectors cannot disclose a plan', async ({ lab }) => {
  lab.allow(/status of (401 \(Unauthorized\)|403 \(Forbidden\)) \S*\/api\/today\?personId=/, 'The deliberate anonymous/foreign-organisation read is refused before any household projection.');
  const t = await setup(lab), foreign = await lab.workspace(lab.who('foreign', 'Foreign synthetic worker'));
  const anonymous = await lab.open(null); await anonymous.goto(url(t));
  await expect(anonymous.getByText('Access refused. Sign in with the assigned ASHA account.', { exact: true })).toBeVisible();
  const page = await lab.open(t.asha); await page.goto(`/follow-ups?personId=${t.meenaId}&organisationId=${foreign.organisation.id}`);
  await expect(page.getByText('Access refused. Sign in with the assigned ASHA account.', { exact: true })).toBeVisible();
  await expect(page.getByText('Meena Devi', { exact: true })).toHaveCount(0);
  await lab.scan(page, 'Frontline foreign organisation refusal');
});

test('offline failure clears the plan without claiming that an unavailable read is empty', async ({ lab }) => {
  const t = await setup(lab), page = await open(lab, t), before = stored(t.org);
  await page.context().setOffline(true);
  await expect(page.getByText('Plan unavailable. Check your connection and refresh.', { exact: true })).toBeVisible();
  await expect(page.getByText('Meena Devi', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No planned household visits for this record.', { exact: true })).toHaveCount(0);
  expect(stored(t.org)).toEqual(before);
  await page.context().setOffline(false);
  await expect(page.getByRole('heading', { name: 'Meena Devi', exact: true })).toBeVisible();
  await lab.scan(page, 'Frontline reconnected plan');
});

test('a lost committed reply stays uncertain until a read confirms the linked replacement, without resending', async ({ lab }) => {
  const t = await setup(lab), page = await open(lab, t), before = stored(t.org);
  const origin = new URL(page.url()).origin, observations = [];
  lab.allow(/net::ERR_CONNECTION_RESET \S*\/api\/commands$/, 'This test deliberately drops only the real committed reschedule reply; the server request is not changed or retried.');
  await page.route(url => url.origin === origin && url.pathname === '/api/commands', async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    const request = route.request();
    const response = await route.fetch({ timeout: 15000, maxRetries: 0, maxRedirects: 0 });
    observations.push({ body: request.postDataJSON(), key: request.headers()['idempotency-key'], status: response.status(), actualResponse: await response.json() });
    // A genuine server command has returned; discard its reply, never fabricate a response body.
    await route.abort('connectionreset');
  });
  await page.getByRole('button', { name: 'Change visit time' }).click(); await page.getByLabel('New visit date').fill(day(3));
  await page.getByRole('button', { name: 'Confirm new visit time' }).click();
  await expect(page.getByRole('status')).toHaveText('Result not confirmed. Refresh to check the saved plan; the request will not be sent again automatically.');
  expect(observations).toHaveLength(1); expect(observations[0].status).toBe(200); expect(observations[0].key).toBeTruthy();
  expect(observations[0].actualResponse.result.replacesVisitId).toBe(t.slotId);
  const committed = stored(t.org);
  expect(committed.command_receipts.length).toBe(before.command_receipts.length + 1);
  expect(committed.patients).toEqual(before.patients); expect(committed.visits).toEqual(before.visits);
  await page.getByRole('button', { name: 'Refresh current plan' }).click();
  await expect(page.getByRole('status')).toHaveText('New visit time saved and confirmed from the server plan.');
  expect(observations).toHaveLength(1); expect(stored(t.org)).toEqual(committed);
  await lab.scan(page, 'Frontline uncertain committed change reconciled by read');
  await test.info().attach('actual-lost-reply-state.json', { body: JSON.stringify({ before, committed, observations }), contentType: 'application/json' });
});

test('partially visible shared visits label only visible people and never expose hidden work or offer a change', async ({ lab }) => {
  const t = await setup(lab);
  let state = await lab.workspace(t.owner, t.org);
  const visible = state.people.find(p => p.name === 'Rajesh Kumar'), hidden = state.people.find(p => p.name === 'Sunita Bai');
  expect(visible).toBeTruthy(); expect(hidden).toBeTruthy();
  for (const person of [visible, hidden]) {
    const current = await plan(lab, t, t.owner);
    await lab.command(t.owner, { type: 'householdAddMember', householdId: t.householdId, version: current.householdVersion,
      personId: person.id, personVersion: person.version, relationship: 'other' }, t.org);
  }
  state = await lab.workspace(t.owner, t.org);
  await lab.command(t.owner, { type: 'assignPatient', personId: visible.id, version: state.people.find(p => p.id === visible.id).version,
    teamId: 'default', assignedTo: t.ashaId, reason: 'Synthetic partially visible household fixture' }, t.org);
  const own = await plan(lab, t, t.owner);
  const made = await lab.command(t.owner, { type: 'householdVisitSchedule', householdId: t.householdId, version: own.householdVersion,
    date: day(2), window: 'morning', covers: [t.meenaId, visible.id, hidden.id].map(personId => ({ personId, items: [{ kind: 'home-visit', id: personId }] })) }, t.org);
  const beforeTwo = stored(t.org), twoPlan = await plan(lab, t), two = twoPlan.visits.find(s => s.id === made.result.visitId);
  expect(two.covers).toHaveLength(2); expect(two.outsideScopeCovered).toBe(1); expect(two.canReschedule).toBe(false);
  expect(JSON.stringify(twoPlan)).not.toContain(hidden.id); expect(JSON.stringify(twoPlan)).not.toContain(hidden.name);
  const page = await open(lab, t), posts = [];
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/commands') posts.push(r.postDataJSON()); });
  const shared = page.getByRole('heading', { name: day(2) + ' · Morning', exact: true }).locator('..');
  await expect(shared.getByText('This shared visit shows 2 people within your access. Only this record’s work is shown.', { exact: true })).toBeVisible();
  const limitation = 'Other covered people are outside your access. Their details are not shown, and changing this shared visit time is unavailable.';
  await expect(shared.getByText(limitation, { exact: true })).toBeVisible();
  await expect(shared.getByRole('button', { name: 'Change visit time' })).toHaveCount(0);
  await expect(page.getByText(visible.name, { exact: true })).toHaveCount(0); await expect(page.getByText(hidden.name, { exact: true })).toHaveCount(0);
  expect(posts).toHaveLength(0); const afterTwo = stored(t.org); expect(afterTwo).toEqual(beforeTwo);
  await lab.scan(page, 'Frontline shared visit · two visible people, others outside scope');
  state = await lab.workspace(t.owner, t.org);
  await lab.command(t.owner, { type: 'assignPatient', personId: visible.id, version: state.people.find(p => p.id === visible.id).version,
    teamId: 'default', assignedTo: t.ownerUserId, reason: 'Synthetic narrowed covered-person scope' }, t.org);
  const beforeOne = stored(t.org);
  await page.getByRole('button', { name: 'Refresh current plan' }).click();
  await expect(shared.getByText('This shared visit shows 1 person within your access. Only this record’s work is shown.', { exact: true })).toBeVisible();
  await expect(shared.getByText(limitation, { exact: true })).toBeVisible();
  await expect(shared.getByRole('button', { name: 'Change visit time' })).toHaveCount(0);
  const onePlan = await plan(lab, t), one = onePlan.visits.find(s => s.id === made.result.visitId);
  expect(one.covers).toHaveLength(1); expect(one.outsideScopeCovered).toBe(2); expect(one.canReschedule).toBe(false);
  expect(JSON.stringify(onePlan)).not.toContain(hidden.id); expect(JSON.stringify(onePlan)).not.toContain(visible.id);
  await expect(page.getByText(visible.name, { exact: true })).toHaveCount(0); await expect(page.getByText(hidden.name, { exact: true })).toHaveCount(0);
  expect(posts).toHaveLength(0); const afterOne = stored(t.org); expect(afterOne).toEqual(beforeOne);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await lab.scan(page, 'Frontline shared visit · one visible person, others outside scope');
  await test.info().attach('actual-partial-shared-scope-state.json', { body: JSON.stringify({ two, one, beforeTwo, afterTwo, beforeOne, afterOne, posts }), contentType: 'application/json' });
});
