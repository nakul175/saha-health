import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const temp=mkdtempSync(join(process.cwd(),'.retention-direct-read-'));let passed=0;const check=fn=>{fn();passed++;};
const at='2026-10-20T00:00:00.000Z',tombstone=(recordClass='raw-audio',recordId='media')=>({id:'t-'+recordId,recordClass,recordId,personId:'person',policyVersion:1,triggerAt:at,purpose:'synthetic care',location:'local store',jurisdiction:'synthetic jurisdiction',disposedBy:'owner',disposedAt:at,reason:'Synthetic scheduled disposal'});
try{
 for(const file of readdirSync('lib/saha').filter(file=>file.endsWith('.ts'))){const source=readFileSync(join('lib/saha',file),'utf8'),output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(temp,file.replace(/\.ts$/,'.js')),output);}writeFileSync(join(temp,'package.json'),'{"type":"module"}');
 const retention=await import(pathToFileURL(join(temp,'retention.js'))),store=readFileSync('lib/saha/store.ts','utf8'),media=readFileSync('lib/saha/media-server.ts','utf8');
 check(()=>assert.equal(retention.retentionTombstonesFromRaw(null).length,0));
 check(()=>assert.equal(retention.retentionTombstonesFromRaw(JSON.stringify({tombstones:[tombstone()]}))[0].recordId,'media'));
 check(()=>assert.throws(()=>retention.retentionTombstonesFromRaw('{'),e=>e.status===503));
 check(()=>assert.throws(()=>retention.retentionTombstonesFromRaw(JSON.stringify({tombstones:{}})),e=>e.status===503));
 check(()=>assert.throws(()=>retention.retentionTombstonesFromRaw(JSON.stringify({tombstones:[tombstone('audit-event','audit')]})),e=>e.status===503&&/audit events/.test(e.message)));
 check(()=>assert.throws(()=>retention.retentionTombstonesFromRaw(JSON.stringify({tombstones:[tombstone(),{...tombstone(),id:'other'}]})),e=>e.status===503&&/duplicate/.test(e.message)));
 check(()=>{const s={retention:{tombstones:[tombstone('audit-event','audit')]},workspace:{people:[],visits:[],submissions:[],referrals:[],audit:[{id:'audit'}]}};assert.throws(()=>retention.applyRetentionTombstones(s),e=>e.status===503);assert.equal(s.workspace.audit.length,1,'immutable audit remains untouched');});
 check(()=>assert.doesNotMatch(store,/AUDIT_TOMBSTONE_READ_FILTER|recordClass'\)='audit-event'/));
 check(()=>assert.equal((store.match(/retentionTombstonesFromRaw\(\(authority\.results\[0\]/g)??[]).length,2,'activity and snapshot reads validate authority without filtering audit rows'));
 check(()=>assert.match(media,/retentionTombstonesFromRaw\(raw\)/));
 check(()=>assert.match(media,/if\(row\)await assertMediaNotDisposed\(resolved,row\)/));
 check(()=>assert.match(media,/const fresh=await mediaRecord/));
 console.log(JSON.stringify({suite:'SAHA-130 retention direct-read contract',passed,failed:0}));
}finally{rmSync(temp,{recursive:true,force:true});}
