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
const result = { suite: 'safe logs contract (slice 6l)', passed, consoleCalls: calls.length, filesScanned: files.length, completedAt: new Date().toISOString() };
writeFileSync('tests/safe-logs-contract-result.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
