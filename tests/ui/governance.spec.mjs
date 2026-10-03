// Journey (d): the owner opens Clinical governance and finds the demonstration protocols and the sources they cite.
import { test, expect } from './support/fixtures.mjs';
import { load, menu } from './support/flows.mjs';

test('owner sees the demonstration protocols and the source library', async ({ lab }) => {
  const owner = lab.who('owner', 'Dr Priya Rao');
  const page = await load(lab, owner);

  await menu(page, 'Clinical governance').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Review before use' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveText(['AI capabilities', 'Source library', 'Protocols', 'Service directory', 'Safety cases']);

  await test.step('protocols', async () => {
    await page.getByRole('tab', { name: 'Protocols' }).click();
    const panel = page.getByRole('tabpanel');
    await expect(panel).toContainText('2 review packages');
    for (const [title, id] of [['Antenatal blood pressure (demonstration, not clinically approved)', 'demo-protocol-maternal-bp'], ['Presumptive TB: cough duration (demonstration, not clinically approved)', 'demo-protocol-tb-cough']]) {
      const card = panel.getByRole('heading', { level: 2, name: title, exact: true }).locator('xpath=ancestor::div[contains(., "Not clinically approved and not for real patients")][1]');   // the card that holds this title
      await expect(card).toContainText(id);
      await expect(card).toContainText('Revision 1');
      await expect(card).toContainText('Active for rehearsal');
      await expect(card).toContainText('Not clinically approved and not for real patients');
      await expect(card).toContainText('Reviewed by Demonstration clinician — reviewer (synthetic)');
    }
    await expect(panel).toContainText('Maternal care · 3 rules');
    await expect(panel).toContainText('TB screening · 1 rules');
    await lab.scan(page, 'Owner · governance, protocols');
    await lab.shot(page, 'governance-protocols.png', { mask: [page.locator('[data-slot=sidebar-content]')] });   // the menu's own scroll position is not under test
  });

  await test.step('source library', async () => {
    await page.getByRole('tab', { name: 'Source library' }).click();
    const panel = page.getByRole('tabpanel');
    await expect(panel).toContainText('2 review packages');
    await expect(panel).toContainText('MoHFW guidelines for antenatal care and skilled attendance at birth by ANMs and LHVs (2005)');
    await expect(panel).toContainText('NTEP diagnostic algorithm for TB disease');
    await expect(panel).toContainText('Maternal Health Division, Ministry of Health and Family Welfare, Government of India');
    await expect(panel).toContainText('National TB Elimination Programme, India');
    await expect(panel.getByText('Active for rehearsal')).toHaveCount(2);
    await lab.scan(page, 'Owner · governance, source library');
  });
});
