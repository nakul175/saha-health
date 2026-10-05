// Slice 11e: shared data access for the UAT pack generator, the register validator and the coverage map.
// Reads the original catalogue, the assessment and the evidence map; never writes them. Pure functions, no clock, no network.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
export const abs = p => isAbsolute(p) ? p : join(ROOT, p);
export const read = p => readFileSync(abs(p), 'utf8');

// ---------------------------------------------------------------- CSV (RFC 4180: quotes, doubled quotes, newlines in fields)
export function parseCsv(text) {
  const rows = []; let row = [], field = '', inQuotes = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; rows.push(row); row = []; }
    else field += c;
  }
  if (inQuotes) throw new Error('CSV ends inside a quoted field');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}
export function readCsv(path) {
  const [header, ...body] = parseCsv(read(path));
  return { header, rows: body.map((r, n) => {
    if (r.length !== header.length) throw new Error(`${path} row ${n + 2}: ${r.length} fields, expected ${header.length}`);
    return Object.fromEntries(header.map((h, i) => [h, r[i]]));
  }) };
}
const quoteCsv = v => { v = String(v ?? ''); return /[",\r\n]/.test(v) ? '"' + v.replaceAll('"', '""') + '"' : v; };
export const toCsv = (header, rows) => header.join(',') + '\n' + rows.map(r => header.map(h => quoteCsv(r[h])).join(',')).join('\n') + (rows.length ? '\n' : '');

// ---------------------------------------------------------------- inputs
export function loadCatalogue() {
  const { rows } = readCsv('docs/current/TEST-CATALOGUE.csv');
  return rows.map(r => ({ ...r, reqIds: r.source.split(/\s+/).filter(Boolean), area: areaOf(r.source.split(/\s+/)[0]) }));
}
export function loadAssessment() {
  const lines = read('requirements/assessment.tsv').trimEnd().split('\n'), headers = lines.shift().split('\t');
  const map = new Map();
  for (const l of lines) {
    const cells = l.split('\t');
    if (cells.length !== headers.length) throw new Error(`assessment.tsv: ${cells.length} fields in "${l.slice(0, 40)}"`);
    const o = Object.fromEntries(headers.map((h, i) => [h, cells[i]])); map.set(o.id, o);
  }
  return map;
}
export const loadRequirements = () => JSON.parse(read('requirements/brd-v1.1.json')).requirements;
export const loadEvidenceMap = () => JSON.parse(read('requirements/evidence-map.json'));
export const areaOf = id => id.startsWith('NFR-') ? 'NFR' : id.split('-').slice(0, 2).join('-');
// Same lookup rule as scripts/audit-requirements.mjs: the requirement's own entry wins; otherwise its area entry (NFR ids are always their own key).
export function evidenceFor(id, map) {
  const key = id.startsWith('NFR-') ? id : id.split('-').slice(0, 2).join('-');
  if (map[id]) return { paths: map[id], key: id, own: true };
  if (map[key]) return { paths: map[key], key, own: false };
  throw new Error(`Evidence context missing for ${id}`);
}

// ---------------------------------------------------------------- test layers
export const LAYERS = ['unit', 'integration', 'resilience', 'smoke', 'ui', 'nfr'];
export const LAYER_NAME = { unit: 'unit', integration: 'integration', resilience: 'resilience', smoke: 'smoke', ui: 'ui', nfr: 'nfr' };
// Named files whose layer the filename rules would get wrong, and files that are not suites at all (null).
export const LAYER_OVERRIDES = {
  'tests/app-first-ui.cjs': ['unit', 'rendered app navigation policy and status checks'],
  'tests/app-first-browser.mjs': ['ui', 'actual Chromium app-first journey'],
  'tests/app-offline-review-browser.mjs': ['integration', 'independent Chromium/Worker/D1 cache, encrypted reload and receipt replay review'],
  'tests/app-offline-scope-browser.mjs': ['integration', 'actual assignment/membership withdrawal and login-redirect denial'],
  'tests/touch-units-browser.mjs': ['integration', 'actual Chromium/Worker/D1 six-unit capture, encrypted reload and draft sync'],
  'tests/app-offline-browser.mjs': ['integration', 'actual Chromium/Worker/D1 offline prepared-visit journey'],
  'tests/reconciliation-http.mjs': ['integration', 'isolated Worker and D1 reconciliation routes'],
  'tests/reminder-optout-http.mjs': ['integration', 'isolated Worker and D1 opt-out routes plus browser journey'],
  'tests/import-unit-parity-browser.mjs': ['integration', 'actual six-unit CSV import and immutable phone history'],
  'tests/offline-programme-browser.mjs': ['integration', 'actual prepared guidance and encrypted phone capture with current scope'],
  'tests/device-work-purge-failure-browser.mjs': ['integration', 'independent actual IndexedDB abort after known withdrawal'],
  'tests/work-burden-http.mjs': ['integration', 'actual opt-in counts, membership guards and atomic receipt/audit faults'],
  'tests/work-burden-browser.mjs': ['integration', 'actual phone active-capture samples and metadata retry'],
  'tests/device-work-browser.mjs': ['integration', 'real built Worker, D1 and encrypted IndexedDB prepared-copy cleanup'],
  'tests/command-authority-http.mjs': ['integration', 'actual command actor authority and delegation chain evidence'],
  'tests/delta-read-audit-http.mjs': ['integration', 'actual command partition audit atomicity and durable receipt replay'],
  'tests/range-first-tap-browser.mjs': ['integration', 'actual first touch/mouse/keyboard Save activation with no preparatory focus'],
  'tests/range-protocol-browser.mjs': ['integration', 'governed contextual capture with actual Chromium/Worker/D1'],
  'tests/auxiliary-read-http.mjs': ['integration', 'actual built Worker/D1 fail-closed auxiliary patient views'],
  'tests/workspace-metadata-smoke.mjs': ['integration', 'actual Worker/D1 metadata response audit and metrics'],
  'tests/service-identity-management.mjs': ['integration', 'isolated Worker/D1 and Chromium service management'],
  'tests/reconciliation-ui.mjs': ['smoke', 'delayed scope and preview browser regressions'],
  'tests/reminder-optout-refresh-browser.mjs': ['smoke', 'organisation switching and concurrent opt-out browser regressions'],
  'tests/recovery-drill.mjs': ['resilience', 'encrypted restore drill'],
  'tests/a11y-audit.mjs': ['ui', 'browser accessibility audit, run outside CI'],
  'tests/load-envelope.mjs': ['nfr', 'load envelope measurement'],
  'tests/adapter-overhead-bench.mjs': ['nfr', 'adapter overhead benchmark'],
  'tests/scheduled-local-check.mjs': ['integration', 'serves the built Worker and calls its scheduled handler'],
  'tests/run-api-smoke.mjs': [null, 'runner for tests/api-smoke.mjs, not a suite'],
  'tests/database-fixtures.mjs': [null, 'fixture helper, not a suite'],
};
/** Layer of a cited path, or null when the path is not a test file (documents, source, evidence JSON, helpers, runners). */
export function layerOf(p) {
  if (LAYER_OVERRIDES[p]) return LAYER_OVERRIDES[p][0];
  if (!/^tests\/.+\.(mjs|js)$/.test(p)) return null;
  if (/^tests\/(lib|uat|reports|evidence)\//.test(p)) return null;
  for (const d of ['smoke', 'ui', 'nfr']) if (p.startsWith(`tests/${d}/`)) return d;
  if (/^tests\/[^/]+-smoke\.mjs$/.test(p)) return 'integration';
  if (/^tests\/[^/]+\.mjs$/.test(p)) return 'unit';
  return null;
}
/** Every test file on disk that layerOf classifies (tests/*.mjs and the tests/smoke, tests/ui and tests/nfr trees when present), sorted. */
export function testFilesOnDisk() {
  const out = [];
  const walk = dir => { for (const e of readdirSync(abs(dir)).sort()) { const p = `${dir}/${e}`; if (statSync(abs(p)).isDirectory()) walk(p); else if (layerOf(p)) out.push(p); } };
  for (const e of readdirSync(abs('tests')).sort()) {
    const p = `tests/${e}`;
    if (statSync(abs(p)).isDirectory()) { if (['smoke', 'ui', 'nfr'].includes(e)) walk(p); } else if (layerOf(p)) out.push(p);
  }
  return out.sort();
}
export const exists = p => existsSync(abs(p));

// ---------------------------------------------------------------- UAT register
export const REGISTER_COLUMNS = ['caseId', 'build', 'environment', 'executor', 'executedAt', 'result', 'actualResult', 'evidence', 'defect', 'reviewer', 'reviewedAt'];
export const RESULTS = ['Pass', 'Fail', 'Blocked', 'Not run'];
export const REGISTER_PATH = 'docs/testing/uat/uat-results.csv';
const clean = v => String(v ?? '').trim();
const PLACEHOLDER = /^(tbd|tba|n\/?a|na|none|nil|null|unknown|todo|pending|name|user|tester|qa|test|-+|\?+|x+)$/i;
const NOT_A_PERSON = /\b(claude|chatgpt|gpt|gemini|copilot|llm|bot|agent|automation|automated|script|ci|pipeline)\b/i;
export const isNamedPerson = v => { v = clean(v); return v.length >= 2 && /[A-Za-zऀ-ॿ]{2}/.test(v) && !PLACEHOLDER.test(v) && !NOT_A_PERSON.test(v); };
const sameName = (a, b) => clean(a).toLowerCase().replace(/\s+/g, ' ') === clean(b).toLowerCase().replace(/\s+/g, ' ');
const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;
const isDate = v => DATE.test(clean(v)) && !Number.isNaN(Date.parse(clean(v)));
const isBuild = v => /^[0-9a-f]{7,40}$/i.test(clean(v));
const meaningful = v => clean(v).length > 0 && !PLACEHOLDER.test(clean(v));

/**
 * Validate register rows. Returns a list of { line, caseId, field, rule, message }; empty means valid.
 * rows: objects with REGISTER_COLUMNS keys, in file order (line = index + 2, the header being line 1).
 * catalogueIds: Set of every id in the 364-case catalogue. requiredIds: ids that must each have a row (the cases in the UAT scripts).
 * Rules: caseId-unknown, caseId-empty, caseId-duplicate, row-missing, result-value, empty-with-data, not-run-fields, pass-fields, fail-fields,
 * blocked-fields, reviewer-same, reviewer-invalid, dates.
 */
export function validateRegister(rows, { catalogueIds, requiredIds = [] }) {
  const errors = [], seen = new Map();
  rows.forEach((row, i) => {
    const id = clean(row.caseId), result = clean(row.result);
    const add = (field, rule, message) => errors.push({ line: i + 2, caseId: id, field, rule, message });
    if (!id) return add('caseId', 'caseId-empty', 'caseId is empty');
    if (!catalogueIds.has(id)) add('caseId', 'caseId-unknown', `${id} is not a case in docs/current/TEST-CATALOGUE.csv`);
    if (seen.has(id)) add('caseId', 'caseId-duplicate', `${id} appears twice (first on line ${seen.get(id)})`); else seen.set(id, i + 2);
    const need = (rule, field, ok, what) => { if (!ok(row[field])) add(field, rule, `${result} needs ${field} (${what})`); };
    if (result === '') {
      for (const f of REGISTER_COLUMNS.slice(1)) if (f !== 'result' && clean(row[f])) add(f, 'empty-with-data', `${f} is filled but result is empty; record a result or clear the row`);
      return;
    }
    if (!RESULTS.includes(result)) return add('result', 'result-value', `"${result}" is not allowed; use exactly one of: ${RESULTS.join(', ')} (or leave empty)`);
    if (result === 'Not run') {
      for (const f of ['executor', 'executedAt', 'evidence', 'defect', 'reviewer', 'reviewedAt']) if (clean(row[f])) add(f, 'not-run-fields', `a Not run row cannot carry ${f}`);
      return;
    }
    // Pass, Fail and Blocked are all statements made by a named person at a time.
    const base = result === 'Pass' ? 'pass-fields' : result === 'Fail' ? 'fail-fields' : 'blocked-fields';
    need(base, 'executor', isNamedPerson, 'a named person, not a placeholder, role or tool');
    need(base, 'executedAt', isDate, 'ISO date or date-time, e.g. 2026-10-12 or 2026-10-12T09:30:00Z');
    need(base, 'actualResult', meaningful, result === 'Blocked' ? 'the reason it was blocked' : 'what was observed');
    if (result === 'Pass' || result === 'Fail') {
      need(base, 'build', isBuild, 'the 7 to 40 character commit hash that was deployed');
      need(base, 'environment', meaningful, 'for example hosted synthetic staging');
    }
    if (result === 'Pass') {
      need(base, 'evidence', meaningful, 'URI or path of the screenshot or export, ideally with its SHA-256');
      need(base, 'reviewer', isNamedPerson, 'a second named person');
      need(base, 'reviewedAt', isDate, 'ISO date or date-time');
    }
    if (result === 'Fail') need(base, 'defect', meaningful, 'the defect id or issue link');
    if (clean(row.reviewer) && clean(row.executor) && sameName(row.reviewer, row.executor)) add('reviewer', 'reviewer-same', 'the reviewer must be a different person from the executor');
    if (clean(row.reviewer) && !isNamedPerson(row.reviewer)) add('reviewer', 'reviewer-invalid', 'the reviewer must be a named person');
    if (clean(row.reviewedAt) && !isDate(row.reviewedAt)) add('reviewedAt', 'dates', 'reviewedAt is not an ISO date');
    if (isDate(row.executedAt) && isDate(row.reviewedAt) && Date.parse(row.reviewedAt) < Date.parse(row.executedAt)) add('reviewedAt', 'dates', 'the review cannot be earlier than the execution');
  });
  for (const id of requiredIds) if (!seen.has(id)) errors.push({ line: 0, caseId: id, field: 'caseId', rule: 'row-missing', message: `${id} is in the UAT scripts but has no row in the register` });
  return errors;
}
/** A case counts as formally executed when its register row is a Pass or Fail with a named executor and a different named reviewer (strategy 07). */
export function isFormal(row) {
  const r = clean(row.result);
  return (r === 'Pass' || r === 'Fail') && isNamedPerson(row.executor) && isNamedPerson(row.reviewer) && !sameName(row.executor, row.reviewer) && isDate(row.executedAt) && isDate(row.reviewedAt) && isBuild(row.build) && meaningful(row.actualResult) && (r === 'Pass' ? meaningful(row.evidence) : meaningful(row.defect));
}
export function loadRegister(path = REGISTER_PATH) {
  if (!exists(path)) return null;
  const { header, rows } = readCsv(path);
  return { header, rows };
}
export const rel = p => relative(ROOT, p);
