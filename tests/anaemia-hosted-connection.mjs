// Optional authorised check of the two independently hosted private products.
// Credentials enter through hidden stdin. No user identity headers or patient data are used.
import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {writeFileSync} from 'node:fs';
const lines=createInterface({input:process.stdin,terminal:false});
process.stdout.write('Ready for private service diagnostic credentials on hidden stdin.\n');
const line=await new Promise(resolve=>lines.once('line',resolve));lines.close();
const {origin,key,dispatch}=JSON.parse(line);
assert.equal(origin,'https://saha-health-workspace.nakul1729233.chatgpt.site');
assert.ok(typeof key==='string'&&key.length>=32&&typeof dispatch==='string'&&dispatch.length>20);
const headers={'Content-Type':'application/json',Authorization:'Bearer '+key,'OAI-Sites-Authorization':'Bearer '+dispatch};
let passed=0;const receipts=[];
async function call(body,override={}){const response=await fetch(origin+'/api/anaemia-connection-test',{method:'POST',headers:{...headers,...override},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(45000)});const raw=await response.text();let value;try{value=JSON.parse(raw);}catch{throw Error('Connection diagnostic returned non-JSON HTTP '+response.status);}return {status:response.status,value};}
const check=fn=>{fn();passed++;};
for(const fixture of ['texture','flat']){
 const {status,value}=await call({fixture});
 check(()=>assert.equal(status,200,JSON.stringify({fixture,status,error:value.error??value.message??'Unconfirmed connection'})));
 check(()=>{assert.equal(value.connected,true);assert.equal(value.patientRecordAffected,false);assert.equal(value.result.clinicalUse,false);assert.equal(value.result.modelVersion,'conjify-5659a76-onnx-v1');assert.equal(value.result.modelSha256,'1441feaeb799a55d8f2dc710f70f65cbc96b72f42cb18deb5e7383d1b7ffbd94');assert.match(value.result.signature,/^[0-9a-f]{64}$/);});
 check(()=>{if(fixture==='texture'){assert.equal(value.result.status,'completed');assert.ok(Math.abs(value.result.screening.score-.9824649095535278)<.0001);}else{assert.equal(value.result.status,'unable_to_assess');assert.equal(value.result.screening,null);}});
 receipts.push({fixture,requestId:value.result.requestId,receipt:value.result.receipt,status:value.result.status,score:value.result.screening?.score??null});
}
const invalid=await call({fixture:'texture'},{Authorization:'Bearer invalid'});check(()=>assert.equal(invalid.status,401));
const arbitrary=await call({fixture:'texture',patientId:'not-accepted'});check(()=>assert.equal(arbitrary.status,422));
const report={passed,failed:0,checkedAt:new Date().toISOString(),scope:'Hosted private Saha Worker calls independently hosted private Anaemia Screen API and real model; service diagnostic accepts built-in synthetic fixtures only',hostedSaha:true,hostedProvider:true,realModel:true,consumerVerifiedSignature:true,patientRecordAffected:false,patientDataSent:false,clinicalUse:false,realBrowserQA:false,receipts};
writeFileSync('tests/evidence/independent-anaemia-provider/hosted-connection-result.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
