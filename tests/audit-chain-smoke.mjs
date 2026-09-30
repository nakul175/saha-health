import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// Slice 6j: audit chain verification and signed-off export over HTTP and local D1.
const sha=text=>createHash('sha256').update(text).digest('hex');
const content=(orgId,l)=>sha(JSON.stringify([orgId,l.id,l.event.personId,l.event.actorId,l.event.actorName,l.event.role,l.event.action,l.event.subject,l.event.detail,l.event.at]));
const linkOk=l=>sha(JSON.stringify(['saha-audit-chain-v1',l.seq,l.prevHash,l.content]))===l.hash;
export async function auditChainSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,admin:a,supervisor:sv,stranger:x}=accounts;
 const raw=async(who,query,orgId,status=200)=>{const r=await fetch(`${base}/api/audit/chain${query}`,{headers:{...who.headers,'x-saha-organisation':orgId}});const text=await r.text();check(()=>assert.equal(r.status,status,text.slice(0,300)));return {r,text};};
 // Only owners and administrators may verify or export.
 const refused=async(who,query)=>{const {text}=await raw(who,query,org,403);check(()=>assert.match(JSON.parse(text).error,/Owner or administrator access/));};
 await refused(w,'');await refused(sv,'');await refused(w,'?format=jsonl');
 await raw(x,'',org,403);
 // A fresh organisation: genesis at creation, commands extend the chain, verification is intact.
 const created=await post(o,{type:'createOrganisation',name:'Audit chain organisation'}),mine=created.result.organisationId;
 const pid=(await post(o,{type:'createPerson',name:`Chain Synthetic ${crypto.randomUUID().slice(0,6)}`,age:39,sex:'Female',village:'Chain locality',programme:'General care',teamId:'default'},200,undefined,mine)).result.personId;
 const vid=(await post(o,{type:'startVisit',personId:pid},200,undefined,mine)).result.visitId;
 // An administrator joins the new organisation (no care team).
 await get(a,'/api/workspace');const inv=(await post(o,{type:'createInvite',accountCode:a.state.user.accountCode,label:'Chain admin',role:'admin',teamIds:[]},200,undefined,mine)).result;await post(a,{type:'joinOrganisation',token:inv.token});
 const adminView=JSON.parse((await raw(a,'',mine)).text);
 check(()=>{assert.equal(adminView.chainVersion,'saha-audit-chain-v1');assert.equal(adminView.status,'intact');assert.equal(JSON.stringify(adminView).includes('detail'),false,'verification carries no event content')});
 // An administrator's export lists patient-linked events as digests only; the chain still verifies.
 const adminExport=(await raw(a,'?format=jsonl',mine)).text.trim().split('\n').map(l=>JSON.parse(l)),adminEvents=adminExport.filter(l=>l.type==='event');
 check(()=>{const hidden=adminEvents.filter(l=>l.redacted);assert.ok(hidden.length>=2);assert.ok(hidden.every(l=>!l.event));assert.equal(adminExport.at(-1).redacted,hidden.length);assert.equal(adminExport.at(-1).exportedBy.role,'admin');assert.ok(adminEvents.every(l=>(!l.event||content(mine,l)===l.content)&&linkOk(l)))});
 await raw(a,'?format=xml',mine,422);await raw(a,'?format=jsonl&from=abc',mine,422);await raw(a,'?format=jsonl&from=999999999',mine,404);
 let view=JSON.parse((await raw(o,'',mine)).text);
 const rows=()=>sql.prepare('SELECT seq,id,prev_hash,hash,action FROM audit_events WHERE org_id=? AND seq IS NOT NULL ORDER BY seq').all(mine);
 check(()=>{const r=rows();assert.equal(view.status,'intact');assert.equal(view.priorEvents,0);assert.equal(view.events,r.length);assert.equal(r[0].action,'auditChainGenesis');assert.equal(r.at(-1).action,'auditChainExport');assert.equal(view.head.hash,r.at(-1).hash);assert.equal(view.firstBreak,null)});
 check(()=>assert.equal(sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND seq IS NULL').get(mine).n,0));

 // The owner's export: every line recomputes offline, the sign-off matches the body and is recorded in the chain.
 const {r:exportResponse,text}=await raw(o,'?format=jsonl',mine);
 check(()=>{assert.match(exportResponse.headers.get('content-type'),/ndjson/);assert.match(exportResponse.headers.get('content-disposition'),/saha-audit-chain-0-\d+\.jsonl/);assert.equal(exportResponse.headers.get('cache-control'),'no-store')});
 const lines=text.trim().split('\n'),parsed=lines.map(l=>JSON.parse(l)),header=parsed[0],signoff=parsed.at(-1),events=parsed.slice(1,-1);
 check(()=>{assert.equal(header.type,'header');assert.equal(header.organisationId,mine);assert.equal(header.range.from,0);assert.equal(header.more,false);assert.match(header.hashing,/SHA-256/)});
 check(()=>{assert.equal(events.length,view.events);assert.ok(events.every(l=>l.event&&!l.redacted),'the owner is on the patient\'s team');assert.ok(events.some(l=>l.event.personId===pid))});
 check(()=>{for(const l of events){assert.equal(content(mine,l),l.content,l.id);assert.ok(linkOk(l),l.id);}for(let i=1;i<events.length;i++)assert.equal(events[i].prevHash,events[i-1].hash);assert.equal(events[0].prevHash,'0'.repeat(64))});
 check(()=>{assert.equal(signoff.type,'signoff');assert.equal(signoff.bodySha256,sha(lines.slice(0,-1).join('\n')+'\n'));assert.equal(signoff.verification.status,'intact');assert.equal(signoff.head.seq,events.at(-1).seq);assert.equal(signoff.exportedBy.owner,true);assert.match(signoff.signature,/No signing key/)});
 const recorded=sql.prepare('SELECT seq,action,detail,prev_hash FROM audit_events WHERE org_id=? AND id=?').get(mine,signoff.recordedAs);
 check(()=>{assert.equal(recorded.action,'auditChainExport');assert.ok(recorded.detail.includes(signoff.bodySha256));assert.equal(recorded.seq,events.at(-1).seq+1);assert.equal(recorded.prev_hash,events.at(-1).hash)});
 view=JSON.parse((await raw(o,'',mine)).text);check(()=>{assert.equal(view.status,'intact');assert.equal(view.head.seq,recorded.seq)});
 const tail=(await raw(o,`?format=jsonl&from=${recorded.seq}`,mine)).text.trim().split('\n').map(l=>JSON.parse(l));
 check(()=>{assert.equal(tail[0].range.from,recorded.seq);assert.equal(tail[1].id,signoff.recordedAs);assert.equal(tail.length,3)});

 // A forged event written straight into the database is detected as the first break.
 const head=rows().at(-1);
 sql.prepare('INSERT INTO audit_events (org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at,seq,prev_hash,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(mine,'forged-'+crypto.randomUUID(),null,o.id,'Owner','clinician','opsExport',mine,'Forged outside the application',new Date().toISOString(),head.seq+1,head.hash,'f'.repeat(64));
 view=JSON.parse((await raw(o,'',mine)).text);
 check(()=>{assert.equal(view.status,'broken');assert.equal(view.firstBreak.seq,head.seq+1);assert.match(view.firstBreak.reason,/altered/)});
 // Work continues after a break; the break stays reported.
 await post(o,{type:'saveVisit',visitId:vid,version:1,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'120',diastolic:'80',weight:'60',temperature:'',weeks:'',coughDays:'',notes:'Synthetic chain visit.',source:'measured'}},200,undefined,mine);
 view=JSON.parse((await raw(o,'',mine)).text);check(()=>{assert.equal(view.firstBreak.seq,head.seq+1);assert.equal(rows().at(-1).action,'saveVisit')});
 await post(o,{type:'switchOrganisation',organisationId:org});
}
