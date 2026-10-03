// Slice 12a: voice input on every text and number box, in a real browser. Chromium in a test has no microphone, so a stand-in
// SpeechRecognition (installed before the page loads) "hears" the phrases each test gives it and records how it was started.
// What is checked is Saha's side: which recognizer it chooses, the notice before the browser speech service, the review
// before anything is inserted, numbers taken from speech, words added after existing text, nothing saved until Save draft,
// and the microphone inside a dialog. Real recognition quality on phones is not tested here.
import { test, expect } from './support/fixtures.mjs';
import { team, openPatient, field } from './support/flows.mjs';

const FAKE = ({ local, said }) => {
  window.__voice = { starts: [], available: [], said: [...said] };
  class StandIn {
    static async available(options) { window.__voice.available.push(options); return local; }
    start() { window.__voice.starts.push({ lang: this.lang, processLocally: !!this.processLocally, continuous: !!this.continuous, interim: !!this.interimResults });
      const text = window.__voice.said.shift() ?? '';
      setTimeout(() => { if (text) this.onresult?.({ results: [[{ transcript: text }]] }); else this.onerror?.({ error: 'no-speech' }); this.onend?.(); }, 250); }
    stop() {} abort() {}
  }
  window.SpeechRecognition = StandIn;
};
async function openWith(lab, who, fake) {
  const page = await lab.open(who);
  await page.addInitScript(FAKE, fake);
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  return page;
}
const mic = page => page.getByRole('button', { name: 'Speak into this box', exact: true }); // only the focused box has one
const allow = (lab, t) => lab.command(t.owner, { type: 'setSpeechPolicy', cloudAllowed: true, version: 0, reason: 'UI test of voice input on phones' }, t.org);

test('voice input: the browser speech service only after the notice; a number from speech; words added after notes; nothing saved until Save draft', async ({ lab }) => {
  const t = await team(lab);
  await allow(lab, t);
  const page = await openWith(lab, t.asha, { local: 'unavailable', said: ['BP 152 by 114', 'headache and swelling of feet'] });
  await openPatient(page);
  await page.getByRole('button', { name: 'Start visit' }).click();
  const systolic = field(page, 'Systolic BP · mmHg');

  await test.step('a microphone appears beside the focused box; the notice comes first', async () => {
    await systolic.click();
    await expect(mic(page)).toBeVisible();
    await mic(page).click();
    await expect(page.getByText(/sends the audio to its speech service \(Google on Android phones\)/)).toBeVisible();
    expect(await page.evaluate(() => window.__voice.starts.length), 'nothing listens before Continue').toBe(0);
    await page.getByRole('button', { name: 'Continue' }).click();
  });
  await test.step('review: the first number heard, the others named; Insert puts it in the box', async () => {
    await expect(page.getByText('Number to insert')).toBeVisible();
    await expect(page.locator('.voice-number')).toHaveText('152');
    await expect(page.getByText(/also heard 114; only the first number is used/)).toBeVisible();
    await expect(systolic, 'not inserted before Insert').toHaveValue('');
    await lab.scan(page, 'Voice input review');
    const width = page.viewportSize().width, box = await page.locator('.voice-panel').boundingBox(), micBox = await mic(page).boundingBox();
    for (const [what, b] of [['review panel', box], ['microphone', micBox]]) { expect(b.x, `${what} starts on screen`).toBeGreaterThanOrEqual(0); expect(b.x + b.width, `${what} ends on screen`).toBeLessThanOrEqual(width); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll').toBe(true);
    await page.getByRole('button', { name: 'Insert' }).click();
    await expect(systolic).toHaveValue('152');
    const starts = await page.evaluate(() => window.__voice.starts);
    expect(starts).toEqual([{ lang: 'en-IN', processLocally: false, continuous: false, interim: false }]);
  });
  await test.step('words are added after what the notes already say; no second notice', async () => {
    const notes = page.getByRole('textbox', { name: /Visit notes/ }).first();
    await notes.fill('Fever since Monday.');
    await notes.click();
    await mic(page).click();
    await expect(page.getByRole('textbox', { name: 'Heard' })).toHaveValue('headache and swelling of feet');
    await page.getByRole('textbox', { name: 'Heard' }).fill('headache and swelling of feet for two days');
    await page.getByRole('button', { name: 'Insert' }).click();
    await expect(notes).toHaveValue('Fever since Monday. headache and swelling of feet for two days');
  });
  await test.step('speaking saves nothing; Save draft does', async () => {
    const before = (await lab.workspace(t.asha, t.org)).visits.find(v => v.personId === t.meenaId && v.state === 'draft');
    expect([before.facts.systolic ?? '', before.facts.notes ?? '']).toEqual(['', '']);
    await field(page, 'Diastolic BP · mmHg').fill('114');   // a blood pressure is saved as a pair; typing still works beside voice
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved in the workspace.')).toBeVisible();
    const after = (await lab.workspace(t.asha, t.org)).visits.find(v => v.id === before.id);
    expect([after.facts.systolic, after.facts.diastolic, after.facts.notes]).toEqual(['152', '114', 'Fever since Monday. headache and swelling of feet for two days']);
  });
});

test('voice input: with the browser speech service off and no on-device speech, the microphone says so and never listens', async ({ lab }) => {
  const t = await team(lab);
  const page = await openWith(lab, t.asha, { local: 'unavailable', said: ['Meena'] });
  const search = page.getByPlaceholder(/Search name or village/).first();
  await search.click();
  await mic(page).click();
  await expect(page.getByRole('alert').filter({ hasText: /has not allowed the browser speech service/ })).toBeVisible();
  expect(await page.evaluate(() => window.__voice.starts.length)).toBe(0);
  await expect(search).toHaveValue('');
});

test('voice input: on-device speech needs no setting and no notice; Hindi is offered; it works inside a dialog', async ({ lab }) => {
  const t = await team(lab);
  const page = await openWith(lab, t.asha, { local: 'available', said: ['Pooja Kumari', '', 'कमला'] });
  await page.getByRole('button', { name: 'Add person' }).click();
  const name = page.getByRole('dialog').getByLabel('Full name', { exact: true });
  await name.click();
  await mic(page).click();
  await expect(page.getByText('Speech was turned into text on this device.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Insert' }).click();
  await expect(name).toHaveValue('Pooja Kumari');
  await name.fill('');
  await name.click();
  await mic(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Nothing was heard' })).toBeVisible();
  await page.getByRole('button', { name: 'हिन्दी' }).click();
  await expect(page.getByRole('textbox', { name: 'Heard' })).toHaveValue('कमला');
  const starts = await page.evaluate(() => window.__voice.starts);
  expect(starts.map(s => [s.lang, s.processLocally])).toEqual([['en-IN', true], ['en-IN', true], ['hi-IN', true]]);
  expect(await page.evaluate(() => window.__voice.available.map(a => [a.langs[0], a.processLocally]))).toEqual([['en-IN', true], ['en-IN', true], ['hi-IN', true]]);
});
