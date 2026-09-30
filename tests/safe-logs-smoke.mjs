import assert from 'node:assert/strict';
// Slice 6l (BR-SEC-07): the main flows run with distinctive synthetic names, narratives, a raw
// recording and an invitation token; none may appear in request metrics, the Worker's console
// output (application and local platform request logs) or the support and report exports.
export async function safeLogsSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,supervisor:sv,stranger:x}=accounts,tag=crypto.randomUUID().replace(/-/g,'').slice(0,10);
 const secrets={name:`Zephyrine Quillfeather ${tag}`,village:`Vexbrook${tag}`,narrative:`Kestrelmoon narrative ${tag}: synthetic complaint of dizziness after the harvest, with family history recorded`,referral:`Thornquist referral reason ${tag}`,recording:`RAWRECORDING${tag}`,question:`visits for Zephyrine Quillfeather ${tag}`,removal:`Removal reason Brackenwhirl ${tag}`};
 const marks=[...Object.values(secrets),tag];
 const startOutput=globalThis.sahaWorkerOutput?.().length??0;
 // Main flows.
 const pid=(await post(o,{type:'createPerson',name:secrets.name,age:36,sex:'Female',village:secrets.village,programme:'General care',teamId:'default'},200,undefined,org)).result.personId;
 const p=()=>o.state.people.find(y=>y.id===pid);
 const vid=(await post(o,{type:'startVisit',personId:pid},200,undefined,org)).result.visitId,v=()=>o.state.visits.find(y=>y.id===vid);
 const facts={date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'126',diastolic:'84',weight:'58',temperature:'',weeks:'',coughDays:'',notes:secrets.narrative,source:'measured'};
 await post(o,{type:'saveVisit',visitId:vid,version:v().version,facts},200,undefined,org);
 await post(o,{type:'saveVisit',visitId:vid,version:1,facts},409,undefined,org);
 const audio=new Uint8Array(4096);audio.set([0x1a,0x45,0xdf,0xa3]);audio.set(new TextEncoder().encode(secrets.recording),64);
 const up=await fetch(`${base}/api/media?visitId=${encodeURIComponent(vid)}&purpose=voice-note`,{method:'POST',headers:{...o.headers,'Content-Type':'audio/webm','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org},body:audio});const media=await up.json();check(()=>assert.equal(up.status,200,JSON.stringify(media)));
 const del=await fetch(`${base}/api/media/${media.mediaId}`,{method:'DELETE',headers:{...o.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org},body:JSON.stringify({reason:secrets.removal})});check(()=>{assert.equal(del.status,200);const row=sql.prepare('SELECT deleted_at FROM media WHERE org_id=? AND id=?').get(org,media.mediaId);assert.ok(row.deleted_at);assert.ok(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='removeMedia' AND detail LIKE ?").get(org,'%'+secrets.removal).n===1,'the reason sent in the body is recorded')});
 await get(o,'/api/workspace',200,org);
 await post(o,{type:'confirmVisit',visitId:vid,version:v().version},200,undefined,org);
 await post(o,{type:'createReferral',visitId:vid,facility:'Synthetic safe-log facility',reason:secrets.referral},200,undefined,org);
 await post(o,{type:'createPerson',name:secrets.name,age:500,sex:'Female',village:secrets.village,programme:'General care',teamId:'default'},422,undefined,org);
 await get(o,`/api/history?personId=${encodeURIComponent(pid)}`,200,org);
 const ask=await fetch(`${base}/api/indicators`,{method:'POST',headers:{...o.headers,'Content-Type':'application/json','x-saha-organisation':org},body:JSON.stringify({question:secrets.question})});const interpreted=await ask.json();check(()=>{assert.equal(ask.status,200);assert.ok(interpreted.interpretation)});
 const plain=await fetch(`${base}/api/indicators`,{method:'POST',headers:{...o.headers,'Content-Type':'text/plain','x-saha-organisation':org},body:'question=x'});check(()=>assert.equal(plain.status,415));
 const filteredResponse=await fetch(`${base}/api/indicators`,{method:'POST',headers:{...o.headers,'Content-Type':'application/json','x-saha-organisation':org},body:JSON.stringify({ids:'visits-confirmed',days:30,village:secrets.village})}),filtered=await filteredResponse.json();check(()=>{assert.equal(filteredResponse.status,422);assert.match(filtered.error,/fewer than 5 people/,'a one-person village cohort is protected the same way as over GET')});
 // An invitation token is a credential; it is created and then revoked.
 await get(x,'/api/workspace');const invite=(await post(o,{type:'createInvite',accountCode:x.state.user.accountCode,label:'Safe log invite',role:'asha',teamIds:['default']},200,undefined,org)).result;marks.push(invite.token);
 await post(o,{type:'revokeInvite',inviteId:invite.invitationId},200,undefined,org);
 // The marks are real: the owner's own scoped reads return them.
 const snapshot=JSON.stringify(await get(o,'/api/workspace',200,org));check(()=>{assert.ok(snapshot.includes(secrets.name));assert.ok(snapshot.includes(secrets.narrative))});
 // Exports meant for support and reporting.
 const supportText=await (await fetch(`${base}/api/operations?days=7&format=support`,{headers:{...o.headers,'x-saha-organisation':org}})).text();
 const reportText=await (await fetch(`${base}/api/operations?days=7&format=csv`,{headers:{...o.headers,'x-saha-organisation':org}})).text();
 const opsJson=await get(o,'/api/operations?days=7',200,org),telemetry=JSON.stringify(opsJson.telemetry);
 const supervisorReport=JSON.stringify((await get(sv,'/api/operations?days=7',200,org)).report);
 await new Promise(r=>setTimeout(r,800));
 const output=globalThis.sahaWorkerOutput?.().slice(startOutput)??'';
 const metrics=JSON.stringify(sql.prepare('SELECT * FROM request_metrics').all());
 const leaks=(label,text)=>marks.filter(m=>text.includes(m)||text.includes(encodeURIComponent(m))||text.includes(Buffer.from(m).toString('base64').slice(0,16))).map(m=>`${label}: ${m.slice(0,24)}`);
 const found=[...leaks('console',output),...leaks('request_metrics',metrics),...leaks('support export',supportText),...leaks('report export',reportText),...leaks('operations telemetry',telemetry+supervisorReport)];if(found.length)console.error('Safe-log leaks',JSON.stringify(found),output.split('\n').filter(l=>marks.some(m=>l.includes(m)||l.includes(encodeURIComponent(m)))).slice(0,10).join('\n'));
 check(()=>assert.ok(output.includes('"event":"saha_request"')&&output.includes('"route":"media"'),'the Worker console was captured'));
 check(()=>assert.deepEqual(leaks('console',output),[]));
 check(()=>assert.deepEqual(leaks('request_metrics',metrics),[]));
 check(()=>assert.deepEqual(leaks('support export',supportText),[]));
 check(()=>assert.deepEqual(leaks('report export',reportText),[]));
 check(()=>assert.deepEqual(leaks('operations telemetry',telemetry+supervisorReport),[]));
 // Application log lines carry only fixed fields.
 check(()=>{for(const line of output.split('\n').filter(l=>l.startsWith('{"event":"saha_request"')))assert.deepEqual(Object.keys(JSON.parse(line)),['event','requestId','route','status','durationMs']);});
}
