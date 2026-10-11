// BR-OPS-05 / BR-SEC-07: actual React component transition contract.
// The support API is a deterministic double. This does not qualify server authority or formal support acceptance.
import {mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';

const out = resolve(process.env.SAHA_SUPPORT_CONTEXT_EVIDENCE ?? 'tests/reports/support-context-component');
mkdirSync(out, {recursive: true});
const tmp = mkdtempSync(resolve('.support-context-'));
const esbuildPackage = readdirSync('node_modules/.pnpm').filter(n => n.startsWith('esbuild@')).sort().at(-1);
const esbuildPath = resolve('node_modules/.pnpm', esbuildPackage, 'node_modules/esbuild/lib/main.js');
const {build} = createRequire(esbuildPath)(esbuildPath);
const observations = [], checks = [], errors = [];
let browser, server, page;
const check = (actual, criterion) => checks.push({criterion, passed: actual === true});
const sourceHash = createHash('sha256').update(readFileSync('app/work-support-panel.tsx')).digest('hex');
const fixture = marker => ({
  rows: [{requestId: 'synthetic-request-' + marker, category: 'capture', state: 'request', requesterId: 'synthetic-requester', helperId: null, sequence: 1, at: '2026-10-11T00:00:00Z'}],
  helpers: [{id: 'synthetic-helper-' + marker, label: 'SYNTHETIC_HELPER_' + marker}],
  canAssign: true, overflow: false, enabled: true,
});

try {
  writeFileSync(join(tmp, 'entry.tsx'), `
import React,{useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {WorkSupportPanel} from '../app/work-support-panel';
const initial={actor:'actor-A',organisation:'org-A',visit:'visit-A',person:'person-A',memberVersion:1,role:'asha',owner:true,enabled:true,measurementVersion:1,mounted:true};
window.__events=[];window.__commits=[];window.__postMode='defer';
window.fetch=(url,options={})=>new Promise((resolve,reject)=>{
 const record={url:String(url),method:options.method??'GET',headers:options.headers??{},body:options.body?JSON.parse(options.body):null,context:{...window.__view},resolve,reject,settled:false};
 window.__events.push(record);
 if(record.method==='POST'&&window.__postMode==='reject'){record.settled=true;reject(new Error('Synthetic uncertain transport'));}
});
window.__respond=(index,status,body)=>{const r=window.__events[index];r.settled=true;r.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}));};
function App(){
 const [view,setView]=useState(initial);window.__view=view;
 window.__transition=delta=>flushSync(()=>setView(current=>({...current,...delta})));
 const data={organisation:{id:view.organisation},user:{userId:view.actor},membership:{version:view.memberVersion,role:view.role,isOwner:view.owner,status:'active',teamIds:['synthetic-team']},role:view.role,burdenMeasurement:{enabled:view.enabled,version:view.measurementVersion}};
 const visit={id:view.visit,personId:view.person};
 useLayoutEffect(()=>{window.__commits.push({view:{...view},text:document.getElementById('root').textContent,buttons:[...document.querySelectorAll('button')].map(b=>b.textContent)});},[view]);
 return <main><h1>Support context regression</h1>{view.mounted&&<WorkSupportPanel data={data as any} visit={visit as any}/>}</main>;
}
createRoot(document.getElementById('root')).render(<App/>);
`);
  await build({entryPoints: [join(tmp, 'entry.tsx')], outfile: join(tmp, 'bundle.js'), bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', alias: {'@': process.cwd()}, logLevel: 'silent'});
  server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/bundle.js' ? 'application/javascript' : 'text/html');
    res.end(req.url === '/bundle.js' ? readFileSync(join(tmp, 'bundle.js')) : '<div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const {chromium} = await import(process.env.SAHA_BROWSER_PACKAGE ?? '@playwright/test');
  browser = await chromium.launch({headless: true, ...(process.env.SAHA_CHROMIUM ? {executablePath: process.env.SAHA_CHROMIUM} : {})});
  page = await browser.newPage({viewport: {width: 390, height: 844}});
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.__events.some(e => e.method === 'GET'));
  const events = () => page.evaluate(() => __events.map((e, index) => ({index, url: e.url, method: e.method, headers: e.headers, body: e.body, context: e.context, settled: e.settled})));
  const tick = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const transition = async delta => {
    await page.evaluate(delta => __transition(delta), delta);
    const committed = await page.evaluate(() => __commits.at(-1));
    observations.push(committed);
    await tick();
    return committed;
  };
  const seed = async marker => {
    let pending = (await events()).filter(e => e.method === 'GET' && !e.settled).at(-1);
    if (!pending) {
      await page.getByRole('button', {name: 'Refresh support queue', exact: true}).click();
      pending = (await events()).filter(e => e.method === 'GET' && !e.settled).at(-1);
    }
    await page.evaluate(({index, body}) => __respond(index, 200, body), {index: pending.index, body: fixture(marker)});
    await page.getByText('SYNTHETIC_HELPER_' + marker, {exact: true}).waitFor({state: 'attached'});
  };
  const reset = async () => {
    await transition({mounted: false});
    await transition({actor: 'actor-A', organisation: 'org-A', visit: 'visit-A', person: 'person-A', memberVersion: 1, role: 'asha', owner: true, enabled: true, measurementVersion: 1, mounted: true});
  };

  await seed('INITIAL');
  check(await page.getByRole('button', {name: 'Assign support helper', exact: true}).isDisabled(), 'Actual initial queue and helper guidance render; assignment requires a selection');
  const transitions = [
    ['actor', {actor: 'actor-B'}],
    ['organisation', {organisation: 'org-B'}],
    ['visit', {visit: 'visit-B'}],
    ['person', {person: 'person-B'}],
    ['membership version', {memberVersion: 2}],
    ['role', {role: 'clinician'}],
    ['owner authority', {owner: false}],
    ['measurement version', {measurementVersion: 2}],
  ];
  for (const [name, delta] of transitions) {
    const marker = name.replaceAll(' ', '_').toUpperCase();
    await seed(marker);
    const before = (await events()).filter(e => e.method === 'GET').length;
    const committed = await transition(delta);
    check(!committed.text.includes('SYNTHETIC_HELPER_' + marker), name + ' transition first committed DOM contains no previous helper/queue');
    check((await events()).filter(e => e.method === 'GET').length === before + 1, name + ' transition starts a fresh scoped queue read');
  }

  await seed('DISABLED');
  const beforeDisable = (await events()).length;
  const disabled = await transition({enabled: false});
  check(!disabled.text.includes('Work support requests') && !disabled.text.includes('SYNTHETIC_HELPER_DISABLED'), 'Disabled measurement removes the entire support component at commit');
  check((await events()).length === beforeDisable, 'Disabled measurement sends no support request');
  await transition({enabled: true});
  await seed('RE_ENABLED');
  check(await page.getByText('SYNTHETIC_HELPER_RE_ENABLED', {exact: true}).count() === 1, 'Re-enabled current context independently loads its queue');

  await reset();
  const oldRead = (await events()).filter(e => e.method === 'GET' && !e.settled).at(-1);
  await transition({actor: 'actor-B'});
  await seed('NEW_READ');
  await page.evaluate(({index, body}) => __respond(index, 200, body), {index: oldRead.index, body: fixture('LATE_OLD_READ')});
  await tick();
  check(await page.getByText('SYNTHETIC_HELPER_LATE_OLD_READ', {exact: true}).count() === 0, 'Late old-context GET cannot populate the current queue');
  check(await page.getByText('SYNTHETIC_HELPER_NEW_READ', {exact: true}).count() === 1, 'Late old-context GET cannot clear or replace the current queue');

  await reset();
  await seed('RETRY');
  await page.evaluate(() => window.__postMode = 'reject');
  await page.getByRole('button', {name: 'Request work support', exact: true}).click();
  const retry = page.getByRole('button', {name: 'Retry pending support metadata', exact: true});
  await retry.waitFor();
  const firstPost = (await events()).filter(e => e.method === 'POST').at(-1);
  await page.evaluate(() => window.__postMode = 'defer');
  await retry.click();
  const secondPost = (await events()).filter(e => e.method === 'POST').at(-1);
  check(firstPost.body.key === secondPost.body.key, 'Same-context uncertain transport retry keeps its exact metadata key');
  check(JSON.stringify(firstPost.body) === JSON.stringify(secondPost.body), 'Same-context retry preserves the full original metadata action');
  const getCountBeforeOldPost = (await events()).filter(e => e.method === 'GET').length;
  const switchedPending = await transition({actor: 'actor-B'});
  check(!switchedPending.buttons.includes('Retry pending support metadata'), 'Actor transition first committed DOM has no old pending retry control');
  check(!switchedPending.text.includes('A pending transport retry keeps its metadata key'), 'Actor transition first committed DOM has no previous action error');
  await seed('AFTER_PENDING');
  await page.evaluate(({index}) => __respond(index, 200, {recorded: true}), {index: secondPost.index});
  await tick();
  check((await events()).filter(e => e.method === 'GET').length === getCountBeforeOldPost + 1, 'Old-context POST success never starts another read for the former context');
  check(await page.getByText('SYNTHETIC_HELPER_AFTER_PENDING', {exact: true}).count() === 1, 'Old-context POST success leaves current queue intact');
  check(await retry.count() === 0, 'Old-context POST success cannot recreate a pending retry');

  await reset();
  await seed('OLD_FAILURE');
  await page.getByRole('button', {name: 'Request work support', exact: true}).click();
  const delayedFailure = (await events()).filter(e => e.method === 'POST').at(-1);
  await transition({organisation: 'org-B'});
  await seed('AFTER_FAILURE');
  await page.evaluate(index => {const e = __events[index]; e.settled = true; e.reject(new Error('Synthetic delayed transport failure'));}, delayedFailure.index);
  await tick();
  check(await page.getByRole('alert').count() === 0, 'Late former-context transport failure cannot add an error to the current screen');
  check(await page.getByText('SYNTHETIC_HELPER_AFTER_FAILURE', {exact: true}).count() === 1, 'Late former-context transport failure leaves current queue intact');

  await page.getByRole('button', {name: 'Refresh support queue', exact: true}).click();
  await seed('MANUAL_REFRESH');
  check(await page.getByText('SYNTHETIC_HELPER_MANUAL_REFRESH', {exact: true}).count() === 1, 'Manual refresh still displays a fresh same-context queue');
  check((await events()).filter(e => e.method === 'POST').every(e => Object.keys(e.body).sort().join(',') === 'category,expectedActorId,key,type,visitId'), 'Observed request actions contain only the existing fixed support metadata fields');
  check(errors.length === 0, 'Actual bundled React component and actual Button have no uncaught browser errors');
  writeFileSync(join(out, 'observations.json'), JSON.stringify({observations, events: await events(), errors}, null, 2) + '\n');
} catch (e) {
  checks.push({criterion: 'Component test completed without fixture/runtime failure', passed: false, error: String(e)});
  writeFileSync(join(out, 'failure.log'), e.stack ?? String(e));
} finally {
  await browser?.close();
  if (server) await new Promise(r => server.close(r));
  rmSync(tmp, {recursive: true, force: true});
  const passed = checks.filter(c => c.passed).length, failed = checks.filter(c => !c.passed).length;
  const result = {passed, failed, skipped: 0, actualReactComponent: true, actualChromium: true, sourceHash, checks, errors, scope: 'Actual source component and Button bundled and committed in desktop Chromium at 390x844; parent layout observer records pre-passive-effect DOM. Deterministic API doubles; no server authorization, clinical, physical-device, formal TC-BR-OPS-05 or hosting acceptance.', cleanup: {serverClosed: !server || !server.listening, browserClosed: !browser || !browser.isConnected()}};
  writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({passed, failed, skipped: 0, result: join(out, 'result.json')}));
  if (failed) process.exitCode = 1;
}
