import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import LinkedReporter from '../playwright-reporter.mjs';
const dir = mkdtempSync(join(tmpdir(), 'saha-reporter-contract-'));
try {
  const meta = join(dir,'metadata.json'), output = join(dir,'result.json');
  writeFileSync(meta,JSON.stringify({runId:'unit-retry-boundary',codeSha:'a'.repeat(40),environment:'synthetic reporter contract'}));
  const reporter = new LinkedReporter({metadata:meta,output}); reporter.onBegin();
  const test = {id:'one-case',titlePath:()=>['synthetic retry'],annotations:[{type:'scenario',description:'SCN-TC-BR-UX-01-A'}],expectedStatus:'passed'};
  reporter.onTestEnd(test,{retry:0,startTime:new Date(),duration:1,status:'failed',errors:[{message:'deliberate first-attempt failure'}],attachments:[]});
  reporter.onTestEnd(test,{retry:1,startTime:new Date(),duration:1,status:'passed',errors:[],attachments:[]});
  assert.equal(reporter.onEnd({status:'passed'}).status,'failed');
  const r=JSON.parse(readFileSync(output));
  assert.equal(r.result,'flaky');
  assert.equal(r.attempts.length,2);
  assert.equal(r.attempts[0].errors[0].message,'deliberate first-attempt failure');
  assert.throws(()=>reporter.onEnd({status:'passed'}),/EEXIST/);
  console.log('5 reporter boundary checks passed; retry failure retained, no green promotion or evidence overwrite');
} finally { rmSync(dir,{recursive:true,force:true}); }
