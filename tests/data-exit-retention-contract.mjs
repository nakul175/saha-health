// SAHA-130 focused regression: direct data-exit reads apply the current tombstone
// authority before archive scope/counts, staged planning and portable-basis hashing.
import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.data-exit-retention-contract-'));let passed=0;
const check=fn=>{fn();passed++;},rejects=async(fn,pattern)=>{await assert.rejects(fn,pattern);passed++;};
const at='2026-10-20T00:00:00.000Z',meta={policyVersion:1,triggerAt:at,purpose:'synthetic care evidence',location:'local test store',jurisdiction:'synthetic jurisdiction',disposedBy:'owner',disposedAt:at,reason:'Synthetic scheduled disposal'};
const tombstone=(recordClass,recordId,personId)=>({id:`t-${recordClass}-${recordId}`,recordClass,recordId,...(personId?{personId}:{}),...meta});
const retention=tombstones=>({org_id:'org',data:JSON.stringify({policies:[],holds:[],artifacts:[],tombstones})});
const person=id=>({org_id:'org',id,team_id:'care',assigned_to:'owner',data:JSON.stringify({id,name:`Synthetic ${id}`,teamId:'care',assignedTo:'owner',fieldLeases:[{id:'lease-dead'},{id:'cache-dead'},{id:'lease-live'}]})});

