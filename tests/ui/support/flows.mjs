// Slice 11c: set-up and screen helpers shared by the journeys. Set-up goes through the HTTP API (fast, and the journeys that test
// set-up through the screens do it themselves); the checks always read what the browser shows.
import { expect } from './fixtures.mjs';

export const MEENA = 'Meena Devi';
export const DANGER_NOTE = 'BP 152/114 mmHg; weight 58 kg; headache and swelling of feet for 2 days';

/** The menu entry for a view (desktop sidebar). */
export const menu = (page, name) => page.getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*\\d+)?$`) }).first();   // a count may follow the name
/** The list of menu entries the page shows, in order. */
export const menuEntries = async page => (await page.locator('[data-slot=sidebar-content] [data-slot=sidebar-menu-button]').allInnerTexts()).map(t => t.replace(/\s+\d+$/, '').trim());

/** An owner, an ASHA (invited and joined) and optionally a supervisor, all in the owner's organisation, with Meena Devi assigned to the ASHA. */
export async function team(lab, { supervisor = false, assign = true } = {}) {
  const owner = lab.who('owner', 'Dr Priya Rao'), asha = lab.who('asha', 'Sunita Yadav'), sup = supervisor ? lab.who('sup', 'Anil Verma') : null;
  const wo = await lab.workspace(owner), org = wo.organisation.id;
  const join = async (who, role, label) => {
    const w = await lab.workspace(who);
    const invite = await lab.command(owner, { type: 'createInvite', accountCode: w.user.accountCode, label, role, teamIds: ['default'] }, org);
    await lab.command(who, { type: 'joinOrganisation', token: invite.result.token });
    return w.user.userId;
  };
  const ashaId = await join(asha, 'asha', 'Sunita Yadav');
  if (sup) await join(sup, 'supervisor', 'Anil Verma');
  const meena = wo.people.find(p => p.name === MEENA);
  if (assign) await lab.command(owner, { type: 'assignPatient', personId: meena.id, version: meena.version, teamId: 'default', assignedTo: ashaId, reason: 'UI test caseload' }, org);
  return { owner, asha, sup, org, ashaId, meenaId: meena.id };
}

/** Through the API as the ASHA: a visit for Meena with a danger-sign blood pressure (152/114), started and saved but not confirmed. */
export async function savedVisit(lab, t) {
  const { asha, org, meenaId } = t;
  await lab.command(asha, { type: 'startVisit', personId: meenaId }, org);
  const w = await lab.workspace(asha, org);
  const visit = w.visits.find(v => v.personId === meenaId && v.state === 'draft');
  const facts = { date: new Date(Date.now() - 60000).toISOString().slice(0, 16), systolic: '152', diastolic: '114', weight: '58', temperature: '', weeks: '', coughDays: '', notes: DANGER_NOTE, source: 'measured' };
  await lab.command(asha, { type: 'saveVisit', visitId: visit.id, version: visit.version, facts }, org);
  return { visitId: visit.id };
}

/** Through the API as the ASHA: the same visit, confirmed, with its plan approved and run (one receipt accepted, one uncertain). */
export async function sentVisit(lab, t) {
  const { asha, org, meenaId } = t;
  const { visitId } = await savedVisit(lab, t);
  const w = await lab.workspace(asha, org);
  const saved = w.visits.find(v => v.id === visitId), person = w.people.find(p => p.id === meenaId);
  await lab.command(asha, { type: 'confirmVisit', visitId, version: saved.version, patientCheck: { personId: meenaId, personVersion: person.version, confirmed: true } }, org);
  const prepared = await lab.command(asha, { type: 'preparePlan', visitId, recipients: ['mis_maternal', 'mis_community'] }, org);
  const plan = prepared.snapshot.visits.find(v => v.id === visitId).plan;
  await lab.command(asha, { type: 'approvePlan', visitId, planId: plan.id, payloadHash: plan.payloadHash }, org);
  const sent = await lab.command(asha, { type: 'executePlan', visitId, planId: plan.id }, org);
  expect(sent.snapshot.submissions.map(s => s.state).sort(), 'the demonstration destinations answer with one accepted and one uncertain receipt').toEqual(['accepted', 'uncertain']);
  return { visitId };
}

/** Open the workspace as `who` and wait until it has loaded (the heading of the first view is on screen). */
export async function load(lab, who, options) {
  const page = await lab.open(who, options);
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  return page;
}

/** Click a person in the visit list or the people list. */
export async function openPatient(page, name = MEENA) {
  await page.getByRole('button', { name: new RegExp(name) }).first().click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** The visit form's measurement field by its visible label. */
export const field = (page, label) => page.getByRole('textbox', { name: label, exact: true });
