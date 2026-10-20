import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = 'tests/evidence/saha-156-point-of-need-help/component-result.json';
const tmp = mkdtempSync(resolve('.point-help-component-'));
const pkg = readdirSync('node_modules/.pnpm').filter(name => name.startsWith('esbuild@')).sort().at(-1);
const esbuildPath = resolve('node_modules/.pnpm/' + pkg + '/node_modules/esbuild/lib/main.js');
const { build } = createRequire(esbuildPath)(esbuildPath);
let browser, server, passed = 0;
const check = (value, message) => { assert.ok(value, message); passed++; };
try {
  writeFileSync(join(tmp, 'entry.tsx'), `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{PointOfNeedHelp}from'../app/point-of-need-help';function App(){const[p,set]=useState({task:'routine-visit',step:'time',actorRole:'asha',sourceAvailable:true});window.__setHelp=x=>set(v=>({...v,...x}));return <main><label>Synthetic unsaved value<input aria-label="Synthetic unsaved value" defaultValue="kept"/></label><PointOfNeedHelp {...p}/></main>}createRoot(document.getElementById('root')).render(<App/>);`);
  await build({ entryPoints: [join(tmp, 'entry.tsx')], outfile: join(tmp, 'bundle.js'), bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', alias: { '@': process.cwd() }, logLevel: 'silent' });
  server = createServer((req, res) => { res.setHeader('Content-Type', req.url === '/bundle.js' ? 'application/javascript' : 'text/html'); res.end(req.url === '/bundle.js' ? readFileSync(join(tmp, 'bundle.js')) : '<meta name="viewport" content="width=device-width"><div id="root"></div><script src="/bundle.js"></script>'); });
  await new Promise(resolveListen => server.listen(21456, '127.0.0.1', resolveListen));
  const { chromium } = await import(process.env.SAHA_BROWSER_PACKAGE ?? '@playwright/test');
  browser = await chromium.launch({ headless: true, ...(process.env.SAHA_CHROMIUM ? { executablePath: process.env.SAHA_CHROMIUM } : {}) });
  const page = await browser.newPage({ viewport: { width: 320, height: 844 } }), errors = [], requests = [];
  page.on('pageerror', error => errors.push(String(error))); page.on('request', request => requests.push(request.url()));
  await page.goto('http://127.0.0.1:21456');
  const toggle = page.getByRole('button', { name: 'Need help with this step?', exact: true });
  await toggle.waitFor(); check(await toggle.getAttribute('aria-expanded') === 'false', 'Help is closed and optional initially');
  await page.getByLabel('Synthetic unsaved value').fill('unsaved worker entry'); await toggle.click();
  check(await page.getByRole('heading', { name: 'Observation time and source', exact: true }).isVisible(), 'Current step opens its approved help');
  check(await page.getByText(/Source: Saha routine-task guidance v1.0/).isVisible(), 'Visible provenance identifies exact source and version');
  check((await page.getByLabel('Synthetic unsaved value').inputValue()) === 'unsaved worker entry', 'Opening help preserves current input');
  await page.getByRole('button', { name: 'Close optional help', exact: true }).click();
  check((await page.getByLabel('Synthetic unsaved value').inputValue()) === 'unsaved worker entry', 'Dismissing help preserves current input');
  await page.evaluate(() => window.__setHelp({ step: 'fact:weight' })); await toggle.click();
  check(await page.getByRole('heading', { name: 'Record this observation', exact: true }).isVisible(), 'New step opens only its relevant help');
  await page.evaluate(() => { window.__setHelp({ step: 'notes' }); window.__setHelp({ step: 'facts-save' }); });
  await page.getByRole('heading', { name: 'Record this observation', exact: true }).waitFor({ state: 'detached' });
  check(!await page.getByRole('note').count(), 'A step change closes stale open help');
  await toggle.click(); check(await page.getByRole('heading', { name: 'Review before saving', exact: true }).isVisible(), 'Rapid step changes settle on final current help');
  await page.evaluate(() => window.__setHelp({ sourceAvailable: false }));
  await page.getByRole('note').waitFor({ state: 'detached' });
  check(!await page.getByRole('note').count(), 'Source availability change cannot leave earlier content visible');
  await toggle.click(); check(await page.getByText(/Approved task guidance is unavailable/).isVisible(), 'Unavailable source shows explicit failure state');
  check(!await page.getByRole('heading', { name: 'Review before saving', exact: true }).count(), 'Unavailable source does not fabricate cached replacement content');
  await page.evaluate(() => window.__setHelp({ actorRole: 'clinician' }));
  await page.getByLabel('Optional task help').waitFor({ state: 'detached' }); check(!await page.getByRole('note').count(), 'Changed actor eligibility removes help and protected context');
  await page.evaluate(() => window.__setHelp({ actorRole: 'asha', task: 'other', sourceAvailable: true }));
  check(!await page.getByRole('button', { name: /help/i }).count(), 'Irrelevant task does not expose help catalogue');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px component has no horizontal overflow');
  check(errors.length === 0, 'Component has no browser runtime errors');
  check(requests.filter(url => url !== 'http://127.0.0.1:21456/' && url !== 'http://127.0.0.1:21456/bundle.js').length === 0, 'Opening and changing help makes no external or write request');
  writeFileSync(out, JSON.stringify({ suite: 'SAHA-156 point-of-need help component', passed, failed: 0, errors, completedAt: new Date().toISOString(), limits: 'Actual React component in local Chromium; synthetic input only, no physical device or formal acceptance.' }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} catch (error) {
  writeFileSync(out, JSON.stringify({ suite: 'SAHA-156 point-of-need help component', passed, failed: 1, error: String(error), completedAt: new Date().toISOString() }, null, 2) + '\n');
  throw error;
} finally {
  await browser?.close(); if (server) await new Promise(resolveClose => server.close(resolveClose)); rmSync(tmp, { recursive: true, force: true });
}
