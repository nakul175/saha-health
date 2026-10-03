// Journey (a): an owner sets up the team on screen. Display name, invitation by account code, the ASHA joins in her own browser,
// the owner assigns one person, and the ASHA then sees that person and nobody else.
import { test, expect } from './fixtures.mjs';
import { menu, menuEntries, MEENA } from './flows.mjs';

test('owner sets a name, invites an ASHA by account code and assigns one person; the ASHA sees only that person', async ({ lab }) => {
  const owner = lab.who('owner'), asha = lab.who('asha');             // email-only sign-ins: no full name in the header
  const ownerPage = await lab.open(owner), ashaPage = await lab.open(asha);   // two browser contexts, two people
  await ownerPage.goto('/', { waitUntil: 'networkidle' });
  await ashaPage.goto('/', { waitUntil: 'networkidle' });

  await test.step('the owner sees the whole demonstration caseload', async () => {
    await expect(ownerPage.getByRole('heading', { level: 1, name: 'Today’s work' })).toBeVisible();
    await expect(ownerPage.getByRole('heading', { level: 2, name: /Your visit list/ })).toContainText('6');
    for (const name of ['Aarav Singh', 'Meena Devi', 'Rajesh Kumar', 'Sunita Bai', 'Farida Begum', 'Kamla Devi']) await expect(ownerPage.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    await expect(ownerPage.locator('.user-card')).toContainText(owner.headers['oai-authenticated-user-email']); // no name yet: the account shows its email
    await lab.scan(ownerPage, 'Owner · home');
  });

  await test.step('the owner sets a display name', async () => {
    await menu(ownerPage, 'Organisation & team').click();
    await expect(ownerPage.getByRole('heading', { level: 1, name: 'Organisation & team' })).toBeVisible();
    await ownerPage.getByLabel('Your name in this organisation').fill('Dr Priya Rao');
    await ownerPage.getByRole('button', { name: 'Save name' }).click();
    await expect(ownerPage.getByText('Your name is updated in this organisation')).toBeVisible();
    await expect(ownerPage.locator('.user-card')).toContainText('Dr Priya Rao');
    await expect(ownerPage.locator('.user-card')).toContainText('Clinician · Owner');
    await lab.scan(ownerPage, 'Owner · organisation page');
    await menu(ownerPage, 'My work').click();                      // with a name set, the sidebar no longer shows the random e-mail address
    await expect(ownerPage.getByRole('heading', { level: 1, name: 'Today’s work' })).toBeVisible();
    await lab.shot(ownerPage, 'owner-home.png');
    await menu(ownerPage, 'Organisation & team').click();
  });

  let code;
  await test.step('the ASHA reads her account code on her own screen', async () => {
    await menu(ashaPage, 'Organisation & team').click();
    const field = ashaPage.getByLabel('Your account code');
    await expect(field).toHaveValue(/^[0-9A-F]{24}$/);
    code = await field.inputValue();
  });

  let invitation;
  await test.step('the owner invites her by that code', async () => {
    await ownerPage.getByRole('button', { name: 'Invite teammate' }).click();
    const dialog = ownerPage.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Invite a teammate' })).toBeVisible();
    await dialog.getByLabel('Teammate name').fill('Sunita Yadav');
    await dialog.getByLabel('Teammate account code').fill(code);
    await expect(dialog.getByRole('combobox', { name: 'Membership role' })).toContainText('ASHA worker');
    await lab.scan(ownerPage, 'Owner · invite dialog');
    await dialog.getByRole('button', { name: 'Create invitation' }).click();
    await expect(dialog.getByText('Invitation ready')).toBeVisible();
    invitation = await dialog.getByLabel('Invitation code').inputValue();
    expect(invitation, 'the invitation code is a 64-character token').toMatch(/^[0-9a-f]{64}$/);
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(dialog).toBeHidden();
    await expect(ownerPage.getByText('Sunita Yadav').first()).toBeVisible();   // pending invitation is listed
  });

  await test.step('the ASHA joins the organisation with the invitation code', async () => {
    await ashaPage.getByRole('button', { name: 'Join organisation' }).click();
    const dialog = ashaPage.getByRole('dialog');
    await dialog.getByRole('textbox').first().fill(invitation);
    await dialog.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(ashaPage.locator('.user-card')).toContainText('Sunita Yadav');
    await expect(ashaPage.locator('.user-card')).toContainText('ASHA worker');
    await expect(ashaPage.getByText('Rampur care organisation').first()).toBeVisible();
    expect(await menuEntries(ashaPage), 'an ASHA menu holds care work only').toEqual(['My work', 'People', 'Submissions', 'Outreach', 'Care handover', 'Organisation & team']);
  });

  await test.step('before any assignment the ASHA has nobody in her visit list', async () => {
    await menu(ashaPage, 'My work').click();
    await expect(ashaPage.getByRole('heading', { level: 2, name: /Your visit list/ })).toContainText('0');
    for (const name of ['Aarav Singh', 'Meena Devi', 'Rajesh Kumar', 'Sunita Bai', 'Farida Begum', 'Kamla Devi']) await expect(ashaPage.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);
  });

  await test.step('the owner assigns Meena Devi to her', async () => {
    await ownerPage.getByRole('button', { name: 'Refresh workspace' }).click();   // the owner's screen was loaded before she joined
    await menu(ownerPage, 'My work').click();
    await ownerPage.getByRole('button', { name: new RegExp(MEENA) }).first().click();
    await expect(ownerPage.getByRole('heading', { level: 1, name: MEENA })).toBeVisible();
    await ownerPage.getByRole('button', { name: 'Assignment' }).first().click();
    const dialog = ownerPage.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Patient assignment' })).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Assigned worker' }).click();
    await ownerPage.getByRole('option', { name: 'Sunita Yadav' }).click();
    await expect(dialog.getByRole('combobox', { name: 'Assigned worker' })).toContainText('Sunita Yadav');
    await dialog.getByLabel('Reason for correction or change').fill('Caseload for the village visits');
    await lab.scan(ownerPage, 'Owner · assignment dialog');
    await dialog.getByRole('button', { name: 'Save with history' }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('the ASHA now sees that one person and nobody else', async () => {
    await ashaPage.getByRole('button', { name: 'Refresh workspace' }).click();
    await menu(ashaPage, 'My work').click();
    await expect(ashaPage.getByRole('heading', { level: 2, name: /Your visit list/ })).toContainText('1');
    await expect(ashaPage.getByRole('button', { name: new RegExp(MEENA) })).toHaveCount(1);
    for (const name of ['Aarav Singh', 'Rajesh Kumar', 'Sunita Bai', 'Farida Begum', 'Kamla Devi']) await expect(ashaPage.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);
    await menu(ashaPage, 'People').click();
    await expect(ashaPage.getByRole('button', { name: new RegExp(MEENA) })).toHaveCount(1);
    await expect(ashaPage.getByRole('button', { name: /Aarav Singh/ })).toHaveCount(0);
    await menu(ashaPage, 'My work').click();
    await lab.scan(ashaPage, 'ASHA · home with one assigned person');
    await lab.shot(ashaPage, 'asha-home.png');
  });

  await test.step('the server agrees with the screen', async () => {
    const org = (await lab.workspace(owner)).organisation.id;
    const seen = await lab.workspace(asha, org);
    expect(seen.people.map(p => p.name), 'the ASHA workspace holds only the assigned person').toEqual([MEENA]);
    expect(seen.role).toBe('asha');
  });
});
