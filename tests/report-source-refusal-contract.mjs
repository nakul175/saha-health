// Additive port-free NFR fixture-policy controls; no Worker or production edit.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { reportSourceRefusal, REPORT_SOURCE_CHANGED, REPORT_SOURCE_RETRIES } from './lib/report-source-refusal.mjs';

let passed = 0;
const check = fn => { fn(); passed++; };
const response = changes => ({ status: 409, headers: new Headers({ 'cache-control': 'no-store' }),
  json: { error: REPORT_SOURCE_CHANGED }, text: JSON.stringify({ error: REPORT_SOURCE_CHANGED }), ...changes });
check(() => { assert.equal(REPORT_SOURCE_RETRIES, 4); assert.equal(reportSourceRefusal(response(), '/api/operations'), true); });
check(() => { for (const status of [200, 400, 401, 403, 404, 422, 500, 503]) assert.equal(reportSourceRefusal(response({status}), '/api/operations'), false); });
check(() => { for (const path of ['/api/commands', '/api/aggregate-reports', '/api/routine-visit', '/api/operations?format=csv', '/api/operations?days=30']) assert.equal(reportSourceRefusal(response(), path), false); });
check(() => { for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']) assert.equal(reportSourceRefusal(response(), '/api/operations', method), false); });
check(() => { for (const text of ['Conflict', REPORT_SOURCE_CHANGED + ' extra', 'Operations authority changed. Refresh.', 'Current reporting purpose was revoked.']) assert.equal(reportSourceRefusal(response({json:{error:text},text:JSON.stringify({error:text})}), '/api/operations'), false); });
check(() => { for (const headers of [new Headers(), new Headers({'cache-control':'public'}), new Headers({'cache-control':'max-age=60'})]) assert.equal(reportSourceRefusal(response({headers}), '/api/operations'), false); });
check(() => { for (const key of ['people','patients','report','personId','visit','organisationId']) { const body={error:REPORT_SOURCE_CHANGED,[key]:'Synthetic protected value'}; assert.equal(reportSourceRefusal(response({json:body,text:JSON.stringify(body)}), '/api/operations'), false); } });
check(() => { for (const text of ['', '<html>Conflict</html>', JSON.stringify({error:REPORT_SOURCE_CHANGED})+' secret', JSON.stringify({error:REPORT_SOURCE_CHANGED,report:{count:2}})]) assert.equal(reportSourceRefusal(response({text}), '/api/operations'), false); });
check(() => { for (const text of ['{"error":"Synthetic protected value","error":'+JSON.stringify(REPORT_SOURCE_CHANGED)+'}', ' '+JSON.stringify({error:REPORT_SOURCE_CHANGED})]) assert.equal(reportSourceRefusal(response({text}), '/api/operations'), false); });
check(() => { for (const json of [null,[],false,REPORT_SOURCE_CHANGED,{error:'Another conflict'}]) assert.equal(reportSourceRefusal(response({json}), '/api/operations'), false); });
check(() => { assert.equal(reportSourceRefusal(null, '/api/operations'), false); assert.equal(reportSourceRefusal(response({json:{error:REPORT_SOURCE_CHANGED},text:JSON.stringify({error:'Another conflict'})}), '/api/operations'), false); });
const result={suite:'report-source-refusal-contract',passed,failed:0,completedAt:new Date().toISOString(),limits:['Pure fixture-response classification; no native reporting-source-drift or workload liveness qualification.']};
writeFileSync(process.env.SAHA_REPORT_SOURCE_RESULT ?? 'tests/report-source-refusal-contract-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
