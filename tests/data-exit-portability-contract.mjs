import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {readTar,verifyFiles,verifyPortableDictionary} from '../scripts/verify-export.mjs';

const dir=mkdtempSync(join(process.cwd(),'.saha-exit-portability-'));let passed=0;
const check=fn=>{fn();passed++;},rejects=async(fn,match)=>{await assert.rejects(fn,match);passed++;};
class Statement{constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args;}bind(...args){return new Statement(this.db,this.sql,args);}exec(){const s=this.db.prepare(this.sql);if(/^\s*(SELECT|WITH)/i.test(this.sql))return{results:s.all(...this.args),meta:{changes:0}};const r=s.run(...this.args);return{results:[],meta:{changes:Number(r.changes)}};}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return{results:this.db.prepare(this.sql).all(...this.args)}}async run(){return this.exec();}}
class D1{constructor(){this.db=new DatabaseSync(':memory:');}prepare(sql){return new Statement(this.db,sql);}async batch(statements){this.db.exec('BEGIN');try{const out=statements.map(x=>x.exec());this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}}
const migrated=()=>{const db=new D1();for(const file of readdirSync('drizzle').filter(x=>/^\d{4}_.*\.sql$/.test(x)).sort())for(const statement of readFileSync(join('drizzle',file),'utf8').split('--> statement-breakpoint'))if(statement.trim())db.db.exec(statement);return db;};
try{
 for(const name of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const source=readFileSync(join('lib/saha',name),'utf8'),js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,name.replace(/\.ts$/,'.js')),js);}
 const exit=await import(pathToFileURL(join(dir,'data-exit.js')));
 const store=await import(pathToFileURL(join(dir,'store.js'))),seed=await import(pathToFileURL(join(dir,'seed.js')));
 const bytes=value=>new TextEncoder().encode(value);
 const sample=[{path:'tables/visits.jsonl',table:'visits',bytes:bytes(JSON.stringify({id:'v1',created_at:'2026-10-20T00:00:00.000Z',data:JSON.stringify({facts:{weight:52.4,systolic:118},version:2})})+'\n')}];
 const dictionary=exit.portableFieldDictionary(sample);
 check(()=>{assert.equal(dictionary.find(x=>x.path==='data.facts.weight').unit,'kg');assert.equal(dictionary.find(x=>x.path==='data.facts.systolic').unit,'mmHg');assert.equal(dictionary.find(x=>x.path==='created_at').unit,'ISO-8601 timestamp or date, as stored');assert.ok(dictionary.every(x=>x.provenance&&x.version===1));});
 const fieldFile={path:'schema/fields.json',bytes:bytes(JSON.stringify({format:'saha-portable-field-dictionary-v1',fields:dictionary}))};
 check(()=>assert.deepEqual(verifyPortableDictionary(new Map([...sample.map(x=>[x.path,Buffer.from(x.bytes)]),[fieldFile.path,Buffer.from(fieldFile.bytes)]])).failures,[]));
 check(()=>{const altered=JSON.parse(Buffer.from(fieldFile.bytes));altered.fields=altered.fields.filter(x=>x.path!=='data.facts.weight');const result=verifyPortableDictionary(new Map([[sample[0].path,Buffer.from(sample[0].bytes)],[fieldFile.path,Buffer.from(JSON.stringify(altered))]]));assert.equal(result.ok,false);assert.ok(result.failures.some(x=>x.includes('data.facts.weight')));});
 const dispositions=exit.providerDispositionRows([{id:'mis-1',name:'Synthetic MIS',kind:'mis',status:'active'},{id:'ehr-1',name:'Synthetic EHR',kind:'ehr',status:'suspended'}],[{kind:'external-action',system:'programme-mis',destination:'mis-1'},{kind:'external-action',system:'ehr'}]);
 check(()=>{assert.deepEqual(dispositions.map(x=>[x.connectionId,x.unresolvedActions,x.disposition]),[['mis-1',1,'retain-and-handover'],['ehr-1',1,'retain-and-handover']]);assert.ok(dispositions.every(x=>x.instruction.includes('never resend blindly')));});
 const patient=(id,team='a')=>({org_id:'org',id,team_id:team,assigned_to:'exit-lead',data:JSON.stringify({id,name:'Synthetic',age:40,sex:'Female',village:'Test',programmes:['General care'],task:'Review',due:'2026-10-22',status:'due',aiConsent:false,exchangeConsent:false,consentVersion:1,assigned:true,createdAt:'2026-10-20T00:00:00.000Z',version:1,teamId:team,assignedTo:'exit-lead'})});
 let generation=1;const rows={patients:[patient('p1'),patient('p2'),patient('p3')]};
 const db={prepare(sql){const table=/FROM ([a-z_]+)/.exec(sql)?.[1];return{bind(){return{all:async()=>({results:table==='patients'?rows.patients:table==='organisations'?[{id:'org',name:'Synthetic',revision:generation,last_command:'x'}]:[]})}}};}};
 const lead={userId:'exit-lead',displayName:'Exit lead',accountCode:'A'.repeat(24),role:'clinician',isOwner:true,status:'active',version:1,teamIds:['a'],createdAt:'2026-10-20T00:00:00.000Z'};
 const plan=await exit.dataExitStagePlan(db,'org',lead,2);
 check(()=>{assert.equal(plan.people,3);assert.equal(plan.total,2);assert.equal(plan.patientIds.length,3);assert.match(plan.basis,/^[a-f0-9]{64}$/);});
 await rejects(()=>exit.dataExitStagePlan(db,'org',{...lead,teamIds:['other']},2),/requires current normal authority over every person/);
 await rejects(()=>exit.dataExitStagePlan(db,'org',lead,5001),/Stage size/);
 const before=await exit.dataExitPortableBasis(db,'org');generation++;rows.patients[0]={...rows.patients[0],data:rows.patients[0].data.replace('Synthetic','Changed')};const after=await exit.dataExitPortableBasis(db,'org');
 check(()=>assert.notEqual(before,after,'a concurrent record change invalidates the staged basis'));
 const server=readFileSync('lib/saha/data-exit-server.ts','utf8'),source=readFileSync('lib/saha/data-exit.ts','utf8'),cli=readFileSync('scripts/reimport-export.mjs','utf8');
 check(()=>{assert.match(server,/basis!==plan\.basis/);assert.match(server,/dataExitPortableBasis\(db\(\),orgId\)!==stage\.basis/);assert.match(source,/full exit requires current normal authority over every person/);assert.match(cli,/Refusing to replace an existing validation database/);});
 // Real migrations and storage: build every part, verify each ordinary archive, and independently
 // reconstruct scoped fragments held inside a repeated organisation row.
 const d1=migrated(),now='2026-10-20T00:00:00.000Z',workspace=seed.seedWorkspace(now),realLead={...lead,teamIds:['default']};for(const p of workspace.people){p.teamId='default';p.assignedTo='exit-lead';}
 d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('exit-lead','A'.repeat(24),'Exit lead','exit@example.invalid',now);
 await store.createState(d1,{organisation:{id:'portable-org',name:'Portable synthetic organisation',revision:1,createdAt:now},teams:[{id:'default',name:'Default',createdAt:now}],members:[realLead],invitations:[],workspace},{userId:'exit-lead',displayName:'Exit lead',email:'exit@example.invalid'},'createOrganisation');
 const linked=workspace.people.map(p=>({personId:p.id,label:`portable-${p.id}`}));
 const existingOperations=d1.db.prepare("SELECT data FROM operations WHERE org_id='portable-org'").get(),operations=existingOperations?JSON.parse(existingOperations.data):{};operations.portableExitTest=linked;d1.db.prepare("INSERT INTO operations (org_id,data) VALUES ('portable-org',?) ON CONFLICT(org_id) DO UPDATE SET data=excluded.data").run(JSON.stringify(operations));
 const stageSize=Math.max(1,Math.ceil(workspace.people.length/2)),realPlan=await exit.dataExitStagePlan(d1,'portable-org',realLead,stageSize),built=[];
 for(let number=1;number<=realPlan.total;number++)built.push(await exit.buildExport(d1,{orgId:'portable-org',member:realLead,exporter:{userId:'exit-lead',name:'Exit lead',accountCode:'A'.repeat(24)},exportId:`portable-stage-${number}`,now,includeFhir:false,environment:'synthetic',fullScope:true,stage:{number,total:realPlan.total,size:stageSize,basis:realPlan.basis,patientIds:realPlan.patientIds.slice((number-1)*stageSize,number*stageSize)}}));
 const archivePaths=built.map((part,index)=>{const files=readTar(Buffer.from(part.archive)),report=verifyFiles(files),portable=verifyPortableDictionary(files);check(()=>{assert.equal(report.ok,true,JSON.stringify(report.failures));assert.equal(portable.ok,true,JSON.stringify(portable.failures));assert.equal(JSON.parse(files.get('manifest.json')).stage.number,index+1);assert.ok(files.has('handover/provider-disposition.jsonl'));assert.ok(files.has('schema/fields.json'));});const path=join(dir,`portable-${index+1}.tar`);writeFileSync(path,part.archive);return path;});
 const dbPath=join(dir,'validation.sqlite'),imported=JSON.parse(execFileSync('node',['scripts/reimport-export.mjs','--output',dbPath,...archivePaths],{encoding:'utf8'}));
 check(()=>{assert.equal(imported.ok,true);assert.equal(imported.archives,realPlan.total);assert.equal(imported.staged,true);assert.ok(imported.merged.operations>=1);const validation=new DatabaseSync(dbPath,{readOnly:true});assert.equal(validation.prepare("SELECT count(*) n FROM patients WHERE org_id='portable-org'").get().n,workspace.people.length);const restored=JSON.parse(validation.prepare("SELECT data FROM operations WHERE org_id='portable-org'").get().data).portableExitTest,byPerson=x=>[...x].sort((a,b)=>a.personId.localeCompare(b.personId));assert.deepEqual(byPerson(restored),byPerson(linked));assert.deepEqual(validation.prepare('PRAGMA foreign_key_check').all(),[]);validation.close();});
 console.log(JSON.stringify({suite:'SAHA-120 data exit portability contract',passed,coverage:['positive staged plan','full-scope authorization refusal','invalid input refusal','concurrent-source race invalidation','provider termination disposition','field units/provenance','dictionary tamper refusal','non-destructive re-import guard']}));
}finally{rmSync(dir,{recursive:true,force:true});}
