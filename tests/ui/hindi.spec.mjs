// Journey (f): an ASHA switches the workspace to Hindi (slice 10j). My work reads in Hindi inside lang="hi", the page itself stays lang="en",
// the choice is saved for her in the organisation, record values stay as recorded, and the danger sign stays bilingual.
// The Hindi text is a draft translation not reviewed by a native speaker; this checks that it is shown and labelled, not that it is right.
import { test, expect } from './fixtures.mjs';
import { team, savedVisit, load, openPatient, MEENA } from './flows.mjs';

test('Hindi: My work shows Hindi text with lang="hi", the choice is saved, and English comes back', async ({ lab }) => {
  const t = await team(lab);
  await savedVisit(lab, t);                                   // a saved draft with a blood pressure of 152/114
  const page = await load(lab, t.asha);
  const h1 = page.getByRole('heading', { level: 1 });
  const langOf = locator => locator.evaluate(e => e.closest('[lang]')?.getAttribute('lang') ?? null);
  const hindi = page.getByRole('button', { name: 'हिन्दी' }), english = page.getByRole('button', { name: 'English', exact: true });

  await test.step('English by default', async () => {
    await expect(h1).toHaveText('Today’s work');
    expect(await langOf(h1)).toBe('en');
    await expect(english).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.translation-strip')).toHaveCount(0);   // no translation notice in English
  });

  await test.step('choose Hindi', async () => {
    await hindi.click();
    await expect(h1).toHaveText('आज का कार्य');
    await expect(hindi).toHaveAttribute('aria-pressed', 'true');
    expect(await langOf(h1), 'the Hindi heading is inside lang="hi"').toBe('hi');
    expect(await page.evaluate(() => document.documentElement.lang), 'the page itself stays English; Hindi regions carry their own lang').toBe('en');
    await expect(page.getByRole('button', { name: 'मेरा कार्य' }).first()).toBeVisible();   // the menu follows the language
    await expect(page.getByText('करने योग्य विज़िट')).toBeVisible();                           // "Visits to do"
    const notice = page.locator('.translation-strip');
    await expect(notice).toHaveAttribute('role', 'note');
    await expect(notice).toContainText('यह हिंदी पाठ मसौदा अनुवाद है');                        // draft translation, in Hindi first
    await expect(notice).toContainText('This Hindi text is a draft translation');             // and in English for reviewers
    await expect(page.getByRole('button', { name: new RegExp(MEENA) }).first()).toBeVisible();  // names stay as recorded
    expect((await page.locator('[lang=hi]').count()), 'several regions are tagged lang="hi"').toBeGreaterThan(3);
    await lab.scan(page, 'ASHA · My work (Hindi)');
  });

  await test.step('the patient page and its danger sign in Hindi', async () => {
    await openPatient(page);
    const panel = page.locator('.clinical-panel').first();
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('तत्काल समीक्षा · Urgent review');                       // the danger sign is never Hindi-only
    await expect(panel).toContainText('Kheda CHC / First Referral Unit (synthetic)');          // facility names stay as recorded
    await expect(panel).toContainText(/systolic: 152/);                                          // values and digits are as recorded, not translated
    await expect(panel).toContainText(/diastolic: 114/);
    await expect(panel).toContainText('mmHg');                                                 // units are not translated
    await lab.scan(page, 'ASHA · patient page (Hindi)');
  });

  await test.step('the choice is saved for her: it survives a reload and the server holds it', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await expect(h1.first()).toHaveText(/./);
    await page.getByRole('button', { name: /मेरा कार्य/ }).first().click();
    await expect(h1).toHaveText('आज का कार्य');
    const w = await lab.workspace(t.asha, t.org);
    expect(w.membership.language).toBe('hi');
  });

  await test.step('back to English', async () => {
    await english.click();
    await expect(h1).toHaveText('Today’s work');
    expect(await langOf(h1)).toBe('en');
    await expect(page.locator('.translation-strip')).toHaveCount(0);
    expect((await lab.workspace(t.asha, t.org)).membership.language).toBe('en');
  });
});
