// Positive coverage of destination alerts for a releasable synthetic cohort.
// The separate role journey checks withholding below five; retain all original goldens and guards.
import { test, expect } from './support/fixtures.mjs';
import { load, menu } from './support/flows.mjs';

const TITLE = 'Programme submissions not yet confirmed by the destination';
const ACTION = 'look up the receipt of any uncertain submission before a resend';
const NAMES = ['Amber Lynx', 'Blue Panda', 'Copper Finch', 'Dune Wolf', 'Elm Heron', 'Forest Otter'];

test('supervisor sees the destination-uncertain alert for six distinct authorised demo contributors', async ({ lab }, testInfo) => {
  const owner = lab.who('safe-alert-owner', 'Synthetic Safe Cohort Owner');
  const supervisor = lab.who('safe-alert-supervisor', 'Synthetic Safe Cohort Supervisor');
  const home = await lab.workspace(owner);
  const org = home.organisation.id;
  expect(home.environment).toBe('synthetic');
  expect(home.externalApisEnabled).toBe(false);
  expect(home.signOffPolicy.required).toBe(false);
  const destination = home.integrations.find(i => i.id === 'mis_community');
  expect(destination).toMatchObject({ kind: 'mis', mode: 'demo', status: 'active', behavior: 'uncertain' });
  expect(destination.programmes).toContain('General care');

  const teamId = (await lab.command(owner, { type: 'createTeam', name: 'Synthetic six-person alert cohort' }, org)).result.teamId;
  const current = await lab.workspace(owner, org);
  const member = current.members.find(m => m.userId === current.user.userId);
  await lab.command(owner, {
    type: 'updateMember', userId: current.user.userId, version: member.version,
    role: 'clinician', teamIds: [teamId], isOwner: true, status: 'active',
    reason: 'Synthetic UI fixture limited to one newly created care team',
  }, org);
  const scoped = await lab.workspace(owner, org);
  expect(scoped.membership.teamIds).toEqual([teamId]);
  expect(scoped.people).toHaveLength(0);

  // No browser or aggregate read until all six contributions exist. Patient commands
  // are partitioned; any organisation-wide alert evaluation only previews protection.
  const utcDay = new Date().toISOString().slice(0, 10);
  const people = [], visits = [];
  for (let i = 0; i < NAMES.length; i++) {
    const personId = (await lab.command(owner, {
      type: 'createPerson', name: NAMES[i], age: 22 + i * 5, sex: 'Unknown',
      village: 'Synthetic locality ' + i, programme: 'General care', teamId,
    }, org)).result.personId;
    const visitId = (await lab.command(owner, { type: 'startVisit', personId }, org)).result.visitId;
    let snapshot = await lab.workspace(owner, org);
    let visit = snapshot.visits.find(v => v.id === visitId);
    await lab.command(owner, {
      type: 'saveVisit', visitId, version: visit.version,
      facts: { date: new Date().toISOString().slice(0, 16), weight: '55', systolic: '', diastolic: '', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic protected reporting contribution', source: 'reported' },
    }, org);
    snapshot = await lab.workspace(owner, org);
    visit = snapshot.visits.find(v => v.id === visitId);
    const person = snapshot.people.find(p => p.id === personId);
    await lab.command(owner, {
      type: 'confirmVisit', visitId, version: visit.version,
      patientCheck: { personId, personVersion: person.version, confirmed: true },
    }, org);
    const prepared = await lab.command(owner, { type: 'preparePlan', visitId, recipients: ['mis_community'] }, org);
    const plan = prepared.snapshot.visits.find(v => v.id === visitId).plan;
    await lab.command(owner, { type: 'approvePlan', visitId, planId: plan.id, payloadHash: plan.payloadHash }, org);
    await lab.command(owner, { type: 'executePlan', visitId, planId: plan.id }, org);
    people.push(personId); visits.push(visitId);
  }
  // Crossing UTC midnight creates a genuinely smaller daily component; refuse that
  // fixture rather than overriding dates, resetting the ledger or suppressing a failure.
  expect(new Date().toISOString().slice(0, 10), 'all six confirmations belong to one actual UTC day').toBe(utcDay);
  const completed = await lab.workspace(owner, org);
  expect(new Set(people).size).toBe(6);
  expect(new Set(visits).size).toBe(6);
  expect(completed.people).toHaveLength(6);
  expect(completed.visits).toHaveLength(6);
  expect(completed.visits.every(v => visits.includes(v.id) && v.state === 'confirmed')).toBe(true);
  expect(completed.submissions).toHaveLength(6);
  expect(new Set(completed.submissions.map(s => s.personId)).size).toBe(6);
  expect(new Set(completed.submissions.map(s => s.visitId)).size).toBe(6);
  expect(new Set(completed.submissions.map(s => s.id)).size).toBe(6);
  expect(completed.submissions.every(s => people.includes(s.personId) && visits.includes(s.visitId) && s.connectorId === 'mis_community' && s.state === 'uncertain' && s.mode === 'demo' && s.attempts === 1)).toBe(true);

  const supervisorHome = await lab.workspace(supervisor);
  const invitation = await lab.command(owner, {
    type: 'createInvite', accountCode: supervisorHome.user.accountCode,
    label: 'Synthetic same-cohort supervisor', role: 'supervisor', teamIds: [teamId],
  }, org);
  await lab.command(supervisor, { type: 'joinOrganisation', token: invitation.result.token });
  const before = await lab.workspace(supervisor, org);
  expect(before.role).toBe('supervisor');
  expect(before.membership.teamIds).toEqual([teamId]);
  expect(before.people.map(p => p.id).sort()).toEqual([...people].sort());

  const response = await lab.api.get(supervisor, '/api/operations?days=30&format=json', org);
  expect(response.status).toBe(200);
  expect(response.json.report.privacy).toMatchObject({ withheld: false, minimumCell: 5 });
  expect(response.json.report).toMatchObject({ patients: 6, visitsStarted: 6, visitsConfirmed: 6 });
  expect(response.json.report.backlog.unresolvedSubmissions).toBe(6);
  const alert = response.json.alerts.find(a => a.id === 'destination-uncertain');
  expect(alert).toMatchObject({ title: TITLE, severity: 'high', count: 6 });
  expect(alert.action).toContain(ACTION);

  const page = await load(lab, supervisor, { headers: { 'x-saha-organisation': org } });
  await expect(page.getByRole('button', { name: /^Submissions\s*6$/ })).toBeVisible();
  await menu(page, 'Operations').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Keep work moving' })).toBeVisible();
  const alerts = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Alerts', exact: true }) });
  const row = alerts.getByRole('listitem').filter({ hasText: TITLE + ': 6' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(TITLE + ': 6');
  await expect(row).toContainText('high');
  await expect(row).toContainText(ACTION);
  await expect(alerts).toContainText('nothing is sent or paged');
  await lab.scan(page, 'Supervisor · six-contributor destination alert');

  const after = await lab.workspace(supervisor, org);
  expect(after.people).toEqual(before.people);
  expect(after.visits).toEqual(before.visits);
  expect(after.submissions).toEqual(before.submissions);
  await testInfo.attach('safe-six-destination-alert-proof.json', {
    body: JSON.stringify({ organisationId: org, teamId, people, visits, status: response.status, privacy: response.json.report.privacy, report: response.json.report, alert, visibleAlert: await row.innerText(), submissions: after.submissions.map(s => ({ personId: s.personId, visitId: s.visitId, connectorId: s.connectorId, mode: s.mode, state: s.state, attempts: s.attempts })) }, null, 2),
    contentType: 'application/json',
  });
});
