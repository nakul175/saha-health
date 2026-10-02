// Slice 6l (BR-SEC-07) static contract: every console call in server and client code is on a
// reviewed list, the request log line has fixed fields only, and Saha's own clients keep free
// text (reasons, questions, names, notes, villages) out of request URLs, where hosting platforms
// record them in request logs. A new console call or free-text URL parameter fails this suite
// until it is reviewed and added here.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, globSync } from 'node:fs';
let passed = 0;
const check = fn => { fn(); passed++; };
const files = [...globSync('lib/**/*.ts'), ...globSync('app/**/*.{ts,tsx}'), ...globSync('public/field/*.js')].sort();
const reviewed = [
  "lib/saha/monitoring.ts: console.error('Saha request metrics unavailable')",
  "lib/saha/monitoring.ts: console.log(JSON.stringify({event:'saha_request',requestId,route,status:response.status,durationMs:elapsed}))",
  "lib/saha/server.ts: console.error('Workspace operation failed',e instanceof Error?e.name:'unknown')",
  // Slice 6t: an audit store failure on a read or export logs only the status or error class, never the event or content.
  "lib/saha/access-audit.ts: console.error('Access audit not recorded', e instanceof AppError ? e.status : e instanceof Error ? e.name : 'unknown')",
  "lib/saha/alert-delivery-server.ts: console.error('Alert delivery evaluation failed', e instanceof Error ? e.name : 'unknown')",
  "lib/saha/alert-delivery-server.ts: console.error('Alert delivery evaluation failed', e instanceof Error ? e.name : 'unknown')",
  "lib/saha/caseload-schedule.ts: console.error('Scheduled caseload application failed', e instanceof Error ? e.name : 'unknown')",
  "lib/saha/export-audit.ts: console.error('Export audit not recorded', e instanceof Error ? e.name : 'unknown')",
  // Development builds only (guarded by import.meta.env.DEV); a production build never prints the error object.
  'lib/saha/server.ts: console.error(e)',
];
const calls = [];
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/console\.(log|error|warn|info|debug|trace|dir)\(/g)) {
    let depth = 0, end = m.index;
    for (let i = m.index; i < text.length; i++) { if (text[i] === '(') depth++; else if (text[i] === ')' && --depth === 0) { end = i + 1; break; } }
    calls.push(`${f}: ${text.slice(m.index, end)}`);
  }
}
check(() => assert.deepEqual(calls.sort(), [...reviewed].sort(), 'every console call is reviewed'));
check(() => assert.match(readFileSync('lib/saha/server.ts', 'utf8'), /if\(import\.meta\.env\.DEV\)console\.error\(e\)/, 'the full error object is printed in development only'));
check(() => { const line = /console\.log\(JSON\.stringify\(\{([^}]*)\}\)\)/.exec(readFileSync('lib/saha/monitoring.ts', 'utf8'))[1]; assert.deepEqual(line.split(',').map(x => x.split(':')[0]), ['event', 'requestId', 'route', 'status', 'durationMs']); });
check(() => assert.match(readFileSync('lib/saha/monitoring.ts', 'utf8'), /INSERT INTO request_metrics \(org_id,bucket,route,status,count,total_ms,max_ms\)/, 'request metrics store fixed columns only'));
// Free-text parameters in client request URLs.
const clientFiles = files.filter(f => f.startsWith('app/') || f.startsWith('public/'));
const freeText = /\/api\/[^'"`\s]*[?&](reason|question|village|name|notes|detail|input|narrative|text|summary|title|comment)=/;
// The detector flags the pre-6l media removal URL.
check(() => assert.ok(freeText.test("send(`/api/media/${m.id}?reason=${encodeURIComponent(reason.trim())}`,{method:'DELETE'})")));
const found = clientFiles.flatMap(f => readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l]).filter(([, , l]) => freeText.test(l)).map(([f, n]) => `${f}:${n}`));
check(() => assert.deepEqual(found, [], 'no free text in client request URLs'));
check(() => { const panel = readFileSync('app/indicators-panel.tsx', 'utf8'); assert.ok(panel.includes("fetch('/api/indicators',{method:'POST'")); assert.ok(!panel.includes('/api/indicators?')); });
check(() => { const panel = readFileSync('app/media-panel.tsx', 'utf8'); assert.ok(panel.includes("body:JSON.stringify({reason:reason.trim()})")); assert.ok(!panel.includes('?reason=')); });
// Slice 6q (second independent review): the 6l detector missed query strings built with URLSearchParams and the
// patient-directory cursor that carried a patient name. Free-text keys set on URLSearchParams, `q=` search
// parameters in client URLs, and a name-bearing cursor are now flagged.
const builtText = /(\.(set|append)\(\s*['"](q|search|query|reason|question|village|name|notes|detail|input|narrative|text|summary|title|comment)['"])|\/api\/[^'"`\s]*[?&](q|search|query)=/;
check(() => assert.ok(builtText.test("const u=new URLSearchParams();if(query.trim())u.set('q',query.trim());if(after)u.set('cursor',after);const r=await fetch(`/api/patients?${u}`")));
const built = clientFiles.flatMap(f => readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l]).filter(([, , l]) => builtText.test(l)).map(([f, n]) => `${f}:${n}`));
check(() => assert.deepEqual(built, [], 'no search or free text set on client URL parameters'));
check(() => { const panel = readFileSync('app/patient-directory-panel.tsx', 'utf8'); assert.ok(panel.includes("fetch('/api/patients',{method:'POST'")); assert.ok(!panel.includes('/api/patients?')); });
check(() => { const lib = readFileSync('lib/saha/patient-directory.ts', 'utf8'); assert.ok(lib.includes('nextCursor: last ? `after:${last.id}` : null')); assert.ok(!/JSON\.stringify\(\[last\.name/.test(lib), 'the cursor carries no patient name'); });
const result = { suite: 'safe logs contract (slice 6l)', passed, consoleCalls: calls.length, filesScanned: files.length, completedAt: new Date().toISOString() };
writeFileSync('tests/safe-logs-contract-result.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
