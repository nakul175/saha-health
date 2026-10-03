// Slice 13b (review of #145, M2): the open-model libraries for the frontline apps run in a sandboxed, opaque-origin frame.
// No network or real model is used: the CDN library URL is answered with a stand-in module that tries to reach Saha's page,
// cookies, storage and API from inside the frame and reports what it could do. The page is a synthetic origin served by the
// test, loading the real `lib/saha/frontline-capture.ts` (transpiled) exactly as the frontline panel does.
import { test, expect } from '@playwright/test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const ORIGIN = 'https://saha.test';
const capture = ts.transpileModule(readFileSync('lib/saha/frontline-capture.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const STAND_IN = `export default { async createWorker(lang, n, options) { return {
  async recognize(blob) {
    const probe = { cacheMethod: options && options.cacheMethod, size: blob.size, type: blob.type };
    try { probe.parentPage = String(parent.document.title); } catch { probe.parentPage = 'blocked'; }
    try { probe.cookie = document.cookie; } catch { probe.cookie = 'blocked'; }
    try { probe.storage = localStorage.getItem('saha-draft'); } catch { probe.storage = 'blocked'; }
    try { const r = await fetch('${ORIGIN}/api/workspace', { credentials: 'include' }); probe.api = 'read ' + r.status + ' ' + (await r.text()); } catch { probe.api = 'not readable'; }
    return { data: { text: JSON.stringify(probe) + ' ' + 'x'.repeat(5000) } };
  },
  async terminate() {},
}; } };`;

test('frontline reader: third-party model code runs in an opaque-origin frame that cannot reach Saha', async ({ context, page }) => {
  const api = [];
  await context.addCookies([{ name: 'CF_Authorization', value: 'synthetic-session', domain: 'saha.test', path: '/', secure: true, httpOnly: true, sameSite: 'None' }]);
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.href === 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js') return route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: STAND_IN });
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>Saha synthetic page</title><script type="module">import { readSyntheticFile } from '/capture.js'; window.readSyntheticFile = readSyntheticFile; window.ready = true;</script>` });
    if (url.pathname === '/capture.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: capture });
    if (url.pathname === '/api/workspace') {
      const h = await req.allHeaders(); api.push({ origin: h.origin ?? null });
      // Worst case: a proxy in front of the Worker reflects the Origin and allows credentials (seen on hosted staging, slice 11h).
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': h.origin ?? '*', 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ people: ['Synthetic patient'] }) });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(ORIGIN + '/');
  await page.waitForFunction(() => window.ready === true);
  await page.evaluate(() => localStorage.setItem('saha-draft', 'synthetic unsaved draft'));

  const result = await page.evaluate(async () => {
    const statuses = [], file = new File([new Uint8Array(2048)], 'card.png', { type: 'image/png' });
    const r = await window.readSyntheticFile(file, 'document', s => statuses.push(s));
    return { ...r, frames: document.querySelectorAll('iframe').length };
  });
  expect(result.kind).toBe('ocr');
  expect(result.engine).toBe('Tesseract.js 5.1.1 LSTM eng');
  expect(result.text.length).toBe(4000);
  expect(result.frames, 'the frame is removed after the read').toBe(0);
  const probe = JSON.parse(result.text.slice(0, result.text.indexOf('} ') + 1));
  expect(probe).toMatchObject({ cacheMethod: 'none', size: 2048, type: 'image/png', parentPage: 'blocked', cookie: 'blocked', storage: 'blocked' });
  // The frame's request to Saha carries Origin: null, which the Worker refuses before the application runs (slice 13a).
  expect(api).toHaveLength(1);
  expect(api[0].origin).toBe('null');
  // (With the worst-case reflected headers above the frame could read the answer; Saha's own gate is what refuses it.)

  // An unexpected result is refused by the page: here the frame is asked for speech, and the stand-in library is not loaded.
  const refused = await page.evaluate(async () => {
    try { await window.readSyntheticFile(new File([new Uint8Array(8)], 'a.wav', { type: 'audio/wav' }), 'symptoms', () => {}); return 'accepted'; } catch (e) { return String(e.message); }
  });
  expect(refused).not.toBe('accepted');
  expect(await page.evaluate(() => document.querySelectorAll('iframe').length)).toBe(0);
});
