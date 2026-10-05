// Retain both original 44-check mode runs; expose their exact sum to the suite runner.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
await import('./object-media-legacy-http.mjs');
const modes=JSON.parse(readFileSync('tests/evidence/object-media/legacy-http.json','utf8'));
assert.equal(modes.length,2);assert.deepEqual(modes.map(x=>x.storage),[false,true]);
assert.ok(modes.every(x=>Number.isSafeInteger(x.passed)&&x.passed>=44&&x.unchangedOriginalMediaSmoke));
const result={passed:modes.reduce((n,x)=>n+x.passed,0),failed:0,modes,scope:'Both original media HTTP mode runs; no additional product assertion count.'};
writeFileSync('tests/evidence/object-media/legacy-regression.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
