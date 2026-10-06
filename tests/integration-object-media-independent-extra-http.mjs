// Cold review additions: actual built HTTP/D1/local R2; synthetic identities only.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {objectMediaWorker} from './lib/object-media-worker.mjs';
import {identity,client} from './lib/worker.mjs';
const ev='tests/evidence/object-media-integration/review';let passed=0;
const check=f=>{f();passed++;};
const w=await objectMediaWorker({port:22052,name:'object-media-independent-extra'});
try{
 const actor=identity('cold-owner'),other=identity('cold-other'),api=client(w.base),db=await w.mf.getD1Database('DB'),bucket=await w.mf.getR2Bucket('BUCKET');
 const org=(await api.get(actor,'/api/workspace')).json.organisation.id;
 const cmd=async c=>{const r=await api.command(actor,c,org);assert.equal(r.status,200,r.text);return r.json.result;};
 const p=(await cmd({type:'createPerson',name:'Cold independent custody',age:37,sex:'Other',village:'Synthetic',programme:'General care',teamId:'default'})).personId,v=(await cmd({type:'startVisit',personId:p})).visitId;
 const bytes=new Uint8Array(700000);bytes.set([137,80,78,71,13,10,26,10]);for(let i=8;i<bytes.length;i++)bytes[i]=i%251;
 const key=crypto.randomUUID();
 const upload=async({who=actor,expected=actor.id,key:requestKey=key,body=bytes}={})=>{const r=await fetch(w.base+`/api/media?visitId=${v}&purpose=document-or-card`,{method:'POST',headers:{...who?.headers,'x-saha-organisation':org,'x-saha-expected-actor':expected,'Content-Type':'image/png','Idempotency-Key':requestKey},body});return {status:r.status,json:await r.json()};};
 const simultaneous=await Promise.all([upload(),upload()]);
 check(()=>assert.ok(simultaneous.some(r=>r.status===200),JSON.stringify(simultaneous)));
 check(()=>assert.ok(simultaneous.every(r=>[200,409,503].includes(r.status)),JSON.stringify(simultaneous)));
 const recovered=await upload();check(()=>assert.equal(recovered.status,200));check(()=>assert.equal(recovered.json.replayed,true));
 const id=recovered.json.mediaId,row=await db.prepare('SELECT * FROM media WHERE org_id=? AND id=?').bind(org,id).first(),ref=JSON.parse(row.storage_ref);
 const count=async table=>(await db.prepare(`SELECT count(*) n FROM ${table} WHERE org_id=?`).bind(org).first()).n;
 check(()=>assert.equal(simultaneous.find(r=>r.status===200).json.mediaId,id));
 const rows=await count('media'),intents=await count('media_custody'),receipts=(await db.prepare('SELECT count(*) n FROM command_receipts WHERE actor_id=? AND key=?').bind(actor.id,key).first()).n,objects=await bucket.list();
 check(()=>assert.equal(rows,1));check(()=>assert.equal(intents,1));check(()=>assert.equal(receipts,1));check(()=>assert.equal(objects.objects.length,1));
 const foreignHome=(await api.get(other,'/api/workspace')).json,invite=await cmd({type:'createInvite',accountCode:foreignHome.user.accountCode,label:'Cold scoped clinician',role:'clinician',teamIds:['default']});
 const joined=await api.command(other,{type:'joinOrganisation',token:invite.token},org);check(()=>assert.equal(joined.status,200));
 const wrong=await upload({who:other});check(()=>assert.equal(wrong.status,403));check(()=>assert.ok(!wrong.json.mediaId));
 const invalid=await upload({key:crypto.randomUUID(),body:new Uint8Array(700000)});check(()=>assert.equal(invalid.status,422));
 const anonymous=await upload({who:null,key:crypto.randomUUID()});check(()=>assert.equal(anonymous.status,401));
 const afterInvalid=await count('media_custody');check(()=>assert.equal(afterInvalid,intents));
 // A real D1 audit trigger substitutes an internal media pointer after bytes are read.
 // A response must refuse rather than returning the already prepared body.
 await db.exec(`CREATE TRIGGER cold_media_row_change AFTER INSERT ON audit_events WHEN NEW.action='viewMedia' BEGIN UPDATE media SET storage_ref=json_set(storage_ref,'$.etag','cold-changed') WHERE org_id=NEW.org_id AND id='${id}'; END`);
 const changed=await fetch(w.base+`/api/media/${id}?organisationId=${org}`,{headers:actor.headers});check(()=>assert.equal(changed.status,409));
 await changed.arrayBuffer();await db.exec('DROP TRIGGER cold_media_row_change');await db.prepare('UPDATE media SET storage_ref=? WHERE org_id=? AND id=?').bind(row.storage_ref,org,id).run();
 // A custody state mismatch refuses both playback and portable export.
 await db.prepare("UPDATE media_custody SET state='removed' WHERE org_id=? AND id=?").bind(org,id).run();
 const badCustody=await fetch(w.base+`/api/media/${id}?organisationId=${org}`,{headers:actor.headers});check(()=>assert.equal(badCustody.status,503));await badCustody.arrayBuffer();
 const badExport=await api.get(actor,'/api/data-exit',org);check(()=>assert.equal(badExport.status,503));
 const retained=await bucket.head(ref.key);check(()=>assert.equal(retained.version,ref.version));
 // Exact receipt recovery does not require restoring a confirmed visit to draft.
 let snap=(await api.get(actor,'/api/workspace',org)).json,visit=snap.visits.find(x=>x.id===v),person=snap.people.find(x=>x.id===p);
 await cmd({type:'saveVisit',visitId:v,version:visit.version,facts:{...visit.facts,weight:'64',notes:'Synthetic cold review confirmation'}});
 snap=(await api.get(actor,'/api/workspace',org)).json;visit=snap.visits.find(x=>x.id===v);person=snap.people.find(x=>x.id===p);
 await cmd({type:'confirmVisit',visitId:v,version:visit.version,patientCheck:{personId:p,personVersion:person.version,confirmed:true}});
 const lockedReplay=await upload();check(()=>assert.equal(lockedReplay.status,200));check(()=>assert.equal(lockedReplay.json.mediaId,id));check(()=>assert.equal(lockedReplay.json.replayed,true));
 const lockedFresh=await upload({key:crypto.randomUUID()});check(()=>assert.equal(lockedFresh.status,409));
 const finalRows=await count('media'),finalIntents=await count('media_custody'),finalReceipts=(await db.prepare('SELECT count(*) n FROM command_receipts WHERE actor_id=? AND key=?').bind(actor.id,key).first()).n;
 check(()=>assert.equal(finalRows,rows));check(()=>assert.equal(finalIntents,intents));check(()=>assert.equal(finalReceipts,receipts));
 writeFileSync(ev+'/extra-http.json',JSON.stringify({passed,concurrentStatuses:simultaneous.map(r=>r.status),sameKeyRows:rows,sameKeyIntents:intents,sameKeyReceipts:receipts,sameKeyObjects:objects.objects.length,auditRowMutationTrigger:true,actualHttpD1R2:true,externalCalls:0},null,2));console.log({passed});
}finally{await w.stop();}
