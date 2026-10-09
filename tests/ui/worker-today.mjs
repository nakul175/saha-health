// D02/D08: read-only mobile entry with mocked scoped API. Not backend or handset acceptance.
// Requirement links: BR-UX-01 BR-UX-02 BR-UX-08 BR-ID-02 NFR-13
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const browserModule = process.env.SAHA_BROWSER_PACKAGE || 'playwright-core';
const { chromium } = await import(browserModule);
const root = process.cwd();
const domOnly = process.env.SAHA_DOM_ONLY === '1';
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const files = { '/worker-today/': ['index.html', 'text/html'], '/worker-today/today.js': ['today.js', 'text/javascript'] };
  const file = files[path];
  if (!file) { res.writeHead(404); res.end(); return; }
  try { const bytes = await readFile(resolve(root, 'public/worker-today', file[0])); res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' }); res.end(bytes); }
  catch { res.writeHead(500); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.SAHA_CHROMIUM_PATH ? { executablePath: process.env.SAHA_CHROMIUM_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
const checks = [];
const errors = [];
const requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => requests.push({ method: r.method(), url: r.url() }));
const person = (id, name, village, extra = {}) => ({ id, name, village, task: 'Routine follow-up', due: 'Today', status: 'due', assigned: true, assignedTo: 'asha-demo', ...extra });
const fixture = () => ({ role: 'asha', environment: 'synthetic', user: { userId: 'asha-demo' }, membership: { userId: 'asha-demo', displayName: 'Sunita · ASHA', status: 'active' }, organisation: { id: 'org-demo', name: 'Synthetic community' }, people: [person('p_1', 'Meena', 'North hamlet'), person('p_2', 'Meena', 'South hamlet'), person('p_other', 'Outside scope', 'Other', { assigned: false, assignedTo: 'another' }), person('p_done', 'Completed record', 'North', { status: 'completed' })] });
let response = fixture(), statusCode = 200, broken = false;
await page.route('**/api/workspace', async route => {
  if (broken) return route.fulfill({ status: 200, contentType: 'application/json', body: '{broken' });
  await route.fulfill({ status: statusCode, contentType: 'application/json', body: JSON.stringify(response) });
});
async function check(name, run) { try { await run(); checks.push({ name, passed: true }); } catch (e) { checks.push({ name, passed: false, message: e.message }); } }
async function open() {
  if (domOnly) {
    const html = (await readFile(resolve(root, 'public/worker-today/index.html'), 'utf8')).replace(/<script type="module" src="\.\/today.js"><\/script>/, '');
    await page.setContent(html);
    await page.evaluate(({response,statusCode,broken}) => {
      window.__fixture = {response,statusCode,broken};
      window.__methods = [];
      window.fetch = async (url, options) => {
        window.__methods.push(options?.method || 'GET');
        const f = window.__fixture;
        return new Response(f.broken ? '{broken' : JSON.stringify(f.response), {status:f.statusCode,headers:{'Content-Type':'application/json'}});
      };
    }, {response,statusCode,broken});
    await page.addScriptTag({content: '{' + await readFile(resolve(root, 'public/worker-today/today.js'), 'utf8') + '\n}'});
  } else await page.goto(origin + '/worker-today/');
  await page.waitForFunction(() => !document.querySelector('#refresh').disabled);
}
try {
  await open();
  await check('D02-A1 scoped records only', async () => { assert.equal(await page.getByText('Outside scope', { exact: true }).count(), 0); assert.equal(await page.getByRole('link', { name: 'Open visit', exact: true }).count(), 1); });
  await check('D02-A2 fixed existing protected destination', async () => { assert.equal(await page.getByRole('link', { name: 'Open visit', exact: true }).getAttribute('href'), '/app?patient=p_1'); });
  await check('D08-A1 primary control visible at 360x640', async () => { const r = await page.getByRole('link', { name: 'Open visit', exact: true }).boundingBox(); assert.ok(r && r.y + r.height < 640 - 70); });
  await check('D08-A1 no horizontal page overflow', async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true));
  await check('D08-A2 touch targets', async () => { const sizes = await page.locator('button, .action').evaluateAll(es => es.map(e => e.getBoundingClientRect().height)); assert.ok(sizes.every(h => h >= 44)); });
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await check('D02-A4 duplicate names remain distinct', async () => { assert.equal(await page.getByRole('link', { name: 'Open Meena, North hamlet' }).count(), 1); assert.equal(await page.getByRole('link', { name: 'Open Meena, South hamlet' }).count(), 1); });
  await page.getByRole('searchbox').fill('South');
  await check('D02-A1 local assigned search', async () => { assert.equal(await page.locator('.person').count(), 1); assert.equal(await page.locator('.person').getAttribute('href'), '/app?patient=p_2'); });
  await page.getByRole('button', { name: 'My Space', exact: true }).click();
  await check('D02 boundaries disclosed', async () => { await page.getByText('Drafts, sync and what is available', { exact: true }).click(); assert.equal(await page.getByRole('link', { name: 'Open prepared device work' }).getAttribute('href'), '/app/offline/'); });
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  statusCode = 403; if(domOnly) await page.evaluate(() => { window.__fixture.statusCode = 403; }); await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('#refresh').disabled);
  await check('D02-N1 refusal clears prior data', async () => { assert.equal(await page.getByRole('heading', { name: 'Sign in to continue' }).count(), 1); assert.equal(await page.getByText('Meena', { exact: true }).count(), 0); });
  statusCode = 500; await open();
  await check('D02-N2 error is not empty', async () => assert.equal(await page.getByRole('heading', { name: 'Your work could not be loaded' }).count(), 1));
  statusCode = 200; broken = true; await open();
  await check('D02-N2 malformed JSON', async () => assert.equal(await page.locator('.person, .next').count(), 0));
  broken = false; response = { ...fixture(), role: 'admin' }; await open();
  await check('Non-ASHA preview refused without expanding authority', async () => assert.equal(await page.getByRole('heading', { name: 'Use your existing workspace' }).count(), 1));
  response = { ...fixture(), environment: 'production' }; await open();
  await check('Production preview not enabled', async () => assert.equal(await page.locator('.person, .next').count(), 0));
  response = { ...fixture(), patientPaging: { total: 20 } }; await open();
  await check('Paged response not misrepresented as complete list', async () => assert.equal(await page.locator('.person, .next').count(), 0));
  response = { ...fixture(), people: [] }; await open();
  await check('D02-A3 genuine empty state', async () => assert.equal(await page.getByText(/No open assigned records/).count(), 1));
  response = fixture(); response.people[0].id = 'p_1&patient=evil'; await open();
  await check('D02-N3 identifier URL encoding', async () => assert.equal(await page.getByRole('link', { name: 'Open visit', exact: true }).getAttribute('href'), '/app?patient=p_1%26patient%3Devil'));
  response = fixture(); response.people[0].name = '<img src=x onerror=alert(1)>'; await open();
  await check('Patient text cannot become executable markup', async () => { assert.equal(await page.locator('#content img').count(), 0); assert.equal(await page.locator('.next h2').innerText(), '<img src=x onerror=alert(1)>'); });
  response = fixture(); response.people[0].name = 'A very long synthetic household member name for compact screen testing'; await open();
  await page.addStyleTag({ content: ':root { font-size: 32px; }' });
  await check('D08-A1 enlarged text reflows', async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true));
  await page.setViewportSize({ width: 390, height: 844 }); response = fixture(); await open();
  await check('D08-A2 keyboard navigation reaches content', async () => { await page.keyboard.press('Tab'); assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY'); });
  await check('Read-only surface issues no mutation', async () => assert.equal(requests.filter(r => r.method !== 'GET').length, 0));
  if (!domOnly) await check('No private data in localStorage', async () => assert.equal(await page.evaluate(() => localStorage.length), 0));
  else await check('DOM-only transport invoked GET only', async () => assert.ok((await page.evaluate(() => window.__methods)).every(x => x === 'GET')));
  await check('No browser execution errors', async () => assert.deepEqual(errors, []));
  if (process.env.SAHA_EVIDENCE_DIR) {
    await mkdir(process.env.SAHA_EVIDENCE_DIR, { recursive: true });
    await page.screenshot({ path: resolve(process.env.SAHA_EVIDENCE_DIR, 'worker-today-390.png'), fullPage: true });
  }
} finally {
  await browser.close(); await new Promise(r => server.close(r));
}
const result = { kind: domOnly ? 'DOM-only isolated presentation with injected transport; no browser navigation, storage or backend qualification' : 'Read-only Today entry with mocked API; not backend, clinical or handset acceptance', passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, checks };
console.log(JSON.stringify(result, null, 2));
// The repository runner reads a final one-line count; detailed evidence stays above/on disk.
console.log(JSON.stringify({ passed: result.passed, failed: result.failed, skipped: 0 }));
if (process.env.SAHA_EVIDENCE_DIR) await writeFile(resolve(process.env.SAHA_EVIDENCE_DIR, 'worker-today-result.json'), JSON.stringify(result, null, 2));
if (result.failed) process.exitCode = 1;
