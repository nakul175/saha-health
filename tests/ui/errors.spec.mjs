// Journey (g): refusals read as refusals. A stranger who opens another organisation, a worker who types an invitation code that does not
// exist, and an address that is not a page each get a clear message and no crash. The browser console reports the refused request
// ("Failed to load resource"); each test allows exactly that message and says why.
import { test, expect } from './fixtures.mjs';
import { team, load, menu, MEENA } from './flows.mjs';

test('a stranger who opens another organisation is refused, with no patient data and no crash', async ({ lab }) => {
  const t = await team(lab);
  const stranger = lab.who('stranger', 'Stranger Ray');
  lab.allow(/status of 403 \(Forbidden\) \S*\/api\/workspace$/, 'the refusal under test: the server answers 403 for an organisation this account does not belong to');
  const page = await lab.open(stranger, { headers: { 'x-saha-organisation': t.org } });
  await page.goto('/', { waitUntil: 'networkidle' });

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Workspace unavailable');
  await expect(alert).toContainText('Your organisation membership is inactive or unavailable.');
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText(MEENA)).toHaveCount(0);                    // none of the organisation's people leak into the page
  await expect(page.getByText('Rampur care organisation')).toHaveCount(0);
  await expect(page.getByText('Visits to do')).toHaveCount(0);
  await lab.scan(page, 'Stranger · refusal');

  await alert.getByRole('button', { name: 'Try again' }).click();         // trying again is refused the same way, still no crash
  await expect(alert).toContainText('Your organisation membership is inactive or unavailable.');
  expect((await lab.api.get(stranger, '/api/workspace', t.org)).status).toBe(403);
  expect((await lab.api.command(stranger, { type: 'startVisit', personId: t.meenaId }, t.org)).status, 'a command is refused too').toBe(403);
});

test('an invitation code that does not exist is refused with a clear message', async ({ lab }) => {
  const asha = lab.who('asha');
  lab.allow(/status of 404 \(Not Found\) \S*\/api\/commands$/, 'the refusal under test: an unknown invitation code answers 404');
  const page = await load(lab, asha);
  await menu(page, 'Organisation & team').click();
  await page.getByRole('button', { name: 'Join organisation' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').first().fill('0'.repeat(64));
  await dialog.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByText('Invitation not found or unavailable.')).toBeVisible();
  await expect(dialog, 'the dialog stays open so the code can be corrected').toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Organisation & team' })).toBeVisible();   // the page is still usable
  await lab.scan(page, 'ASHA · organisation page after a refused code');
});

test('an address that is not a page shows a not-found page', async ({ lab }) => {
  const asha = lab.who('asha');
  lab.allow(/status of 404 \(Not Found\) \S*\/does-not-exist$/, 'the refusal under test: an unknown address answers 404');
  const page = await lab.open(asha);
  const response = await page.goto('/does-not-exist', { waitUntil: 'networkidle' });
  expect(response.status()).toBe(404);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await lab.scan(page, 'Not found page');
});
