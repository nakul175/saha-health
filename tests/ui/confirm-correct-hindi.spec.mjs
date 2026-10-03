// Slice r96: axe-core accessibility audit of the visit confirmation step, the correction (amend) and wrong-patient (void)
// dialogs, and the Hindi workspace screens, at desktop (1280x720) and phone (390x844) widths. It mirrors the slice 11c UI
// setup: the shared lab.scan() runs axe-core WCAG 2.0–2.2 A/AA over the whole page, and serious/critical violations fail.
// The earlier standalone audit (tests/a11y-audit.mjs, slices 6e/6f/6x) left the visit confirmation and correction dialogs
// and the Hindi workspace screens outside its coverage. This is engineering evidence, not an independent human review.
import { test, expect } from './support/fixtures.mjs';
import { team, savedVisit, sentVisit, load, openPatient } from './support/flows.mjs';

const DESKTOP = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };
const WIDTHS = [['desktop', DESKTOP], ['phone', PHONE]];

/** Whether keyboard focus is currently inside a visible dialog. */
async function focusInsideDialog(page) {
  return page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(d => d.offsetParent !== null || getComputedStyle(d).position === 'fixed');
    const active = document.activeElement;
    return dialogs.length > 0 && dialogs.some(d => d.contains(active));
  });
}

test('visit confirmation and the correction dialogs pass axe at desktop and phone widths', async ({ lab }) => {
  const t = await team(lab);
  for (const [label, viewport] of WIDTHS) {
    await test.step(`confirmation and correction at ${label}`, async () => {
      await savedVisit(lab, t);                       // a fresh draft for this width
      const page = await load(lab, t.asha, { viewport });
      await openPatient(page);

      await test.step('review & act: the confirmation step', async () => {
        await page.getByRole('tab', { name: /Review & act/ }).click();
        await expect(page.getByText('Check the recorded facts')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Confirm visit' })).toBeDisabled();   // the patient check comes first
        await lab.scan(page, `ASHA · visit confirmation · ${label}`);
      });

      await test.step('confirm the visit', async () => {
        await page.getByRole('checkbox', { name: /observations, source and date/ }).first().click();
        await page.getByRole('button', { name: 'Confirm visit' }).click();
        await expect(page.getByText('Confirmed facts')).toBeVisible();
        await lab.scan(page, `ASHA · confirmed visit · ${label}`);
      });

      await test.step('the correction (amend) dialog', async () => {
        await page.getByRole('button', { name: 'Correct visit facts' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('heading', { name: 'Create a correction' })).toBeVisible();
        expect(await focusInsideDialog(page), 'focus moves inside the correction dialog').toBe(true);
        await lab.scan(page, `ASHA · correction (amend) dialog · ${label}`);
        await dialog.getByRole('button', { name: 'Close' }).first().click();
        await expect(dialog).toBeHidden();
      });

      await test.step('the wrong-patient (void) dialog', async () => {
        await page.getByRole('button', { name: 'Wrong patient?' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('heading', { name: 'Mark as wrong-patient' })).toBeVisible();
        expect(await focusInsideDialog(page), 'focus moves inside the wrong-patient dialog').toBe(true);
        await lab.scan(page, `ASHA · wrong-patient (void) dialog · ${label}`);
        await dialog.getByRole('button', { name: 'Close' }).first().click();
        await expect(dialog).toBeHidden();
      });
    });
  }
});

test('Hindi workspace screens pass axe at desktop and phone widths', async ({ lab }) => {
  const t = await team(lab);
  await sentVisit(lab, t);                            // a confirmed visit with receipts for the review and receipts tabs
  // Set Hindi through the same command the sidebar language button sends (the button lives in the sidebar footer, which on a
  // phone is a sheet opened from "Toggle Sidebar"); switching the language is separately covered by hindi.spec.mjs.
  const w0 = await lab.workspace(t.asha, t.org);
  await lab.command(t.asha, { type: 'setMyLanguage', language: 'hi', version: w0.membership.languageVersion ?? 0 }, t.org);
  for (const [label, viewport] of WIDTHS) {
    await test.step(`Hindi workspace at ${label}`, async () => {
      const page = await load(lab, t.asha, { viewport });

      await test.step('My work in Hindi', async () => {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('आज का कार्य');
        await expect(page.locator('.translation-strip')).toHaveAttribute('role', 'note');   // the draft-translation notice is announced
        expect(await page.evaluate(() => document.querySelectorAll('[lang=hi]').length), 'Hindi regions are tagged lang="hi"').toBeGreaterThan(0);
        await lab.scan(page, `ASHA · My work (Hindi) · ${label}`);
      });

      await test.step('the patient page in Hindi', async () => {
        await openPatient(page);
        const panel = page.locator('.clinical-panel').first();
        await panel.scrollIntoViewIfNeeded();
        await expect(panel).toContainText('तत्काल समीक्षा · Urgent review');               // the danger sign is never Hindi-only
        await lab.scan(page, `ASHA · patient page (Hindi) · ${label}`);
      });

      await test.step('review & act in Hindi', async () => {
        await page.getByRole('tab', { name: /समीक्षा और कार्रवाई/ }).click();
        await expect(page.getByText('पुष्ट तथ्य')).toBeVisible();
        await lab.scan(page, `ASHA · review & act (Hindi) · ${label}`);
      });

      await test.step('receipts in Hindi', async () => {
        await page.getByRole('tab', { name: /रसीदें/ }).click();
        await expect(page.locator('.receipt-row')).toHaveCount(2);
        await lab.scan(page, `ASHA · receipts (Hindi) · ${label}`);
      });
    });
  }
});
