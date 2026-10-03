// Journey (b): an ASHA records a visit with a danger sign, from the first field to the receipts.
// Assistant on a note with BP 152/114, reviewed fields applied, draft saved, urgent finding naming the CHC/FRU referral,
// confirm, prepare / approve / run the programme plan, and resolve the uncertain receipt by lookup without a resend.
import { test, expect, RECEIPT_ROW_STYLE } from './support/fixtures.mjs';
import { team, load, openPatient, field, MEENA, DANGER_NOTE } from './support/flows.mjs';

test('ASHA visit with a danger sign: assistant, urgent finding, confirmation, programme plan and receipts', async ({ lab }) => {
  const t = await team(lab);
  const page = await load(lab, t.asha);
  const revision = async () => Number((await page.getByText(/Revision \d+/).first().innerText()).match(/Revision (\d+)/)[1]);

  await test.step('start a visit for the assigned person', async () => {
    await openPatient(page);
    await page.getByRole('button', { name: 'Start visit' }).click();
    await expect(page.getByText('Saved draft', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Common observations' })).toBeVisible();
    expect(await revision()).toBe(1);
    await expect(field(page, 'Systolic BP · mmHg')).toHaveValue('');
    await lab.scan(page, 'ASHA · visit form, empty');
  });

  await test.step('the visit assistant extracts fields from the note and the worker reviews them', async () => {
    await page.getByLabel('Assistant visit narrative').fill(DANGER_NOTE);
    await page.getByRole('button', { name: 'Prepare request' }).click();
    await page.getByRole('button', { name: 'Approve and run once' }).last().click();
    await expect(page.getByText('Draft field extraction')).toBeVisible();
    await expect(page.getByText('Systolic BP · mmHg: 152')).toBeVisible();
    await expect(page.getByText('Diastolic BP · mmHg: 114')).toBeVisible();
    await expect(page.getByText('Weight · kg: 58')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply 0 reviewed fields' })).toBeDisabled();   // nothing is applied until the worker reviews
    for (const label of [/^Systolic BP/, /^Diastolic BP/, /^Weight/, /^I checked the patient, selected values/]) await page.getByRole('checkbox', { name: label }).check();
    await lab.scan(page, 'ASHA · visit assistant, extraction under review');
    await page.getByRole('button', { name: 'Apply 3 reviewed fields' }).click();
    await expect(field(page, 'Systolic BP · mmHg')).toHaveValue('152');
    await expect(field(page, 'Diastolic BP · mmHg')).toHaveValue('114');
    await expect(field(page, 'Weight · kg')).toHaveValue('58');
    await expect.poll(revision, { message: 'applying the reviewed fields saves the draft as revision 2' }).toBe(2);
  });

  await test.step('the worker adds a temperature and saves the draft', async () => {
    await field(page, 'Temperature · °C').fill('36.8');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect.poll(revision).toBe(3);
    await expect(page.getByText('Draft saved in the workspace.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();                  // nothing left unsaved
  });

  await test.step('the clinical review shows the urgent finding and names the CHC/FRU referral', async () => {
    const panel = page.locator('.clinical-panel').first();
    await panel.scrollIntoViewIfNeeded();
    await expect(panel.getByRole('heading', { name: 'Clinical review' })).toBeVisible();
    await expect(panel).toContainText('1 urgent finding: refer to Kheda CHC / First Referral Unit (synthetic)');
    const urgent = panel.locator('.protocol-finding').filter({ hasText: 'Urgent review' });
    await expect(urgent).toHaveCount(1);
    await expect(urgent).toContainText('Danger sign: diastolic BP above 110 mmHg');
    await expect(urgent).toContainText('refer to the CHC/FRU immediately');
    await expect(urgent).toContainText('Evidence: diastolic: 114');
    await expect(urgent).toContainText('Refer to: Kheda CHC / First Referral Unit (synthetic)');
    await expect(urgent).toContainText('MoHFW guidelines for antenatal care');                      // the finding cites its source
    await expect(panel.locator('.protocol-finding').filter({ hasText: 'Systolic BP 140 mmHg or above' })).toContainText('Rampur PHC medical officer (synthetic)');
    await expect(panel).toContainText('not clinically approved');                                    // the honesty label stays on the screen
    await lab.scan(page, 'ASHA · clinical review with the urgent finding');
    await lab.shot(page, 'clinical-review.png', { target: panel });
  });

  await test.step('the visit form as saved', async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
    await lab.scan(page, 'ASHA · visit form, filled');
    await lab.shot(page, 'visit-form.png', { mask: [field(page, 'Observation date & time (UTC)')] });
  });

  await test.step('review the recorded facts and confirm the visit', async () => {
    await page.getByRole('tab', { name: /Review & act/ }).click();
    await expect(page.getByText('Check the recorded facts')).toBeVisible();
    await expect(page.getByText('152/114 mmHg', { exact: true })).toBeVisible();
    await expect(page.getByText('36.8 °C', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm visit' })).toBeDisabled();                // the check box comes first
    await lab.scan(page, 'ASHA · review the recorded facts');
    await page.getByRole('checkbox', { name: /observations, source and date/ }).first().click();
    await page.getByRole('button', { name: 'Confirm visit' }).click();
    await expect(page.getByText('Confirmed facts')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm visit' })).toHaveCount(0);
  });

  await test.step('prepare, approve and run the programme plan', async () => {
    await expect(page.getByText('Community health MIS').first()).toBeVisible();
    await expect(page.getByText('Maternal & child register').first()).toBeVisible();
    const destinations = page.locator('section:has-text("Programme update plan") [role=checkbox]');
    await expect(destinations).toHaveCount(2);
    for (let i = 0; i < 2; i++) await destinations.nth(i).click();
    await page.getByRole('button', { name: 'Prepare selected updates' }).click();
    await expect(page.getByText('2 destinations')).toBeVisible();
    await expect(page.getByText('Update Community health MIS')).toBeVisible();
    await expect(page.getByText('Update Maternal & child register')).toBeVisible();
    await lab.scan(page, 'ASHA · programme plan prepared');
    await page.getByRole('button', { name: 'Approve this plan' }).click();
    await page.getByRole('button', { name: 'Run approved plan' }).click();
    await expect(page.getByRole('button', { name: 'Look up receipt' })).toBeVisible();              // the run lands on the receipts
  });

  await test.step('receipts: one accepted, one uncertain', async () => {
    await page.getByRole('tab', { name: /Receipts/ }).click();
    const rows = page.locator('.receipt-row');
    await expect(rows).toHaveCount(2);
    const mis = rows.filter({ hasText: 'Community health MIS' }), register = rows.filter({ hasText: 'Maternal & child register' });
    await expect(register).toContainText('accepted');
    await expect(register).toContainText('Programme simulator accepted this visit.');
    await expect(register).toContainText(/SIM-[0-9A-F]{8}/);
    await expect(mis).toContainText('uncertain');
    await expect(mis).toContainText('Look up the receipt; do not resend.');
    await expect(mis).toContainText('Receipt not confirmed · 1 send attempts');
    await expect(page.getByText('Needs attention (1)')).toBeVisible();
    await expect(mis.getByRole('button', { name: 'Resend' })).toHaveCount(0);                        // no blind retry is offered
    await lab.scan(page, 'ASHA · receipts, one uncertain');
    await lab.shot(page, 'receipt-uncertain.png', { target: mis, stylePath: RECEIPT_ROW_STYLE });   // one row, border removed: the order of two same-second receipts is a coin flip
  });

  await test.step('look up the uncertain receipt: found, and nothing is sent again', async () => {
    await page.getByRole('button', { name: 'Look up receipt' }).first().click();
    await expect(page.getByText('Receipt found. No duplicate was sent.')).toBeVisible();
    const mis = page.locator('.receipt-row').filter({ hasText: 'Community health MIS' });
    await expect(mis).toContainText('Receipt found by lookup. The visit was not sent again.');
    await expect(mis).toContainText('accepted');
    await expect(mis).toContainText('1 send attempts');                                              // still one attempt: the lookup did not resend
    await expect(page.getByText('Needs attention (0)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Look up receipt' })).toHaveCount(0);
  });

  await test.step('the server records one attempt per destination and two accepted receipts', async () => {
    const w = await lab.workspace(t.asha, t.org);
    const mine = w.submissions.filter(s => w.visits.find(v => v.id === s.visitId)?.personId === t.meenaId);
    expect(mine.map(s => s.state).sort()).toEqual(['accepted', 'accepted']);
    expect(mine.map(s => s.attempts)).toEqual([1, 1]);
  });
});
