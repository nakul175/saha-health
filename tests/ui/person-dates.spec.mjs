// Slice 14c: the pregnancy and birth dates dialog on the actual workspace (synthetic people only).
import { test, expect } from './support/fixtures.mjs';
import { team, load, openPatient, field } from './support/flows.mjs';
const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test('person dates: record, replace with a reason, withdraw; history is kept', async ({ lab }) => {
  const t = await team(lab), page = await load(lab, t.asha);
  await openPatient(page);
  await page.getByRole('button', { name: 'Pregnancy & birth dates' }).click();
  const dlg = page.getByRole('dialog'), current = dlg.getByRole('region', { name: 'Current dates' }), history = dlg.getByRole('region', { name: 'Date history' });
  await expect(dlg.getByText('Not recorded').first()).toBeVisible();
  await expect(dlg.getByText('No dates recorded yet.')).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Save date' })).toBeDisabled();
  await dlg.getByLabel('Date', { exact: true }).fill(day(-90));
  await dlg.getByRole('button', { name: 'Save date' }).click();
  await expect(current).toContainText(`${day(-90)} · Told by the person or family`);
  let w = await lab.workspace(t.asha, t.org), p = w.people.find(x => x.id === t.meenaId);
  expect(p.dateEntries).toHaveLength(1);
  expect(p.dateEntries[0].kind).toBe('lmp');
  // Replacing needs a reason: the button stays disabled until one is given.
  await dlg.getByLabel('Date', { exact: true }).fill(day(-80));
  await expect(dlg.getByRole('button', { name: 'Replace date' })).toBeDisabled();
  await dlg.getByLabel(/Why replace/).fill('Card shows a later date');
  await dlg.getByRole('button', { name: 'Replace date' }).click();
  await expect(current).toContainText(`${day(-80)} · Told by the person or family`);
  w = await lab.workspace(t.asha, t.org); p = w.people.find(x => x.id === t.meenaId);
  expect(p.dateEntries).toHaveLength(2);
  expect(p.dateEntries[1].supersedes).toBe(p.dateEntries[0].id);
  await expect(history).toContainText('Reason: Card shows a later date');
  // Withdraw the current entry with a reason; both entries stay in the history.
  await dlg.getByRole('button', { name: 'Withdraw' }).first().click();
  await expect(dlg.getByRole('button', { name: 'Withdraw entry' })).toBeDisabled();
  await dlg.getByLabel(/Why withdraw/).fill('Entered on the wrong person');
  await dlg.getByRole('button', { name: 'Withdraw entry' }).click();
  await expect(history).toContainText('Entered on the wrong person');
  await expect(current).toContainText('Last menstrual period (LMP): Not recorded');
  w = await lab.workspace(t.asha, t.org); p = w.people.find(x => x.id === t.meenaId);
  expect(p.dateEntries).toHaveLength(2);
  expect(p.dateEntries.at(-1).withdrawn.reason).toBe('Entered on the wrong person');
  const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
});
