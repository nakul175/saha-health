// Journey (c): what each role sees. A supervisor gets Operations and its alerts but not the administration menus; an ASHA's menu is
// care work only (slice 9b rules). The menu is display only; the server checks every read, so one server answer is cross-checked.
import { test, expect } from './support/fixtures.mjs';
import { team, sentVisit, load, menu, menuEntries } from './support/flows.mjs';

test('supervisor sees Operations and alerts and no administration menus; an ASHA menu is care work only', async ({ lab }) => {
  const t = await team(lab, { supervisor: true });
  await sentVisit(lab, t);                                  // leaves one scoped uncertain receipt; aggregate disclosure is withheld below five contributors
  const [owner, sup, asha] = [await load(lab, t.owner), await load(lab, t.sup), await load(lab, t.asha)];

  await test.step('the owner sees every menu entry (control: the absences below can fail)', async () => {
    const entries = await menuEntries(owner);
    for (const name of ['Clinical governance', 'Programmes', 'AI tools', 'Expansion', 'Operations', 'Connections', 'Activity log', 'Organisation & team']) expect(entries).toContain(name);
  });

  await test.step('the supervisor menu has Operations and none of the administration entries', async () => {
    expect(await menuEntries(sup)).toEqual(['My work', 'People', 'Submissions', 'Outreach', 'Care handover', 'Pilot readiness', 'Operations', 'Connections', 'Activity log', 'Organisation & team']);
    for (const name of ['Clinical governance', 'Programmes', 'AI tools', 'Expansion']) await expect(menu(sup, name)).toHaveCount(0);
    await expect(sup.getByRole('button', { name: /^Submissions\s*1$/ })).toBeVisible();             // the uncertain receipt is counted next to its menu entry
  });

  await test.step('Operations withholds the small-cohort aggregate and retains the scoped receipt exception', async () => {
    await menu(sup, 'Operations').click();
    await expect(sup.getByRole('heading', { level: 1, name: 'Keep work moving' })).toBeVisible();
    const alerts = sup.locator('section').filter({ has: sup.getByRole('heading', { name: 'Alerts', exact: true }) });
    await expect(alerts).toContainText('No alerts from current data.');
    await expect(alerts).not.toContainText('Programme submissions not yet confirmed by the destination: 1');
    const disclosed = await lab.api.get(t.sup, '/api/operations', t.org);
    expect(disclosed.status).toBe(200);
    expect(disclosed.json.report.privacy.withheld).toBe(true);
    expect(disclosed.json.report.privacy.minimumCell).toBe(5);
    expect(disclosed.json.report.patients).toBeNull();
    expect(disclosed.json.report.visitsStarted).toBeNull();
    expect(disclosed.json.report.visitsConfirmed).toBeNull();
    expect(disclosed.json.report.backlog.unresolvedSubmissions).toBeNull();
    expect(disclosed.json.report.programmes).toEqual([]);
    expect(disclosed.json.report.destinations).toEqual([]);
    expect(disclosed.json.alerts.some(a => a.id === 'destination-uncertain')).toBe(false);
    await expect(alerts).toContainText('nothing is sent or paged');
    const queue = sup.locator('section').filter({ has: sup.getByRole('heading', { name: 'Exception queue' }) });
    await expect(queue).toContainText('Meena Devi · Community health MIS: outcome unknown after 1 attempt');
    await expect(queue).toContainText('never send again blindly');
    await lab.scan(sup, 'Supervisor · operations');
    await lab.shot(sup, 'operations-withheld.png', { target: alerts });
  });

  await test.step('the ASHA menu holds care work only', async () => {
    expect(await menuEntries(asha)).toEqual(['My work', 'People', 'Submissions', 'Outreach', 'Care handover', 'Organisation & team']);
    for (const name of ['Clinical governance', 'Programmes', 'AI tools', 'Operations', 'Expansion', 'Connections', 'Activity log']) await expect(menu(asha, name)).toHaveCount(0);
    await lab.scan(asha, 'ASHA · menu and home');
  });

  await test.step('the server also refuses an ASHA the operations read', async () => {
    expect((await lab.api.get(t.asha, '/api/operations', t.org)).status).toBe(403);
    expect((await lab.api.get(t.sup, '/api/operations', t.org)).status).toBe(200);
  });
});