try{
 for(const name of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const source=readFileSync(join('lib/saha',name),'utf8'),js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,name.replace(/\.ts$/,'.js')),js);}
 writeFileSync(join(dir,'package.json'),'{'+'"type":"module"}');
 const exit=await import(pathToFileURL(join(dir,'data-exit.js')));
 const tombstones=[
  tombstone('patient-record','p-dead','p-dead'),tombstone('programme-receipt','sub-dead','p-live'),tombstone('model-output','ai-dead','p-live'),
  tombstone('raw-audio','audio-dead','p-live'),tombstone('transcript','transcript-dead','p-live'),tombstone('outreach-message','message-dead','p-live'),
  tombstone('rights-request','rights-dead','p-live'),tombstone('field-package','lease-dead','p-live'),tombstone('local-cache','cache-dead','p-live'),tombstone('backup','backup-dead')
 ];
 const data={
  retention:[retention(tombstones)],patients:[person('p-live'),person('p-dead')],
  visits:[{org_id:'org',id:'v-live',person_id:'p-live',data:JSON.stringify({id:'v-live',personId:'p-live',media:[{id:'audio-dead'},{id:'transcript-dead'},{id:'media-live'}]})},{org_id:'org',id:'v-dead',person_id:'p-dead',data:JSON.stringify({id:'v-dead',personId:'p-dead'})}],
  plans:[{id:'plan-live',visit_id:'v-live'},{id:'plan-dead',visit_id:'v-dead'}],ai_results:[{id:'ai-live',visit_id:'v-live'},{id:'ai-dead',visit_id:'v-live'},{id:'ai-child',visit_id:'v-dead'}],
  submissions:[{id:'sub-live',person_id:'p-live'},{id:'sub-dead',person_id:'p-live'},{id:'sub-child',person_id:'p-dead'}],referrals:[{id:'ref-live',person_id:'p-live'},{id:'ref-dead',person_id:'p-dead'}],record_revisions:[{id:'rev-live',person_id:'p-live'},{id:'rev-dead',person_id:'p-dead'}],
  media:[{id:'media-live',person_id:'p-live'},{id:'audio-dead',person_id:'p-live'},{id:'transcript-dead',person_id:'p-live'},{id:'media-child',person_id:'p-dead'}],rights_requests:[{id:'rights-live',person_id:'p-live'},{id:'rights-dead',person_id:'p-live'},{id:'rights-child',person_id:'p-dead'}],
  identity_cases:[{id:'identity-live',survivor_id:'p-live',duplicate_id:'p-other'},{id:'identity-dead',survivor_id:'p-live',duplicate_id:'p-dead'}],
  outreach:[{org_id:'org',data:JSON.stringify({messages:[{id:'message-live',personId:'p-live'},{id:'message-dead',personId:'p-live'},{id:'message-child',personId:'p-dead'}]})}],
  operations:[{org_id:'org',data:JSON.stringify({queue:[{id:'op-live',personId:'p-live'},{id:'op-dead',personId:'p-dead'}]})}],audit_events:[{id:'audit-retained',person_id:'p-dead',detail:'Immutable evidence remains'}]
 };
 const projection=exit.projectDataExitTombstones(data);
 check(()=>assert.deepEqual([...projection.disposedPeople],['p-dead']));
 check(()=>assert.deepEqual(data.patients.map(x=>x.id),['p-live']));
 check(()=>assert.deepEqual(data.visits.map(x=>x.id),['v-live']));
 check(()=>assert.deepEqual(data.plans.map(x=>x.id),['plan-live']));
 check(()=>assert.deepEqual(data.ai_results.map(x=>x.id),['ai-live']));
 check(()=>assert.deepEqual(data.submissions.map(x=>x.id),['sub-live']));
 check(()=>assert.deepEqual(data.media.map(x=>x.id),['media-live']));
 check(()=>assert.deepEqual(data.rights_requests.map(x=>x.id),['rights-live']));
 check(()=>assert.deepEqual(data.identity_cases.map(x=>x.id),['identity-live']));
 check(()=>assert.deepEqual(JSON.parse(data.patients[0].data).fieldLeases.map(x=>x.id),['lease-live']));
 check(()=>assert.deepEqual(JSON.parse(data.visits[0].data).media.map(x=>x.id),['media-live']));
 check(()=>assert.deepEqual(JSON.parse(data.outreach[0].data).messages.map(x=>x.id),['message-live']));
 check(()=>assert.deepEqual(JSON.parse(data.operations[0].data).queue.map(x=>x.id),['op-live']));
 check(()=>assert.equal(data.audit_events[0].detail,'Immutable evidence remains'));
 check(()=>assert.deepEqual(JSON.parse(data.retention[0].data).tombstones,tombstones,'portable authority remains exact'));
 check(()=>{const scoped=exit.scopedExitTombstones(tombstones,new Set(['p-live']));assert.ok(!scoped.some(x=>x.personId==='p-dead'),'out-of-scope tombstones are withheld');assert.ok(scoped.some(x=>x.recordClass==='backup'),'non-patient authority remains portable');});

 check(()=>assert.throws(()=>exit.projectDataExitTombstones({retention:[{data:'not json'}]}),/Retention authority is invalid/));
 check(()=>assert.throws(()=>exit.projectDataExitTombstones({retention:[retention([tombstone('backup','same'),tombstone('backup','same')])]}),/duplicate tombstones/));
 check(()=>assert.throws(()=>exit.projectDataExitTombstones({retention:[retention([tombstone('audit-event','audit-1')])]}),/Immutable audit events cannot be disposed/));

 const stored={patients:[person('p-live'),person('p-dead')],retention:[retention([tombstone('patient-record','p-dead','p-dead')])],organisations:[{id:'org',name:'Synthetic',revision:1,last_command:'x'}]};
 class Statement{constructor(sql,args=[]){this.sql=sql;this.args=args;}bind(...args){return new Statement(this.sql,args);}async all(){const table=/FROM ([a-z_]+)/.exec(this.sql)?.[1];let rows=structuredClone(stored[table]??[]);if(table==='patients'&&this.sql.includes('json_each')){const ids=new Set(JSON.parse(this.args[1]));rows=rows.filter(x=>ids.has(x.id));}return{results:rows};}}
 const db={prepare:sql=>new Statement(sql)};
 const member={userId:'owner',displayName:'Owner',accountCode:'A'.repeat(24),role:'clinician',isOwner:true,status:'active',version:1,teamIds:['care'],createdAt:at};
 const plan=await exit.dataExitStagePlan(db,'org',member,10);
 check(()=>assert.deepEqual({people:plan.people,patientIds:plan.patientIds},{people:1,patientIds:['p-live']}));
 const retentionBasis1=await exit.dataExitRetentionBasis(db,'org');stored.retention[0]=retention([tombstone('patient-record','p-dead','p-dead'),tombstone('raw-audio','newly-dead','p-live')]);const retentionBasis2=await exit.dataExitRetentionBasis(db,'org');check(()=>assert.notEqual(retentionBasis1,retentionBasis2,'a concurrent disposal changes the exact export authority basis'));
 const basis1=await exit.dataExitPortableBasis(db,'org');stored.patients[1]=person('p-dead');stored.patients[1].data=stored.patients[1].data.replace('Synthetic','Changed disposed');const basis2=await exit.dataExitPortableBasis(db,'org');
 check(()=>assert.equal(basis1,basis2,'disposed content cannot change a staged portable basis'));
 stored.patients[0].data=stored.patients[0].data.replace('Synthetic','Changed live');const basis3=await exit.dataExitPortableBasis(db,'org');
 check(()=>assert.notEqual(basis2,basis3,'live content still changes the staged portable basis'));
 await rejects(()=>exit.assertDataExitPatientScope(db,'org',member,['p-dead']),/Normal patient export scope changed/);
 await exit.assertDataExitPatientScope(db,'org',member,['p-live']);passed++;

 const source=readFileSync('lib/saha/data-exit.ts','utf8');
 check(()=>assert.ok(source.indexOf('projectDataExitTombstones(data)')<source.indexOf('const protectedAlertSubjects'),'projection precedes export scope, handover and FHIR'));
 check(()=>assert.match(source,/tombstones=scopedExitTombstones\(retentionProjection\.tombstones,people\)/));
 const server=readFileSync('lib/saha/data-exit-server.ts','utf8');check(()=>assert.equal((server.match(/dataExitRetentionBasis\(db\(\),/g)??[]).length,2,'all exports recheck exact retention authority before and after audit'));
 console.log(JSON.stringify({suite:'SAHA-130 data-exit retention contract',passed}));
}finally{rmSync(dir,{recursive:true,force:true});}
