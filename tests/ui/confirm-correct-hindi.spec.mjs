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

// Current synthetic regression: a visible enabled Refresh must not fade through unreadable text after a genuine scoped read.
// The original Hindi cases above are unchanged. This case holds exactly one outbound local read, never its response.
test('visible Hindi phone Action-plan Refresh retains contrast when the scoped read completes', async ({ lab }) => {
  const t = await team(lab);
  await sentVisit(lab, t);
  const w0 = await lab.workspace(t.asha, t.org);
  await lab.command(t.asha, { type: 'setMyLanguage', language: 'hi', version: w0.membership.languageVersion ?? 0 }, t.org);
  const clinicalBefore = await lab.workspace(t.asha, t.org);
  const page = await load(lab, t.asha, { viewport: PHONE });
  const origin = new URL(page.url()).origin;
  expect(/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(origin), 'synthetic identity stays on the owned loopback Worker').toBe(true);
  const matches = response => {
    const request = response.request(), url = new URL(response.url());
    return url.origin === origin && url.pathname === '/api/action-plan' && request.method() === 'GET' &&
      url.searchParams.size === 1 && url.searchParams.get('personId') === t.meenaId;
  };
  const journal = { seededPersonId: t.meenaId, organisationId: t.org, origin, requestedHoldMs: 250,
    heldRequests: [], responses: [], errors: [], browserRoutingDisablesCache: true, noResponseSubstitution: true };
  const bounded = async (promise, label, ms = 15000) => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms} ms`)), ms); })]); }
    finally { clearTimeout(timer); }
  };
  let sampled = null, heldRequest = null, routeInstalled = false;
  const urlMatches = url => url.origin === origin && url.pathname === '/api/action-plan' &&
    url.searchParams.size === 1 && url.searchParams.get('personId') === t.meenaId;
  const routeHandler = async route => {
    const request = route.request();
    if (request.method() !== 'GET' || heldRequest) { await route.continue(); return; }
    heldRequest = request;
    const headerBindings = Object.fromEntries(Object.entries(t.asha.headers).map(([key, value]) => [key, request.headers()[key.toLowerCase()] === value]));
    const record = { personId: new URL(request.url()).searchParams.get('personId'), url: request.url(), method: request.method(),
      organisationHeaderMatches: request.headers()['x-saha-organisation'] === t.org, actorHeaderBindings: headerBindings,
      holdStartedWallMs: Date.now(), holdStartedMonotonicMs: performance.now(), continuation: 'route.continue() without overrides' };
    journal.heldRequests.push(record);
    try {
      await new Promise(resolve => setTimeout(resolve, 250));
      record.holdReleasedWallMs = Date.now(); record.actualHoldMs = performance.now() - record.holdStartedMonotonicMs;
      await route.continue(); record.continueResolvedWallMs = Date.now();
    } catch (error) { record.transportError = String(error); throw error; }
  };
  try {
    const initialResponsePromise = page.waitForResponse(matches, { timeout: 30000 }).then(response => ({ response }), error => ({ error }));
    await openPatient(page);
    const initialResult = await initialResponsePromise;
    if (initialResult.error) throw initialResult.error;
    const initialResponse = initialResult.response;
    expect(initialResponse.status(), 'the original scoped Action-plan read succeeds before installing the one-shot hold').toBe(200);
    journal.initialResponse = { url: initialResponse.url(), status: initialResponse.status(), receivedWallMs: Date.now() };
    const refresh = page.locator('.action-plan .section-heading > button[data-size="sm"]');
    await expect(refresh).toHaveText('Refresh');
    await expect(refresh).toBeEnabled();
    await refresh.scrollIntoViewIfNeeded();
    const beforeBox = await refresh.boundingBox();
    expect(beforeBox, 'Refresh is rendered').not.toBeNull();
    expect(beforeBox.x >= 0 && beforeBox.y >= 0 && beforeBox.x + beforeBox.width <= PHONE.width && beforeBox.y + beforeBox.height <= PHONE.height,
      'the real Refresh button is visibly inside the phone viewport before the controlled click').toBe(true);
    journal.visibleBeforeClick = beforeBox;
    await page.route(urlMatches, routeHandler); routeInstalled = true;
    await page.evaluate(() => {
      const selector = '.action-plan .section-heading > button[data-size="sm"]';
      const started = performance.now(), samples = [];
      const sample = () => {
        const elapsedMs = performance.now() - started;
        if (elapsedMs > 15000 || samples.length >= 2048) { window.__sahaVisibleRefreshContrast.truncated = elapsedMs > 15000 ? 'deadline' : 'capacity'; clearInterval(window.__sahaVisibleRefreshContrast.timer); return; }
        const node = document.querySelector(selector);
        if (!node) { samples.push({ elapsedMs, present: false }); return; }
        const css = getComputedStyle(node);
        const ancestors = []; let parent = node.parentElement;
        while (parent) { const v = getComputedStyle(parent); ancestors.push({ tag: parent.tagName, className: parent.className, backgroundColor: v.backgroundColor, opacity: v.opacity, backgroundImage: v.backgroundImage, filter: v.filter, backdropFilter: v.backdropFilter, mixBlendMode: v.mixBlendMode }); parent = parent.parentElement; }
        samples.push({ elapsedMs, atWallMs: Date.now(), present: true, html: node.outerHTML, disabled: node.disabled,
          color: css.color, backgroundColor: css.backgroundColor, opacity: css.opacity, display: css.display, visibility: css.visibility,
          fontSize: css.fontSize, fontWeight: css.fontWeight, backgroundImage: css.backgroundImage, filter: css.filter, backdropFilter: css.backdropFilter, mixBlendMode: css.mixBlendMode, rect: node.getBoundingClientRect().toJSON(), ancestors,
          animations: node.getAnimations().map(a => ({ type: a.constructor.name, transitionProperty: a.transitionProperty,
            playState: a.playState, currentTime: a.currentTime, timing: a.effect?.getComputedTiming() })) });
      };
      window.__sahaVisibleRefreshContrast = { selector, started, samples, timer: null, truncated: null, terminalResponseCompletedElapsedMs: null }; sample();
      window.__sahaVisibleRefreshContrast.timer = setInterval(sample, 8);
    });
    const heldResponsePromise = page.waitForResponse(response => heldRequest !== null && response.request() === heldRequest, { timeout: 30000 }).then(response => ({ response }), error => ({ error }));
    await refresh.click();
    const heldResult = await heldResponsePromise;
    if (heldResult.error) throw heldResult.error;
    const response = heldResult.response;
    const terminal = { url: response.url(), status: response.status(), receivedWallMs: Date.now(),
      sameHeldRequestObject: response.request() === heldRequest, personId: new URL(response.url()).searchParams.get('personId') };
    journal.responses.push(terminal);
    const bytes = await bounded(response.body(), 'real held read response body');
    terminal.bodyBytes = bytes.length;
    expect(bytes.length, 'bounded actual local response evidence').toBeLessThanOrEqual(256 * 1024);
    terminal.bodyUTF8 = bytes.toString('utf8'); terminal.body = JSON.parse(terminal.bodyUTF8); terminal.bodyCompletedWallMs = Date.now();
    terminal.browserMonotonicMarker = await page.evaluate(() => { const state = window.__sahaVisibleRefreshContrast; state.terminalResponseCompletedElapsedMs = performance.now() - state.started; return state.terminalResponseCompletedElapsedMs; });
    expect(response.status(), 'the genuine held read completes successfully').toBe(200);
    expect(terminal.sameHeldRequestObject).toBe(true);
    expect(terminal.personId).toBe(t.meenaId);
    await expect(refresh).toBeEnabled();
    await lab.scan(page, 'ASHA · visible Action-plan Refresh after scoped read · Hindi phone');
    const clinicalAfter = await lab.workspace(t.asha, t.org);
    expect({ people: clinicalAfter.people, visits: clinicalAfter.visits, submissions: clinicalAfter.submissions },
      'the read and visual check do not change clinical records or send again').toEqual({ people: clinicalBefore.people, visits: clinicalBefore.visits, submissions: clinicalBefore.submissions });
  } catch (error) { journal.errors.push(String(error)); throw error; }
  finally {
    try { sampled = await page.evaluate(() => { const state = window.__sahaVisibleRefreshContrast; if (!state) return null; clearInterval(state.timer); return { selector: state.selector, started: state.started, samples: state.samples, truncated: state.truncated, terminalResponseCompletedElapsedMs: state.terminalResponseCompletedElapsedMs }; }); }
    catch (error) { journal.errors.push(`sampling cleanup: ${error}`); }
    if (routeInstalled) { try { await page.unroute(urlMatches, routeHandler); } catch (error) { journal.errors.push(`route cleanup: ${error}`); } }
    await test.info().attach('visible-refresh-actual-read-and-samples.json', { body: JSON.stringify({ journal, sampled }, null, 2), contentType: 'application/json' });
  }
  expect(journal.errors).toEqual([]);
  expect(journal.heldRequests).toHaveLength(1);
  expect(journal.responses).toHaveLength(1);
  expect(journal.heldRequests[0].personId).toBe(t.meenaId);
  expect(journal.heldRequests[0].organisationHeaderMatches).toBe(true);
  expect(Object.keys(journal.heldRequests[0].actorHeaderBindings).length, 'actual actor binding cannot pass with an empty identity header map').toBeGreaterThan(0);
  expect(Object.values(journal.heldRequests[0].actorHeaderBindings).every(Boolean)).toBe(true);
  expect(journal.heldRequests[0].actualHoldMs).toBeGreaterThanOrEqual(250);
  expect(sampled).not.toBeNull();
  expect(sampled.truncated, 'refuse a sampler that ended before the actual terminal response/measurement window').toBeNull();
  const present = sampled.samples.filter(s => s.present);
  expect(present.some(s => s.disabled), 'the genuine read exercises a disabled loading state').toBe(true);
  const enabled = present.filter(s => !s.disabled);
  expect(enabled.length, 'capture real enabled frames, never pass with missing samples').toBeGreaterThan(0);
  expect(Number.isFinite(sampled.terminalResponseCompletedElapsedMs), 'the real body completion is marked in the same browser monotonic clock as samples').toBe(true);
  const firstDisabledMs = Math.min(...present.filter(s => s.disabled).map(s => s.elapsedMs));
  expect(enabled.filter(s => s.elapsedMs >= sampled.terminalResponseCompletedElapsedMs && s.elapsedMs > firstDisabledMs).length,
    'observe actual loading then enabled frames after the real completed-response marker, not only pre-click frames').toBeGreaterThan(0);
  const rgba = value => {
    const match = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/);
    expect(match, 'measured browser colour must use the supported explicit RGB/RGBA grammar').not.toBeNull();
    const rgb = match.slice(1, 4).map(Number), alpha = match[4] === undefined ? 1 : Number(match[4]);
    expect(rgb.every(v => Number.isFinite(v) && v >= 0 && v <= 255) && Number.isFinite(alpha) && alpha >= 0 && alpha <= 1).toBe(true);
    return { rgb, alpha };
  };
  const composite = (rgb, alpha, back) => rgb.map((c, i) => alpha * c + (1 - alpha) * back[i]);
  const luminance = rgb => rgb.map(v => v / 255).reduce((sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i] * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), 0);
  const contrastFrames = enabled.map(s => {
    expect(s.visibility).toBe('visible'); expect(s.display).not.toBe('none');
    expect(s.rect.width > 0 && s.rect.height > 0 && s.rect.x >= 0 && s.rect.y >= 0 && s.rect.right <= PHONE.width && s.rect.bottom <= PHONE.height,
      'each observed enabled frame remains actually in the phone viewport').toBe(true);
    expect([s, ...s.ancestors].every(a => a.backgroundImage === 'none' && a.filter === 'none' && a.backdropFilter === 'none' && a.mixBlendMode === 'normal'),
      'unsupported images, filters or blending refuse the measured plain-background compositing check').toBe(true);
    expect(s.ancestors.every(a => Number(a.opacity) === 1), 'ancestor group opacity is measured; unsupported changed compositing refuses the check').toBe(true);
    expect(s.ancestors.some(a => rgba(a.backgroundColor).alpha === 1), 'an actual opaque ancestor supplies the measured backdrop').toBe(true);
    let backdrop = [255, 255, 255];
    for (const ancestor of [...s.ancestors].reverse()) { const color = rgba(ancestor.backgroundColor); backdrop = composite(color.rgb, color.alpha, backdrop); }
    const fg = rgba(s.color), bg = rgba(s.backgroundColor), opacity = Number(s.opacity);
    const buttonBG = composite(bg.rgb, bg.alpha, backdrop);
    const foreground = composite(composite(fg.rgb, fg.alpha, buttonBG), opacity, backdrop);
    const background = composite(buttonBG, opacity, backdrop);
    const light = luminance(foreground), dark = luminance(background);
    return { elapsedMs: s.elapsedMs, opacity, backdrop, foreground, background, ratio: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05) };
  });
  await test.info().attach('visible-refresh-alpha-contrast.json', { body: JSON.stringify({ threshold: 4.5,
    authority: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html', frames: contrastFrames }, null, 2), contentType: 'application/json' });
  expect(contrastFrames.filter(s => s.ratio < 4.5), 'every actual enabled visible frame meets the unchanged WCAG AA normal-text contrast threshold').toEqual([]);
});
