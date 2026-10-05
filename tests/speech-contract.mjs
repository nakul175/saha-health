// Device privacy is injected here; its server/IndexedDB effects are verified in device-work-contract/browser.
import {deviceDigest} from '../public/field/device-work.js';
// Slice 12a contract: voice input on every text and number field. The owner setting for the browser speech service (who may
// change it, versions, refusals, the practice-data environments, audit), the choice of recognizer, how heard text becomes a
// field value, which fields get a microphone, and that the field notebook (public/field/app.js) turns speech into the same
// values as the workspace.
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.speech-contract-'));
let passed = 0;
const check = async fn => { await fn(); passed++; };
const status = (fn, code) => { try { fn(); assert.fail('expected a refusal'); } catch (e) { if (e.name === 'AssertionError') throw e; assert.equal(e.status, code, e.message); return e.message; } };
try {
  writeFileSync(join(dir, 'speech.js'), ts.transpileModule(readFileSync('lib/saha/speech.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const S = await import(pathToFileURL(join(dir, 'speech.js')));
  const fail = (s, message) => { const e = new Error(message); e.status = s; throw e; };
  let n = 0; const uuid = () => `id-${++n}`;
  const member = (userId, role, isOwner = false, st = 'active') => ({ userId, displayName: 'Synthetic ' + userId, role, isOwner, status: st, teamIds: ['t1'], version: 1, createdAt: '2026-10-01T00:00:00Z' });
  const own = member('own', 'clinician', true), adm = member('adm', 'admin'), sup = member('sup', 'supervisor'), asha = member('asha', 'asha'), gone = member('gone', 'clinician', true, 'suspended');
  const state = () => ({ organisation: { id: 'org1', name: 'Synthetic' }, members: [own, adm, sup, asha, gone], workspace: { audit: [] }, operations: undefined });
  const set = (s, who, body, env = 'synthetic') => S.applySpeechPolicy(s, { type: 'setSpeechPolicy', reason: 'Practice sessions on phones need voice input', ...body }, { userId: who.userId, displayName: who.displayName }, who, env, fail, uuid, '2026-10-03T09:00:00.000Z');

  // ----- the owner setting -----
  await check(() => { const s = state(); assert.deepEqual(S.speechPolicy(s), { cloudAllowed: false, version: 0, changes: [] }, 'off by default'); assert.deepEqual(S.speechPolicyView(s, 'synthetic'), { cloudAllowed: false, version: 0 }); });
  await check(() => { const s = state(); for (const who of [adm, sup, asha, gone]) assert.match(status(() => set(s, who, { cloudAllowed: true, version: 0 }), 403), /Only an organisation owner/); assert.equal(s.operations, undefined, 'a refusal changes nothing'); assert.equal(s.workspace.audit.length, 0); });
  await check(() => { const s = state(); const r = set(s, own, { cloudAllowed: true, version: 0 });
    assert.deepEqual(r, { cloudAllowed: true, version: 1 }); assert.deepEqual(S.speechPolicyView(s, 'synthetic'), { cloudAllowed: true, version: 1 });
    const p = S.speechPolicy(s); assert.equal(p.changes.length, 1); assert.deepEqual(p.changes[0], { at: '2026-10-03T09:00:00.000Z', by: 'own', byName: 'Synthetic own', cloudAllowed: true, reason: 'Practice sessions on phones need voice input' });
    const a = s.workspace.audit.at(-1); assert.equal(a.action, 'setSpeechPolicy'); assert.equal(a.subject, 'org1'); assert.match(a.detail, /browser speech service is allowed.*practice data only.*setting version 1/); assert.equal(a.role, 'clinician'); });
  await check(() => { const s = state(); set(s, own, { cloudAllowed: true, version: 0 });
    assert.match(status(() => set(s, own, { cloudAllowed: false, version: 0 }), 409), /changed\. Refresh/, 'a stale version is refused');
    assert.match(status(() => set(s, own, { cloudAllowed: true, version: 1 }), 409), /already allowed/, 'no change is refused');
    assert.deepEqual(set(s, own, { cloudAllowed: false, version: 1 }), { cloudAllowed: false, version: 2 }); assert.match(s.workspace.audit.at(-1).detail, /off \(on-device speech only\)/); });
  await check(() => { for (const env of ['production', 'pilot', 'staging', '', null]) { const s = state(); assert.match(status(() => set(s, own, { cloudAllowed: true, version: 0 }, env), 422), /only in the synthetic or training environment/, `refused in ${env}`); assert.equal(S.speechPolicy(s).version, 0); } });
  await check(() => { const s = state(); assert.deepEqual(set(s, own, { cloudAllowed: true, version: 0 }, 'training'), { cloudAllowed: true, version: 1 }, 'training data is practice data');
    assert.deepEqual(set(s, own, { cloudAllowed: false, version: 1 }, 'production'), { cloudAllowed: false, version: 2 }, 'turning it off is always allowed'); });
  await check(() => { const s = state(); set(s, own, { cloudAllowed: true, version: 0 }); assert.deepEqual(S.speechPolicyView(s, 'production'), { cloudAllowed: false, version: 1 }, 'a stored setting is not honoured outside a practice environment'); assert.deepEqual(S.speechPolicyView(s, 'training'), { cloudAllowed: true, version: 1 }); });
  await check(() => { const s = state(); s.operations = { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null, speechPolicy: { cloudAllowed: false, version: 200, changes: Array.from({ length: 200 }, () => ({})) } };
    assert.match(status(() => set(s, own, { cloudAllowed: true, version: 200 }), 422), /change limit/); });
  await check(() => { for (const bad of [{ cloudAllowed: true, version: 0, reason: 'too short' }, { cloudAllowed: 'yes', version: 0 }, { cloudAllowed: true }, { cloudAllowed: true, version: -1 }, { cloudAllowed: true, version: 0.5 }, { cloudAllowed: true, version: 0, organisationId: 'org2' }])
      assert.equal(S.speechPolicySchema.safeParse({ type: 'setSpeechPolicy', reason: 'Practice sessions on phones need voice input', ...bad }).success, false, JSON.stringify(bad));
    assert.equal(S.applySpeechPolicy(state(), { type: 'setSignOffPolicy', required: true, version: 0, reason: 'x'.repeat(12) }, own, own, 'synthetic', fail, uuid), null, 'other commands pass through'); });

  // ----- which recognizer -----
  await check(() => { const m = o => S.speechMode({ hasApi: true, local: null, cloudAllowed: false, environment: 'synthetic', online: true, ...o });
    assert.deepEqual(m({ hasApi: false, local: 'available', cloudAllowed: true }), { mode: 'none', reason: 'no-api' });
    assert.deepEqual(m({ local: 'available' }), { mode: 'local' }, 'on-device first, without the setting');
    assert.deepEqual(m({ local: 'available', online: false }), { mode: 'local' }, 'on-device works offline');
    for (const local of [null, 'unavailable', 'downloadable', 'downloading']) assert.deepEqual(m({ local }), { mode: 'none', reason: 'cloud-off' }, `not on-device (${local}) and the service is off`);
    assert.deepEqual(m({ cloudAllowed: true }), { mode: 'cloud' });
    assert.deepEqual(m({ cloudAllowed: true, online: false }), { mode: 'none', reason: 'offline' });
    assert.deepEqual(m({ cloudAllowed: true, environment: 'production' }), { mode: 'none', reason: 'cloud-off' }, 'the client checks the environment too');
    assert.equal(S.speechLanguage('hi'), 'hi-IN'); assert.equal(S.speechLanguage('en'), 'en-IN'); assert.equal(S.speechLanguage(undefined), 'en-IN'); });

  // ----- heard text to a field value -----
  const numbers = [['152', '152', []], ['BP 152 by 114', '152', ['114']], ['36 point 8 degrees', '36.8', []], ['३६.८', '36.8', []], ['वजन ५८ किलो', '58', []], ['1,250 grams', '1250', []], ['58.5 kg', '58.5', []], ['one fifty two', null, []], ['', null, []], ['३६ दशमलव ८', '36.8', []]];
  await check(() => { for (const [heard, value, others] of numbers) assert.deepEqual(S.spokenNumber(heard), { value, others }, heard); });
  await check(() => { assert.equal(S.spokenDigits('91 1234-5678 9012'), '91123456789012'); assert.equal(S.spokenDigits('९८७६५ ४३२१०'), '9876543210'); assert.equal(S.spokenDigits('nine eight'), null); });
  await check(() => { assert.equal(S.fieldKind({ type: 'tel' }), 'digits'); assert.equal(S.fieldKind({ inputMode: 'numeric' }), 'digits'); assert.equal(S.fieldKind({ inputMode: 'decimal' }), 'decimal'); assert.equal(S.fieldKind({ type: 'number' }), 'decimal'); assert.equal(S.fieldKind({ type: 'text' }), 'text'); assert.equal(S.fieldKind({}), 'text'); });
  await check(() => { assert.equal(S.insertion('', 'headache for two days', 'text'), 'headache for two days');
    assert.equal(S.insertion('Fever since Monday.  ', 'headache for two days', 'text'), 'Fever since Monday. headache for two days', 'words are added after what is there');
    assert.equal(S.insertion('120', 'BP 152 by 114', 'decimal'), '152', 'a number replaces the value');
    assert.equal(S.insertion('', 'one fifty two', 'decimal'), null, 'no number, nothing to insert');
    assert.equal(S.insertion('', '91 1234 5678 9012', 'digits'), '91123456789012');
    assert.equal(S.insertion('x', '   ', 'text'), null, 'nothing heard, nothing inserted'); });
  await check(() => { const e = o => S.voiceEligible({ tag: 'input', ...o });
    for (const [o, want] of [[{}, true], [{ type: 'text' }, true], [{ type: 'search' }, true], [{ type: 'number' }, true], [{ type: 'tel' }, true], [{ type: 'password' }, false], [{ type: 'email' }, false], [{ type: 'date' }, false], [{ type: 'datetime-local' }, false], [{ type: 'file' }, false], [{ type: 'checkbox' }, false], [{ readOnly: true }, false], [{ disabled: true }, false], [{ autocomplete: 'one-time-code' }, false], [{ voice: 'off' }, false]])
      assert.equal(e(o), want, JSON.stringify(o));
    assert.equal(S.voiceEligible({ tag: 'textarea' }), true); assert.equal(S.voiceEligible({ tag: 'textarea', voice: 'off' }), false); assert.equal(S.voiceEligible({ tag: 'select' }), false); });

  // ----- the field notebook gives the same values, and uses the browser service only as the workspace allows -----
  class Element { constructor(tag = 'div') { this.tag = tag; this.children = []; this.value = ''; this.style = {}; this.dataset = {}; } append(...c) { this.children.push(...c); } prepend(...c) { this.children.unshift(...c); } replaceChildren(...c) { this.children = c; } querySelector() { return null; } setAttribute() {} }
  const els = new Map(), byId = id => { if (!els.has(id)) els.set(id, new Element()); return els.get(id); };
  const win = { indexedDB: {}, addEventListener: () => {} }, nav = { onLine: true };
  const ctx = vm.createContext({deviceDigest,reconcileDeviceBook:async(book,_key,_salt,revision)=>({book,revision,removed:0}),reportDeviceFailure:async()=>false, console, crypto, TextEncoder, TextDecoder, structuredClone, Date, Map, Array, Promise, Error, JSON, Uint8Array, Blob, Number, Math, String, queueMicrotask, setTimeout: () => 0, clearTimeout: () => {},
    derive: async () => null, seal: async () => null, unseal: async () => null, verifyPacket: async () => true, packetHash: async () => '', sealBytes: async () => null, unsealBytes: async () => null,
    readVault: async () => null, writeVault: async () => 1, deleteVault: async () => {}, writeMedia: async () => {}, readMedia: async () => null, deleteMedia: async () => {}, listMediaIds: async () => [],
    fetch: async () => { throw Error('offline'); }, navigator: nav, window: win, document: { hidden: false, documentElement: {}, body: new Element('body'), getElementById: byId, createElement: tag => new Element(tag), addEventListener: () => {} } });
  vm.runInContext(readFileSync('public/field/app.js', 'utf8').replace(/^import[^\n]*\n/gm, ''), ctx);
  const run = code => vm.runInContext(code, ctx);
  await check(() => { for (const [heard, value, others] of numbers) assert.deepEqual(JSON.parse(JSON.stringify(run(`voiceNumber(${JSON.stringify(heard)})`))), { value, others }, `notebook ${heard}`); });
  await check(() => { for (const [current, heard, kind] of [['', 'headache for two days', 'text'], ['Fever since Monday.  ', 'headache', 'text'], ['120', 'BP 152 by 114', 'decimal'], ['', 'one fifty two', 'decimal'], ['', '91 1234 5678 9012', 'digits'], ['x', '  ', 'text'], ['', '३६.८', 'decimal']])
      assert.equal(run(`voiceValue(${JSON.stringify(current)},${JSON.stringify(heard)},${JSON.stringify(kind)})`), S.insertion(current, heard, kind), `notebook and workspace agree: ${heard} (${kind})`); });
  await check(async () => { class R { static async available() { return R.local; } } R.local = 'unavailable';
    const mode = async () => { const m = await run(`voiceMode('hi-IN')`); return { mode: m.mode, reason: m.reason }; };
    run(`workspace=null`); assert.deepEqual(await mode(), { mode: 'none', reason: 'voiceNoApi' }, 'no recognizer');
    win.SpeechRecognition = R;
    assert.deepEqual(await mode(), { mode: 'none', reason: 'voiceCloudOff' }, 'nothing loaded this session: on-device only');
    run(`workspace={environment:'synthetic',speechPolicy:{cloudAllowed:false,version:0}}`); assert.deepEqual(await mode(), { mode: 'none', reason: 'voiceCloudOff' });
    run(`workspace={environment:'synthetic',speechPolicy:{cloudAllowed:true,version:1}}`); assert.deepEqual(await mode(), { mode: 'cloud', reason: undefined });
    nav.onLine = false; assert.deepEqual(await mode(), { mode: 'none', reason: 'voiceOffline' }, 'the browser service needs a network');
    R.local = 'available'; assert.deepEqual(await mode(), { mode: 'local', reason: undefined }, 'on-device works offline');
    R.local = 'unavailable'; nav.onLine = true; run(`workspace={environment:'production',speechPolicy:{cloudAllowed:true,version:1}}`); assert.deepEqual(await mode(), { mode: 'none', reason: 'voiceCloudOff' }, 'not outside practice environments');
    delete win.SpeechRecognition; win.webkitSpeechRecognition = R; run(`workspace={environment:'training',speechPolicy:{cloudAllowed:true,version:1}}`); assert.deepEqual(await mode(), { mode: 'cloud', reason: undefined }, 'the prefixed recognizer is used too'); });
  await check(() => { const mics = el => el.children.filter(c => c.className === 'mic').length + el.children.reduce((n, c) => n + (c.children ? c.children.filter(x => x.className === 'mic').length : 0), 0);
    const text = run(`field('Name / नाम','',()=>{},'text',false)`), kinds = run(`[field('Notes','',()=>{},'textarea',false),field('When','',()=>{},'datetime-local',false),field('Name','',()=>{},'text',true)]`);
    assert.equal(mics(text), 1, 'a text box gets a Speak button'); assert.equal(text.children[0].tag, 'label', 'beside its label, not inside it (the box keeps its label as its name)');
    assert.equal(text.children[0].children.some(c => c.className === 'mic'), false); assert.equal(text.querySelector?.('input') !== undefined, true);
    assert.deepEqual(Array.from(kinds, mics), [1, 0, 0], 'a text area does; a date or a disabled box does not'); });
} finally { rmSync(dir, { recursive: true, force: true }); }
const result = { suite: 'Voice input on text and number fields (slice 12a)', passed, failed: 0 };
writeFileSync('tests/speech-contract-result.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
