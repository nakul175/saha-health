// Slice 10j contract: the workspace message catalogue (BR-UX-05), its fallback rules and the per-member language choice.
// Light test: it transpiles lib/saha/messages.ts (no imports) and scans app/*.tsx for the keys the screens use.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.i18n-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  writeFileSync(join(dir, 'messages.js'), ts.transpileModule(readFileSync('lib/saha/messages.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const M = await import(pathToFileURL(join(dir, 'messages.js')));
  const keys = Object.keys(M.CATALOGUE);
  const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  const devanagari = /[ऀ-ॿ]/, devanagariDigit = /[०-९]/;

  // ---- Language list and defaults ----
  check(() => assert.deepEqual([...M.LANGUAGES], ['en', 'hi']));
  check(() => assert.equal(M.DEFAULT_LANGUAGE, 'en', 'English is the default'));
  check(() => assert.equal(M.LANGUAGE_NAME.en, 'English'));
  check(() => assert.ok(devanagari.test(M.LANGUAGE_NAME.hi), 'the Hindi name of the language is written in Devanagari'));

  // ---- Completeness for the screens BR-UX-05 lists ----
  check(() => assert.deepEqual([...M.SCREENS], ['common', 'role', 'nav', 'work', 'patient', 'capture', 'review', 'receipts', 'clinical']));
  check(() => assert.ok(keys.length >= 300, 'the catalogue covers the listed screens (' + keys.length + ' keys)'));
  for (const screen of M.SCREENS) check(() => assert.ok(keys.some(k => M.screenOf(k) === screen), `screen ${screen} has keys`));
  check(() => assert.deepEqual(keys.filter(k => !M.SCREENS.includes(M.screenOf(k))), [], 'no key outside the listed screens'));
  // Data values, protocol text and record contents are never catalogue entries.
  check(() => assert.deepEqual(keys.filter(k => /^(?:[a-z]+\.)?(programme|programmes|protocol|protocols|rule|rules|sex|village)\./.test(k)), [], 'no catalogue group for data values or protocol text'));
  const entry = k => M.CATALOGUE[k];
  for (const key of keys) {
    const [en, hi] = entry(key);
    check(() => assert.ok(typeof en === 'string' && en.trim(), `${key}: English text present`));
    check(() => assert.ok(typeof hi === 'string' && hi.trim(), `${key}: Hindi text present`));
    check(() => assert.deepEqual([hi.match(/^\s*/)[0], hi.match(/\s*$/)[0]], [en.match(/^\s*/)[0], en.match(/\s*$/)[0]], `${key}: the same spacing around a sentence fragment in both languages`));
    check(() => assert.ok(devanagari.test(hi), `${key}: Hindi text is not a copy of the English`));
    check(() => assert.deepEqual(placeholders(hi), placeholders(en), `${key}: same {placeholders} in both languages`));
    check(() => assert.equal(devanagariDigit.test(hi), false, `${key}: digits stay Western`));
    check(() => assert.deepEqual((hi.match(/\d+/g) ?? []).sort(), (en.match(/\d+/g) ?? []).sort(), `${key}: numbers unchanged`));
    check(() => assert.doesNotMatch(hi, /undefined|\[object|\{\s|\s\}/, `${key}: no template residue`));
    // Units and duration words that follow a value stay Latin in Hindi too.
    for (const unit of ['mmHg', 'kg', '°C', 'UTC', 'bpm']) if (new RegExp(`(^|[\\s(·])${unit.replace('°', '\\u00b0')}($|[\\s),.·])`).test(en)) check(() => assert.ok(hi.includes(unit), `${key}: keeps the unit ${unit}`));
    for (const unit of ['weeks', 'days', 'years']) if (new RegExp(`(\\d|\\{\\w+\\}|·|\\()\\s*${unit}\\b`).test(en)) check(() => assert.ok(hi.includes(unit), `${key}: keeps the unit word ${unit}`));
  }
  check(() => assert.equal(M.message('hi', 'common.draftNotice'), 'यह हिंदी पाठ मसौदा अनुवाद है। किसी योग्य अनुवादक ने इसकी समीक्षा नहीं की है।'));
  check(() => assert.match(M.message('en', 'common.draftNotice'), /draft translation.*qualified translator has not reviewed/));
  check(() => assert.ok(M.message('hi', 'capture.weeks').includes('weeks'), 'a value-adjacent unit label is kept'));

  // ---- The environment strip keeps the exact English wording of the previous strings ----
  const env = readFileSync('lib/saha/environment.ts', 'utf8').match(/ENVIRONMENT_LABEL: Record<EnvironmentName, string> = \{([\s\S]*?)\};/)[1];
  for (const [, name, label] of env.matchAll(/(\w+): '([^']+)'/g)) check(() => assert.equal(M.message('en', `nav.env.${name}`), label, `nav.env.${name} matches the environment label`));
  check(() => assert.equal(M.message('en', 'nav.note.synthetic'), 'Use synthetic records only. AI outputs and programme receipts are demonstrations. Live services require approved connections.'));

  // ---- Measurement and source labels equal the English wording the server and exports still use ----
  const fp = readFileSync('lib/saha/fact-provenance.ts', 'utf8');
  const labelPairs = (text, pattern) => [...text.matchAll(pattern)].map(m => [m[1], m[2]]);
  const measureLabels = labelPairs(fp.match(/MEASURE_LABEL:Record<Measure,string>=\{([^}]*)\}/)[1], /(\w+):'([^']+)'/g);
  const sourceLabels = labelPairs(fp.match(/SOURCE_LABEL:Record<FactSource,string>=\{([^}]*)\}/)[1], /'?([\w-]+)'?:'([^']+)'/g);
  const rangeLabels = labelPairs(fp.slice(fp.indexOf('fields:{'), fp.indexOf('}} as const')), /(\w+):\{label:'([^']+)',unit:/g);
  check(() => assert.equal(measureLabels.length, 5));
  check(() => assert.equal(sourceLabels.length, 6));
  check(() => assert.deepEqual(rangeLabels.map(([k]) => k), ['systolic', 'diastolic', 'weight', 'temperature', 'weeks', 'coughDays']));
  for (const [k, v] of measureLabels) check(() => assert.equal(M.labelFor('en', 'capture.measure', k), v, `measure ${k} reads as before in English`));
  for (const [k, v] of sourceLabels) check(() => assert.equal(M.labelFor('en', 'capture.src', k), v, `source ${k} reads as before in English`));
  for (const [k, v] of rangeLabels) check(() => assert.equal(M.labelFor('en', 'capture.measure', k), v, `value field ${k} reads as before in English`));
  for (const [k] of [...measureLabels, ...sourceLabels, ...rangeLabels]) check(() => assert.ok(M.labelFor('hi', k.length && keys.includes(`capture.measure.${k}`) ? 'capture.measure' : 'capture.src', k) !== k, `${k} has a Hindi label`));

  // ---- The navigation labels in the source are the English catalogue text ----
  const navSource = readFileSync('app/workspace.tsx', 'utf8').match(/const nav=\[(.*?)\] as const;/s)[1];
  const navItems = [...navSource.matchAll(/id:'([^']+)',label:'([^']+)'/g)];
  check(() => assert.equal(navItems.length, 14));
  for (const [, id, label] of navItems) check(() => assert.equal(M.message('en', `nav.${id}`), label, `nav.${id} matches the source label`));

  // ---- Fallback rules (tested against an incomplete catalogue, then against the real one) ----
  const T = M.createTranslator({ 'a.both': ['English', 'हिन्दी'], 'a.missing': ['Only English'], 'a.blank': ['Blank Hindi', '   '], 'a.number': ['Odd Hindi', 7], 'a.params': ['Hello {name}, {n} left', 'नमस्ते {name}, {n} शेष'], 'a.one': ['{n} item', '{n} वस्तु'], 'a.other': ['{n} items'] });
  check(() => assert.equal(T.message('en', 'a.both'), 'English'));
  check(() => assert.equal(T.message('hi', 'a.both'), 'हिन्दी'));
  check(() => assert.equal(T.message('hi', 'a.missing'), 'Only English', 'a missing Hindi string falls back to English'));
  check(() => assert.equal(T.message('hi', 'a.blank'), 'Blank Hindi', 'a blank Hindi string falls back to English'));
  check(() => assert.equal(T.message('hi', 'a.number'), 'Odd Hindi', 'a non-string Hindi entry falls back to English'));
  check(() => assert.equal(T.message('hi', 'a.unknown'), 'a.unknown', 'an unknown key returns the key, never a blank'));
  for (const inherited of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) check(() => assert.equal(T.message('hi', inherited), inherited, `${inherited} is not a catalogue key`));
  check(() => assert.equal(T.message('hi', 'a.params', { name: 'आशा', n: 3 }), 'नमस्ते आशा, 3 शेष'));
  check(() => assert.equal(T.message('en', 'a.params', { name: 'Asha' }), 'Hello Asha, {n} left', 'an unsupplied placeholder is left visible, not blanked'));
  check(() => assert.equal(T.message('hi', 'a.both', { x: 1 }), 'हिन्दी'));
  check(() => assert.equal(T.plural('en', 'a', 1), '1 item'));
  check(() => assert.equal(T.plural('en', 'a', 0), '0 items'));
  check(() => assert.equal(T.plural('hi', 'a', 1), '1 वस्तु'));
  check(() => assert.equal(T.plural('hi', 'a', 2), '2 items', 'a missing Hindi plural falls back to English'));
  check(() => assert.equal(T.has('a.both'), true));
  check(() => assert.equal(T.has('nope'), false));
  // The real catalogue with its Hindi removed answers in English for every key.
  const stripped = M.createTranslator(Object.fromEntries(keys.map(k => [k, [entry(k)[0]]])));
  for (const key of keys) check(() => assert.equal(stripped.message('hi', key), entry(key)[0], `${key}: falls back to its English text`));
  check(() => assert.equal(M.message('hi', 'not.a.key'), 'not.a.key'));
  check(() => assert.equal(M.hasMessage('nav.work'), true));
  check(() => assert.equal(M.hasMessage('nav.nope'), false));
  check(() => assert.equal(M.hasMessage('constructor'), false));
  check(() => assert.equal(M.message('en', 'nav.work'), 'My work'));

  // ---- Plurals, state labels and sign-off lines ----
  check(() => assert.equal(M.plural('en', 'clinical.urgentCount', 1), M.message('en', 'clinical.urgentCount.one', { n: 1 })));
  check(() => assert.equal(M.plural('hi', 'clinical.urgentCount', 2), M.message('hi', 'clinical.urgentCount.other', { n: 2 })));
  check(() => assert.match(M.plural('hi', 'clinical.urgentCount', 3), /3/));
  check(() => assert.notEqual(M.plural('en', 'patient.mergedFrom', 1), M.plural('en', 'patient.mergedFrom', 2), 'one and other differ'));
  check(() => assert.equal(M.labelFor('hi', 'common.state', 'accepted'), M.message('hi', 'common.state.accepted')));
  check(() => assert.equal(M.labelFor('en', 'common.state', 'accepted'), 'accepted'));
  check(() => assert.equal(M.labelFor('hi', 'common.state', 'a-state-we-never-translated'), 'a-state-we-never-translated', 'an unknown value is shown as stored'));
  check(() => assert.equal(M.labelFor('hi', 'role', 'asha'), M.message('hi', 'role.asha')));
  check(() => assert.equal(M.labelFor('hi', 'no.group', 'maternal'), 'maternal', 'a data value with no catalogue entry stays as recorded'));
  check(() => assert.equal(M.labelFor('hi', 'common.state', 'constructor'), 'constructor'));
  const signed = { byName: 'Dr Rao', at: '2026-10-02T09:30:00.000Z' };
  check(() => assert.ok(M.signOffLine('hi', signed).includes('Dr Rao') && M.signOffLine('hi', signed).includes('2026-10-02 09:30') && M.signOffLine('hi', signed).includes('UTC'), 'name and UTC time are not translated'));
  check(() => assert.equal(M.signOffLine('hi', signed), M.signOffLine('en', signed), 'unqualified safety-critical receipt text fails closed to source English'));
  check(() => assert.equal(M.signOffLine('en', undefined), M.message('en', 'receipts.notSignedOff')));
  check(() => assert.equal(M.signOffLine('hi', undefined), M.message('hi', 'receipts.notSignedOff')));

  // ---- The screens only use keys that exist ----
  const files = readdirSync('app').filter(f => f.endsWith('.tsx'));
  const used = new Set(), prefixes = new Set(), groups = new Set();
  for (const f of files) {
    const text = readFileSync(join('app', f), 'utf8');
    for (const m of text.matchAll(/(?<![\w$])(?:\w+\.)?(?:t|n)\(\s*'([a-z]+(?:\.[A-Za-z0-9]+)+)'/g)) used.add(m[1]);
    for (const m of text.matchAll(/(?<![\w$])(?:\w+\.)?t\(\s*`([a-z]+(?:\.[A-Za-z0-9]+)*\.)\$\{/g)) prefixes.add(m[1]);
    for (const m of text.matchAll(/(?<![\w$])(?:\w+\.)?label\(\s*'([a-z]+(?:\.[A-Za-z0-9]+)*)'/g)) groups.add(m[1] + '.');
    for (const m of text.matchAll(/(?<![\w$])message\(\s*[^,()]+,\s*'([a-z]+(?:\.[A-Za-z0-9]+)+)'/g)) used.add(m[1]);
  }
  const hasKey = k => keys.includes(k) || (keys.includes(k + '.one') && keys.includes(k + '.other'));
  check(() => assert.ok(used.size >= 150, 'the scan finds the screens\' keys (' + used.size + ')'));
  for (const k of used) check(() => assert.ok(hasKey(k), `app uses the key ${k}, which is not in the catalogue`));
  for (const p of prefixes) check(() => assert.ok(keys.some(k => k.startsWith(p)), `app builds keys under ${p}, which has no entries`));
  for (const g of groups) check(() => assert.ok(keys.some(k => k.startsWith(g)), `app labels values under ${g}, which has no entries`));
  // Keys the code reaches through messages.ts itself.
  const internal = new Set([...readFileSync('lib/saha/messages.ts', 'utf8').matchAll(/(?:message|real\.message)\(\s*language,\s*'([^']+)'/g)].map(m => m[1]));
  const unused = keys.filter(k => !used.has(k) && !used.has(k.replace(/\.(one|other)$/, '')) && !internal.has(k) && ![...prefixes, ...groups].some(p => k.startsWith(p)));
  check(() => assert.deepEqual(unused, [], 'every catalogue key is used by a screen'));
  // The provider wraps the workspace and every Hindi screen carries the notice.
  const ws = readFileSync('app/workspace.tsx', 'utf8');
  check(() => assert.match(ws, /<I18nProvider lang=\{lang\}>/));
  check(() => assert.match(ws, /<TranslationNotice /));
  check(() => assert.match(ws, /<SidebarInset className="app-main" lang=\{hl\}>/, 'the translated content is marked lang="hi"'));
  const i18nSource = readFileSync('app/i18n.tsx', 'utf8');
  check(() => assert.match(i18nSource, /role="note"/));
  check(() => assert.match(i18nSource, /<p lang="hi">/));
  check(() => assert.match(i18nSource, /lang="en" className="lang-island"/, 'an untranslated island is marked lang="en"'));

  // ---- The per-member language choice ----
  const at = '2026-10-02T10:00:00.000Z', later = '2026-10-02T11:00:00.000Z';
  check(() => assert.deepEqual(M.languageOf(undefined, 'u1'), { language: 'en', version: 0 }));
  check(() => assert.deepEqual(M.languageOf({}, 'u1'), { language: 'en', version: 0 }));
  check(() => assert.deepEqual(M.languageOf({}, 'constructor'), { language: 'en', version: 0 }, 'inherited keys are not members'));
  check(() => assert.deepEqual(M.languageOf({ u1: { language: 'fr', version: 4, at } }, 'u1'), { language: 'en', version: 0 }, 'an unknown stored language reads as English'));
  const records = {};
  const first = M.chooseLanguage(records, 'u1', 'hi', 0, at);
  check(() => assert.deepEqual(first, { ok: true, record: { language: 'hi', version: 1, at }, prior: 'en' }));
  records.u1 = first.record;
  check(() => assert.deepEqual(M.languageOf(records, 'u1'), { language: 'hi', version: 1 }));
  check(() => assert.deepEqual(M.languageOf(records, 'u2'), { language: 'en', version: 0 }, 'the choice is saved per member'));
  const other = M.chooseLanguage(records, 'u2', 'hi', 0, later);
  check(() => assert.equal(other.ok, true, 'a second member starts at version 0 whatever the first has'));
  records.u2 = other.record;
  const back = M.chooseLanguage(records, 'u1', 'en', 1, later);
  check(() => assert.deepEqual(back, { ok: true, record: { language: 'en', version: 2, at: later }, prior: 'hi' }));
  records.u1 = back.record;
  check(() => assert.deepEqual(M.languageOf(records, 'u2'), { language: 'hi', version: 1 }, "changing one member leaves another's choice alone"));
  check(() => assert.deepEqual(M.chooseLanguage(records, 'u1', 'hi', 1, at), { ok: false, status: 409, message: 'Your language in this organisation changed. Refresh and try again.' }, 'a stale version is refused'));
  check(() => assert.equal(M.chooseLanguage(records, 'u1', 'hi', 3, at).status, 409, 'a version ahead is refused too'));
  check(() => assert.deepEqual(M.chooseLanguage(records, 'u2', 'hi', 1, at), { ok: false, status: 422, message: 'This is already your language in this organisation.' }, 'choosing the current language is refused'));
  check(() => assert.equal(M.chooseLanguage({}, 'u9', 'en', 0, at).status, 422, 'English is already the default for a member with no record'));
  check(() => assert.deepEqual(Object.keys(first.record).sort(), ['at', 'language', 'version'], 'the record holds only the language, version and time'));
  const crowded = Object.fromEntries(Array.from({ length: M.MEMBER_LANGUAGE_LIMIT }, (_, i) => ['m' + i, { language: 'hi', version: 1, at }]));
  check(() => assert.equal(M.chooseLanguage(crowded, 'new-member', 'hi', 0, at).status, 422, 'the per-organisation record limit holds'));
  check(() => assert.equal(M.chooseLanguage(crowded, 'm5', 'en', 1, at).ok, true, 'an existing member can still change at the limit'));
  const result = { suite: 'Workspace message catalogue and language choice contract (slice 10j)', passed, catalogueKeys: keys.length, keysUsedByScreens: used.size, completedAt: new Date().toISOString() };
  writeFileSync('tests/i18n-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
