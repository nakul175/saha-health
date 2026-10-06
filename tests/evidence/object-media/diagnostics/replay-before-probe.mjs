// Historical before witness: execute only against unchanged 8aa0e967 built source.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {startMiniflare} from '../../../lib/miniflare.mjs';
import {identity,client} from '../../../lib/worker.mjs';
const w=await startMiniflare({port:9051,name:'object-media-before'});
try{const actor=identity('media-original'),api=client(w.base),home=(await api.get(actor,'/api/workspace')).json,org=home.organisation.id,db=await w.mf.getD1Database('DB');
const command=async c=>{const r=await api.command(actor,c,org);assert.equal(r.status,200,r.text);return r.json.result};
const personId=(await command({type:'createPerson',name:'Synthetic media',age:30,sex:'Other',village:'Synthetic',programme:'General care',teamId:'default'})).personId;
const visitId=(await command({type:'startVisit',personId})).visitId;
const bytes=new Uint8Array(2048);bytes.set([0x89,0x50,0x4e,0x47,13,10,26,10]);const key=crypto.randomUUID();
const upload=()=>fetch(w.base+`/api/media?visitId=${visitId}&purpose=document-or-card`,{method:'POST',headers:{...actor.headers,'x-saha-organisation':org,'Content-Type':'image/png','Idempotency-Key':key},body:bytes});
const first=await upload();assert.equal(first.status,200);const initial=await first.json();await db.prepare("UPDATE memberships SET status='suspended',version=version+1 WHERE org_id=? AND user_id=?").bind(org,actor.id).run();
const replay=await upload(),result=await replay.json();assert.equal(replay.status,200);assert.equal(result.replayed,true);assert.equal(result.mediaId,initial.mediaId);
writeFileSync('tests/evidence/object-media/replay-before.json',JSON.stringify({originalStatus:first.status,withdrawnActorReplayStatus:replay.status,result,unsafeDisclosureObserved:true},null,2));console.log('Grounded withdrawn actor saved media receipt disclosure 200');
}finally{await w.stop();}
