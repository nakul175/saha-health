import assert from 'node:assert/strict';
// Slice 2b: visit media upload, playback and draft removal through the built Worker and local D1.
export async function mediaSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,admin:a}=accounts;
 const png=(size=2048,seed=1)=>{const b=new Uint8Array(size);b.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);for(let i=8;i<size;i++)b[i]=(i*seed)%251;return b;};
 const upload=async(who,visitId,body,{mime='image/png',purpose='wound-or-skin',key=crypto.randomUUID(),status=200}={})=>{const r=await fetch(`${base}/api/media?visitId=${encodeURIComponent(visitId)}&purpose=${purpose}`,{method:'POST',headers:{...who.headers,'Content-Type':mime,'Idempotency-Key':key,'x-saha-organisation':org},body});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,200)));return j;};
 const play=async(who,id,status=200)=>{const r=await fetch(`${base}/api/media/${id}?organisationId=${encodeURIComponent(org)}`,{headers:who.headers});check(()=>assert.equal(r.status,status));return r;};
 const review=async(who,id,body,status=200,key=crypto.randomUUID())=>{const r=await fetch(`${base}/api/media/${id}/review`,{method:'POST',headers:{...who.headers,'Content-Type':'application/json','Idempotency-Key':key,'x-saha-organisation':org,'x-saha-expected-actor':who.id},body:JSON.stringify(body)});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,200)));return j;};
 const remove=async(who,id,reason,status=200)=>{const r=await fetch(`${base}/api/media/${id}?reason=${encodeURIComponent(reason)}`,{method:'DELETE',headers:{...who.headers,'Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,200)));return j;};
 const pid=(await post(o,{type:'createPerson',name:`Media Synthetic ${crypto.randomUUID().slice(0,6)}`,age:47,sex:'Male',village:'Media synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const vid=(await post(o,{type:'startVisit',personId:pid})).result.visitId;
 await upload(w,vid,png(),{status:403});await upload(a,vid,png(),{status:403});
 await upload(o,vid,new TextEncoder().encode('<html>'.padEnd(2048,' ')),{mime:'text/html',status:415});
 await upload(o,vid,png(),{mime:'image/jpeg',status:422});
 await upload(o,vid,png(200),{status:422});
 await upload(o,vid,png(300*1024),{status:413});
 await upload(o,vid,png(),{purpose:'voice-note',status:422});
 const key=crypto.randomUUID(),first=await upload(o,vid,png(),{key});
 const again=await upload(o,vid,png(),{key});check(()=>{assert.equal(again.replayed,true);assert.equal(again.mediaId,first.mediaId);});
 await upload(o,vid,png(),{status:409});
 const r=await play(o,first.mediaId);const bytes=new Uint8Array(await r.arrayBuffer());
 check(()=>{assert.deepEqual(bytes,png());assert.equal(r.headers.get('content-type'),'image/png');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('cache-control'),'no-store');});
 await play(w,first.mediaId,403);await play(a,first.mediaId,403);await play(o,'not-a-media-id',404);
 await get(o,'/api/workspace',200,org);
 check(()=>{const v=o.state.visits.find(x=>x.id===vid);assert.equal(v.media.length,1);assert.equal(v.media[0].size,2048);assert.equal(v.media[0].data,undefined,'snapshots carry references, not content');});
 const reviewInput={scan:'clean',quality:'acceptable',personMatch:true,retention:'visit-record',note:'Synthetic attachment checked against the selected person and encounter.',extractionDrafts:[{field:'document label',value:'synthetic example',sourceOffset:'page 1'}]},reviewKey=crypto.randomUUID();
 await review(w,first.mediaId,reviewInput,403);await review(o,first.mediaId,{...reviewInput,personMatch:false},422);const reviewed=await review(o,first.mediaId,reviewInput,200,reviewKey);check(()=>{assert.equal(reviewed.stage,'available');assert.equal(reviewed.extractionDrafts,1);});const replayed=await review(o,first.mediaId,reviewInput,200,reviewKey);check(()=>assert.equal(replayed.replayed,true));await review(o,first.mediaId,reviewInput,409);
 // Removal from a draft leaves a tombstone; confirmed visits are locked.
 const second=await upload(o,vid,png(4096,7));
 await remove(w,second.mediaId,'Worker attempt',403);await remove(o,second.mediaId,'no',422);
 await remove(o,second.mediaId,'Blurred photo, retaken');
 await play(o,second.mediaId,410);await remove(o,second.mediaId,'Blurred photo, retaken',409);
 check(()=>{const row=sql.prepare('SELECT data,deleted_at,size FROM media WHERE org_id=? AND id=?').get(org,second.mediaId);assert.equal(row.data,'');assert.ok(row.deleted_at);assert.equal(row.size,0);});
 const facts={date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:'70',temperature:'',weeks:'',coughDays:'',notes:'Synthetic visit with a wound photograph.',source:'measured'};
 await get(o,'/api/workspace',200,org);
 await post(o,{type:'saveVisit',visitId:vid,version:o.state.visits.find(x=>x.id===vid).version,facts});await get(o,'/api/workspace',200,org);
 await post(o,{type:'confirmVisit',visitId:vid,version:o.state.visits.find(x=>x.id===vid).version});
 await upload(o,vid,png(3000,3),{status:409});await remove(o,first.mediaId,'Try after confirmation',409);
 await play(o,first.mediaId);
 check(()=>assert.ok(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND person_id=? AND action IN ('attachMedia','reviewMedia','removeMedia')").get(org,pid).n===4));
}
