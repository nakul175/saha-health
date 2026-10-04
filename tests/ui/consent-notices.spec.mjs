// Journey (slice 14d, R90): an owner publishes a consent notice; a permission is given after showing it, records its version
// and end date on screen; a material notice change then asks for renewal on the patient screen and in Permissions.
import { test, expect } from './support/fixtures.mjs';
import { load, menu, MEENA } from './support/flows.mjs';

const EN = 'Saha can use an AI tool to summarise the visit facts you have confirmed. You can say no and your care continues.';
const HI = 'सहा आपकी पुष्टि हुई विज़िट जानकारी का सारांश बनाने के लिए एआई उपकरण का उपयोग कर सकता है। आप मना कर सकते हैं।';

test('owner publishes a notice; permission is given under it and asks for renewal after a material change', async ({ lab }) => {
  const owner = lab.who('owner', 'Dr Priya Rao');
  const page = await load(lab, owner);
  const org = (await lab.workspace(owner)).organisation.id;

  await test.step('the owner publishes version 1 of the AI notice', async () => {
    await menu(page, 'Organisation & team').click();
    const panel = page.getByTestId('consent-notices');
    await expect(panel).toContainText('No notice published. Permissions are recorded without a notice version.');
    await panel.getByLabel('What changed').fill('First reviewed notice for AI assistance (synthetic)');
    await panel.getByLabel('Who reviewed the text, with a reference').fill('Synthetic review UI-14D');
    await panel.getByLabel(/Notice in English/).fill(EN);
    await panel.getByLabel(/Notice in Hindi/).fill(HI);
    await panel.getByRole('button', { name: 'Publish version 1' }).click();
    await expect(panel.locator('li').filter({ hasText: 'Version 1' })).toContainText('in force');
    await expect(panel).toContainText('Synthetic review UI-14D');
    await lab.scan(page, 'Owner · consent notices');
  });

  const permissions = async () => {
    await page.getByRole('button', { name: 'Permissions' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  };
  await test.step('AI permission is given after the notice is shown, with its version and end date', async () => {
    await menu(page, 'My work').click();
    await page.getByRole('button', { name: new RegExp(MEENA) }).first().click();
    let dialog = await permissions();
    // The seeded permission predates notices: in force, with no recorded notice or end. Withdraw it, then give it again.
    await expect(dialog.getByTestId('consent-standing-ai')).toContainText('Recorded before notice versions and expiry were kept');
    await dialog.getByRole('switch', { name: 'Optional AI assistance' }).click();
    await expect(dialog.getByRole('switch', { name: 'Optional AI assistance' })).not.toBeChecked();
    await dialog.getByRole('switch', { name: 'Optional AI assistance' }).click();
    await expect(dialog).toContainText('Notice version 1');
    await expect(dialog.getByTestId('consent-notice-text')).toContainText(EN);
    const record = dialog.getByRole('button', { name: 'Record permission' });
    await expect(record).toBeDisabled();
    await dialog.getByRole('checkbox').click();
    await lab.scan(page, 'Permissions · notice before giving permission');
    await record.click();
    await expect(dialog.getByTestId('consent-standing-ai')).toContainText(/In force until .*, given under notice version 1 \(English\)\./);
    await expect(dialog.getByRole('switch', { name: 'Optional AI assistance' })).toBeChecked();
    await page.keyboard.press('Escape');
  });

  await test.step('a material version 2 asks for renewal on the patient screen and in Permissions', async () => {
    await lab.command(owner, { type: 'publishConsentNotice', purpose: 'ai', version: 2, effectiveFrom: new Date().toISOString(), material: true, summary: 'Adds a second synthetic AI tool (material change)', review: 'Synthetic review UI-14D-2', texts: { en: EN + ' A second synthetic tool may be used.' } }, org);
    await page.reload({ waitUntil: 'load' });
    await page.getByRole('button', { name: new RegExp(MEENA) }).first().click();
    await expect(page.getByTestId('consent-standing-notice')).toContainText(/Optional AI assistance: Needs renewal: a material notice change took effect on .* \(the current notice is version 2\)/);
    const dialog = await permissions();
    await expect(dialog.getByTestId('consent-standing-ai')).toContainText('Needs renewal');
    await dialog.getByRole('button', { name: 'Renew permission' }).click();
    await expect(dialog).toContainText('Notice version 2');
    await dialog.getByRole('checkbox').click();
    await dialog.getByRole('button', { name: 'Record permission' }).click();
    await expect(dialog.getByTestId('consent-standing-ai')).toContainText(/In force until .*, given under notice version 2 \(English\)\./);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('consent-standing-notice')).toHaveCount(0);
    const w = await lab.workspace(owner, org), meena = w.people.find(p => p.name === MEENA), last = meena.consentHistory.at(-1);
    expect(last.notice.version, 'the server recorded the version shown').toBe(2);
    expect(last.renews.state, 'and what it renewed').toBe('renewal-needed');
  });
});
