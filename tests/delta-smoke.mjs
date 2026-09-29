import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
// Slice 0b: partition deltas merged by the client must equal a freshly loaded full snapshot.
export async function deltaSmoke({get,post,check,accounts,org,base}){
 const dir=mkdtempSync(join(tmpdir(),'saha-delta-smoke-'));
 try{
  writeFileSync(join(dir,'delta.js'),ts.transpileModule(readFileSync('lib/saha/delta.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  const {mergeDelta}=await import(pathToFileURL(join(dir,'delta.js')));
  const {owner:o}=accounts;
  const full=async()=>{const r=await fetch(base+'/api/workspace',{headers:{...o.headers,'x-saha-organisation':org}});assert.equal(r.status,200);return r.json();};
  const send=async body=>{const r=await fetch(base+'/api/commands',{method:'POST',headers:{...o.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org,'x-saha-response':'delta'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;};
  const personId=(await post(o,{type:'createPerson',name:`Delta Synthetic ${crypto.randomUUID().slice(0,8)}`,age:41,sex:'Unknown',village:'Delta locality',programme:'Chronic care',teamId:'default'})).result.personId;
  // Each certified command answers with a partition delta whose merge equals the fresh full snapshot.
  const step=async body=>{const before=await full(),j=await send(body);check(()=>{assert.ok(j.delta,'expected a delta response');assert.equal(j.snapshot,undefined);assert.deepEqual(j.partition,[personId]);});check(()=>assert.ok(j.delta.people.every(p=>p.id===personId)));const after=await full();check(()=>assert.deepEqual(mergeDelta(before,j.delta,j.partition),after));return j;};
  const visitId=(await step({type:'startVisit',personId})).result.visitId;
  let visit=(await full()).visits.find(v=>v.id===visitId);
  await step({type:'saveVisit',visitId,version:visit.version,facts:{date:'2026-09-20T08:00',systolic:'128',diastolic:'82',weight:'70',temperature:'',weeks:'',coughDays:'',notes:'Delta synthetic note',source:'measured'}});
  let snap=await full();visit=snap.visits.find(v=>v.id===visitId);const person=snap.people.find(p=>p.id===personId);
  await step({type:'confirmVisit',visitId,version:visit.version,patientCheck:{personId,personVersion:person.version,confirmed:true}});
  await step({type:'createReferral',visitId,facility:'Synthetic referral facility',reason:'Delta synthetic referral'});
  snap=await full();
  await step({type:'setConsent',personId,purpose:'exchange',active:true,version:snap.people.find(p=>p.id===personId).version});
  const plan=await step({type:'preparePlan',visitId,recipients:['mis_community']});
  snap=await full();const hash=snap.visits.find(v=>v.id===visitId).plan.payloadHash;
  await step({type:'approvePlan',visitId,planId:plan.result.planId,payloadHash:hash});
  await step({type:'executePlan',visitId,planId:plan.result.planId});
  check(()=>assert.ok(snap.submissions!==undefined));
  // An uncertified command ignores the delta request and returns the full snapshot as before.
  const r=await fetch(base+'/api/commands',{method:'POST',headers:{...o.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org,'x-saha-response':'delta'},body:JSON.stringify({type:'createTeam',name:`Delta team ${crypto.randomUUID().slice(0,6)}`})});
  const j=await r.json();check(()=>{assert.equal(r.status,200);assert.ok(j.snapshot);assert.equal(j.delta,undefined);});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
