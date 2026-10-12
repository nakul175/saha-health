// Real owned native workerd HTTP/console control. No app database or clinical requests.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startInline} from './lib/native-observed-runtime-v2.mjs';
let passed=0;const check=(condition,label)=>{assert.ok(condition,label);passed++;};
const marker='SYNTHETIC_NATIVE_LOG_'+crypto.randomUUID();let worker;
try {
 worker=await startInline({port:19943,captureRuntimeOutput:true,script:`let calls=0;export default {fetch(request){calls++;console.log('${marker}:info');console.warn('${marker}:warn');console.error('Workspace operation failed ${marker}:error');if(new URL(request.url).pathname==='/throw')throw Error('${marker}:thrown');return Response.json({calls});}};`});
 check(typeof worker.output==='function','Explicit capture exposes actual transcript reader');
 check(!worker.output().includes(marker),'Fresh runtime transcript contains no invented control message');
 let response=await fetch(worker.base+'/emit');check(response.status===200,'Actual native HTTP returns200');check((await response.json()).calls===1,'Exactly one native request, no replay');
 for(let n=0;n<100&&!worker.output().includes(marker+':error');n++)await new Promise(resolve=>setTimeout(resolve,10));
 const transcript=worker.output();check(transcript.includes(marker+':info'),'Actual Worker info captured');check(transcript.includes(marker+':warn'),'Actual Worker warning captured');check(transcript.includes(marker+':error'),'Actual Worker error captured');check(/\[(stdout|stderr)\]/.test(transcript),'Raw runtime stream captured');check(transcript.includes('[console:'),'Actual structured console captured');check(/Workspace operation failed/i.test(transcript),'Original load error oracle recognizes genuine captured error');
 response=await fetch(worker.base+'/throw');check(response.status===500,'Actual thrown Worker error returns500 without retry');await response.arrayBuffer();
 for(let n=0;n<100&&!worker.output().includes(marker+':thrown');n++)await new Promise(resolve=>setTimeout(resolve,10));check(worker.output().includes(marker+':thrown'),'Actual thrown runtime error retained');
 mkdirSync('tests/reports/native-runtime-log-control-v2',{recursive:true});writeFileSync('tests/reports/native-runtime-log-control-v2/result.json',JSON.stringify({passed,failed:0,scope:'Real synthetic inline native Worker HTTP+raw/structured console. Deliberate control errors occur in owned isolated runtime, not app load; no invented transcript or clinical request retry.'},null,2));writeFileSync('tests/reports/native-runtime-log-control-v2/actual-runtime-output.txt',worker.output());console.log(JSON.stringify({passed,failed:0}));
} catch(error) {mkdirSync('tests/reports/native-runtime-log-control-v2',{recursive:true});writeFileSync('tests/reports/native-runtime-log-control-v2/failure.json',JSON.stringify({passed,failed:1,error:String(error)},null,2));throw error;} finally {if(worker){mkdirSync('tests/reports/native-runtime-log-control-v2',{recursive:true});writeFileSync('tests/reports/native-runtime-log-control-v2/actual-runtime-output.txt',worker.output());}await worker?.stop();}
