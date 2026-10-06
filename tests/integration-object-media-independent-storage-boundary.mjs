// Independent production-handler checkpoints with actual native local D1/R2.
// Trusted context and Miniflare body-stream adapter are explicitly injected.
import assert from 'node:assert/strict';import ts from 'typescript';
import {readFileSync,writeFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {objectMediaWorker} from './lib/object-media-worker.mjs';import {identity,client} from './lib/worker.mjs';
const dir=mkdtempSync(join(process.cwd(),'.cold-media-storage-'));let passed=0;
const check=f=>{f();passed++;},w=await objectMediaWorker({port:22056,name:'object-media-independent-storage'});
try{
 const who=identity('cold-native'),api=client(w.base),db=await w.mf.getD1Database('DB'),bucket=await w.mf.getR2Bucket('BUCKET'),org=(await api.get(who,'/api/workspace')).json.organisation.id;
 const cmd=async c=>{const r=await api.command(who,c,org);assert.equal(r.status,200,r.text);return r.json.result;};
 const p=(await cmd({type:'createPerson',name:'Cold native completion',age:44,sex:'Other',village:'Synthetic',programme:'General care',teamId:'default'})).personId,v=(await cmd({type:'startVisit',personId:p})).visitId;
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts')))writeFileSync(join(dir,file.replace('.ts','.js')),ts.transpileModule(readFileSync('lib/saha/'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 writeFileSync(join(dir,'server.js'),`import {readState,scope} from './store.js';export const db=()=>globalThis.__coldMedia.db;export const identity=async()=>globalThis.__coldMedia.actor;export const rawRuntime=()=>({SAHA_ENVIRONMENT:'synthetic',SAHA_EXTERNAL_APIS_ENABLED:'false',SAHA_MEDIA_STORAGE:'r2-private-v1',BUCKET:globalThis.__coldMedia.bucket});export const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});export const loadFor=async(u,org,targets)=>{if(org!==globalThis.__coldMedia.org)throw Error('untrusted test org');const s=await readState(db(),org,targets?await targets(org):undefined);scope(s,u.userId);return s;};`);
 const production=await import(pathToFileURL(join(dir,'media-server.js'))),exit=await import(pathToFileURL(join(dir,'data-exit-server.js')));
 const bytes=new Uint8Array(700000);bytes.set([137,80,78,71,13,10,26,10]);
 const request=(key,body=bytes)=>new Request(`https://synthetic.invalid/api/media?visitId=${v}&purpose=document-or-card`,{method:'POST',headers:{'x-saha-organisation':org,'x-saha-expected-actor':who.id,'Idempotency-Key':key,'Content-Type':'image/png'},body});
 const nativeGet=async(...args)=>{const o=await bucket.get(...args);if(!o)return null;return {key:o.key,version:o.version,etag:o.etag,size:o.size,customMetadata:o.customMetadata,body:o.body,arrayBuffer:()=>new Response(o.body).arrayBuffer()};};
 let mutation=null;
 globalThis.__coldMedia={db,org,actor:{userId:who.id,displayName:'Synthetic cold actor',email:'cold@example.invalid'},bucket:{get:(...a)=>nativeGet(...a),put:(...a)=>bucket.put(...a),head:async(...a)=>{if(mutation){const fn=mutation;mutation=null;await fn(a[0]);}return bucket.head(...a);}}};
 const first=await (await production.uploadMedia(request(crypto.randomUUID()))).json(),row=await db.prepare('SELECT * FROM media WHERE org_id=? AND id=?').bind(org,first.mediaId).first(),ref=JSON.parse(row.storage_ref);
 const beforeRead=(await db.prepare("SELECT count(*) n FROM audit_events WHERE org_id=? AND action='viewMedia'").bind(org).first()).n;
 let readAuditAtReplacement=0;
 mutation=async key=>{readAuditAtReplacement=(await db.prepare("SELECT count(*) n FROM audit_events WHERE org_id=? AND action='viewMedia'").bind(org).first()).n;await bucket.put(key,bytes);};
 await assert.rejects(()=>production.mediaFile(new Request('https://synthetic.invalid/api/media/'+first.mediaId,{headers:{'x-saha-organisation':org}}),first.mediaId),e=>e.status===503);passed++;
 check(()=>assert.equal(readAuditAtReplacement,beforeRead+1));const changed=await bucket.head(ref.key);check(()=>assert.notEqual(changed.version,ref.version));
 const remove=await production.removeMedia(new Request('https://synthetic.invalid/api/media/'+first.mediaId+'?reason=Synthetic+retained+corrupt+draft',{method:'DELETE',headers:{'x-saha-organisation':org,'x-saha-expected-actor':who.id,'Idempotency-Key':crypto.randomUUID()}}),first.mediaId);check(()=>assert.equal(remove.status,200));
 bytes[8]=4;const second=await (await production.uploadMedia(request(crypto.randomUUID()))).json(),secondRow=await db.prepare('SELECT * FROM media WHERE org_id=? AND id=?').bind(org,second.mediaId).first(),secondRef=JSON.parse(secondRow.storage_ref);
 const beforeExport=(await db.prepare("SELECT count(*) n FROM audit_events WHERE org_id=? AND action='organisationExport'").bind(org).first()).n;let exportAuditAtReplacement=0;
 mutation=async key=>{exportAuditAtReplacement=(await db.prepare("SELECT count(*) n FROM audit_events WHERE org_id=? AND action='organisationExport'").bind(org).first()).n;await bucket.put(key,bytes);};
 await assert.rejects(()=>exit.dataExitRead(new Request('https://synthetic.invalid/api/data-exit',{headers:{'x-saha-organisation':org}})),e=>e.status===503);passed++;
 check(()=>assert.equal(exportAuditAtReplacement,beforeExport+1));const changedSecond=await bucket.head(secondRef.key);check(()=>assert.notEqual(changedSecond.version,secondRef.version));
 const linked=await db.prepare('SELECT state FROM media_custody WHERE org_id=? AND id=?').bind(org,second.mediaId).first();check(()=>assert.equal(linked.state,'linked'));
 const retainedFirst=await bucket.head(ref.key);check(()=>assert.ok(retainedFirst));
 writeFileSync('tests/evidence/object-media-integration/review/storage-boundary.json',JSON.stringify({passed,actualD1R2:true,trustedContextInjected:true,bodyStreamAdapterInjected:true,postPlaybackAuditObjectMutation:true,postExportAuditObjectMutation:true,noBytesOrArchiveReturned:true,externalCalls:0},null,2));console.log({passed});
}finally{delete globalThis.__coldMedia;rmSync(dir,{recursive:true,force:true});await w.stop();}
