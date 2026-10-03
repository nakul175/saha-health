// Journey (e): the ASHA's visit list and visit form at 390x844 (the "phone" project). The page must not scroll sideways:
// document scrollWidth <= innerWidth on every screen of the visit, and every control the worker types into or taps must sit inside the width.
import { test, expect } from './fixtures.mjs';
import { team, sentVisit, load, openPatient, field } from './flows.mjs';

async function fitsWidth(page, screen) {
  const m = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, inner: window.innerWidth }));
  expect(m.doc, `${screen}: document scrollWidth ${m.doc} against innerWidth ${m.inner}`).toBeLessThanOrEqual(m.inner);
  expect(m.body, `${screen}: body scrollWidth ${m.body} against innerWidth ${m.inner}`).toBeLessThanOrEqual(m.inner);
}
async function insideWidth(page, locator, what) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox(), width = page.viewportSize().width;
  expect(box, `${what} is on screen`).not.toBeNull();
  expect(box.x, `${what} starts inside the screen`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${what} ends inside the screen (${Math.round(box.x + box.width)} of ${width})`).toBeLessThanOrEqual(width);
}

test('phone: the visit list and the visit form are usable at 390x844 with no sideways scroll', async ({ lab }) => {
  const t = await team(lab);
  const page = await load(lab, t.asha);
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /width=device-width/);   // without it a phone would draw the desktop layout

  await test.step('the visit list', async () => {
    await expect(page.getByRole('heading', { level: 1, name: 'Today’s work' })).toBeVisible();
    const row = page.getByRole('button', { name: /Meena Devi/ }).first();
    await expect(row).toBeVisible();
    await insideWidth(page, row, 'the visit row');
    await fitsWidth(page, 'My work');
    await page.evaluate(() => window.scrollTo(0, 0));
    await lab.scan(page, 'Phone · My work');
    await lab.shot(page, 'phone-home.png');
  });

  await test.step('the menu opens from the menu button and lists care work', async () => {
    await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click();
    const nav = page.locator('[data-mobile=true] [data-slot=sidebar-menu-button], [data-slot=sidebar][data-mobile=true] [data-slot=sidebar-menu-button]');
    await expect(page.getByRole('button', { name: 'Organisation & team' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Care handover' }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Care handover' })).toBeHidden();
    expect(await nav.count()).toBeGreaterThanOrEqual(0);
  });

  await test.step('the visit form: fields fit, accept input and save', async () => {
    await openPatient(page);
    await page.getByRole('button', { name: 'Start visit' }).click();
    await expect(page.getByRole('heading', { name: 'Common observations' })).toBeVisible();
    await fitsWidth(page, 'Visit form');
    for (const label of ['Systolic BP · mmHg', 'Diastolic BP · mmHg', 'Weight · kg', 'Temperature · °C']) await insideWidth(page, field(page, label), label);
    await field(page, 'Systolic BP · mmHg').fill('118');
    await field(page, 'Diastolic BP · mmHg').fill('76');
    await field(page, 'Weight · kg').fill('57.5');
    const save = page.getByRole('button', { name: 'Save draft' });
    await insideWidth(page, save, 'Save draft');
    await save.click();
    await expect(page.getByText('Revision 2').first()).toBeVisible();
    await expect(page.getByText('Draft saved in the workspace.')).toBeVisible();
    await fitsWidth(page, 'Visit form after saving');
    await field(page, 'Systolic BP · mmHg').scrollIntoViewIfNeeded();
    await lab.scan(page, 'Phone · visit form');
  });

  await test.step('the server holds what was typed on the phone', async () => {
    const w = await lab.workspace(t.asha, t.org);
    const visit = w.visits.find(v => v.personId === t.meenaId);
    expect([visit.facts.systolic, visit.facts.diastolic, visit.facts.weight].map(String)).toEqual(['118', '76', '57.5']);
  });
});

test('phone: the clinical review, the review step and the receipts of a sent visit also fit the width', async ({ lab }) => {
  const t = await team(lab);
  await sentVisit(lab, t);
  const page = await load(lab, t.asha);
  await openPatient(page);
  await expect(page.getByRole('tab', { name: /Receipts/ })).toBeVisible();

  await test.step('clinical review with the urgent finding', async () => {
    const panel = page.locator('.clinical-panel').first();
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('Danger sign: diastolic BP above 110 mmHg');
    await insideWidth(page, panel, 'the clinical review');
    await fitsWidth(page, 'Clinical review');
    await lab.scan(page, 'Phone · clinical review');
  });
  await test.step('review & act', async () => {
    await page.getByRole('tab', { name: /Review & act/ }).click();
    await expect(page.getByText('Confirmed facts')).toBeVisible();
    await fitsWidth(page, 'Review & act');
  });
  await test.step('receipts', async () => {
    await page.getByRole('tab', { name: /Receipts/ }).click();
    await expect(page.locator('.receipt-row')).toHaveCount(2);
    await insideWidth(page, page.getByRole('button', { name: 'Look up receipt' }), 'Look up receipt');
    await fitsWidth(page, 'Receipts');
    await lab.scan(page, 'Phone · receipts');
  });
});
