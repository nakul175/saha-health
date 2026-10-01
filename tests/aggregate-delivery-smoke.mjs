import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
// Slice 7g: aggregate report delivery to aggregate-only destinations (BR-INT-09, BR-REP-05), through the built Worker
// and local D1: preparation scoped to owners and supervisors, approval by a different person, the external-request
// audit before the checkpoint, the release recorded for the destination, receipts, lookup of a lost response, a
// withdrawal refused before sending, and the history read. Demonstration destinations only; nothing leaves Saha.
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
export async function aggregateDeliverySmoke({get,post,check,accounts,org,sql}){
 const {owner:o,supervisor:s,worker:w,admin:a}=accounts;
 const send=(who,body,status=200,key=crypto.randomUUID())=>post(who,body,status,key,org);
 await get(o,'/api/workspace',200,org);
 const integration=id=>o.state.integrations.find(i=>i.id===id);
 const set=async(id,allowed,aggregateOnly)=>{await get(o,'/api/workspace',200,org);return send(o,{type:'setAdapterOperations',integrationId:id,version:integration(id)?.operations?.version??0,allowed,aggregateOnly,reason:'Synthetic aggregate delivery check'});};
 const today=new Date().toISOString().slice(0,10),start=new Date(Date.now()-60*86400000).toISOString().slice(0,10);
 const prep=(over={})=>({type:'prepareAggregateReport',destinationId:'mis_maternal',definitions:['visits-confirmed','patients-seen'],period:{start,end:today},teamIds:['default'],group:'none',...over});
 const reports=async(who=o)=>(await get(who,'/api/aggregate-reports',200,org)).reports;
 // A destination that is not aggregate-only receives no aggregate report.
 const notAggregate=await send(o,prep(),422);check(()=>assert.match(notAggregate.error,/not an aggregate-only destination/));
 await set('mis_maternal',['aggregate','lookup'],true);
 // Owners and supervisors only, for their own teams.
 await send(w,prep(),403);await send(a,prep(),403);await send(s,prep({teamIds:['no-such-team']}),403);
 await get(w,'/api/aggregate-reports',403,org);
 const key=crypto.randomUUID(),prepared=await send(o,prep(),200,key);const id=prepared.result.reportId;
 const replay=await send(o,prep(),200,key);check(()=>{assert.equal(replay.replayed,true);assert.equal(replay.result.reportId,id);});
 let r=(await reports()).find(x=>x.id===id);
 check(()=>{assert.equal(r.state,'prepared');assert.equal(r.destinationId,'mis_maternal');assert.deepEqual(r.definitions,['visits-confirmed@1','patients-seen@1']);
  const p=r.payload;assert.equal(p.manifest.sha256,createHash('sha256').update(canonical({report:p.report,definitions:p.manifest.definitions,blocks:p.blocks})).digest('hex'));assert.equal(p.manifest.rows,p.blocks.reduce((n,b)=>n+b.cells.length,0));
  const json=JSON.stringify(p);assert.ok(!/personId|visitId|"name"/.test(json));for(const person of o.state.people.slice(0,40))assert.ok(!json.includes(person.id)&&!json.includes(person.name),'no patient identifier or name');
  for(const b of p.blocks)for(const c of b.cells)if(!c.suppressed)for(const v of [c.numerator,c.denominator])assert.ok(v===null||v===0||v>=5,'no released cell from 1 to 4');
  assert.equal(r.minimisation[0].passed,true);assert.equal(r.events[0].ref.command,'prepareAggregateReport');assert.equal(r.teamNames.length,1);assert.equal(typeof r.teamNames[0],'string');});
 // A different authorised person approves the payload they reviewed.
 await send(o,{type:'approveAggregateReport',reportId:id,payloadSha256:r.payloadSha256},403);
 await send(s,{type:'approveAggregateReport',reportId:id,payloadSha256:'0'.repeat(64)},409);
 await send(o,{type:'sendAggregateReport',reportId:id},409);
 await send(s,{type:'approveAggregateReport',reportId:id,payloadSha256:r.payloadSha256});
 // Sent by the preparer: access audit, checkpoint, release for the destination, receipt.
 const sent=await send(o,{type:'sendAggregateReport',reportId:id});
 r=(await reports(s)).find(x=>x.id===id);
 check(()=>{assert.equal(sent.result.state,'accepted');assert.match(sent.result.receipt,/^AGG-[0-9A-F]{8}$/);assert.equal(r.receipt,sent.result.receipt);assert.equal(r.attempts,1);
  assert.deepEqual(r.minimisation.map(m=>m.stage),['prepare','before-send','checkpoint']);assert.ok(r.minimisation.every(m=>m.passed));
  assert.deepEqual(r.events.map(e=>e.ref?.command),['prepareAggregateReport','approveAggregateReport','sendAggregateReport','aggregateReceipt']);
  const ev=sql.prepare("SELECT action,seq,person_id FROM audit_events WHERE org_id=? AND subject=? ORDER BY seq").all(org,id).map(x=>x.action);
  assert.deepEqual(ev,['prepareAggregateReport','approveAggregateReport','externalRequest','sendAggregateReport','aggregateReceipt'],'the request is audited before the checkpoint');
  const ledger=JSON.parse(sql.prepare("SELECT json_extract(data,'$.indicatorReleases') AS l FROM operations WHERE org_id=?").get(org).l??'[]'),v=createHash('sha256').update(JSON.stringify(`saha-indicator-release:${org}:destination:mis_maternal`)).digest('hex').slice(0,20);
  assert.ok(ledger.some(x=>x.v===v),'the release is recorded for the destination');assert.ok(!JSON.stringify(ledger).includes(r.teamNames[0]));});
 const again=await send(o,{type:'sendAggregateReport',reportId:id});check(()=>assert.equal(again.result.state,'accepted'));
 // A lost response (the community simulator): the outcome is unknown, never resent, and found by lookup.
 await set('mis_community',['aggregate','lookup'],true);
 const lost=(await send(s,prep({destinationId:'mis_community',definitions:['visits-confirmed']}))).result.reportId;
 await send(o,{type:'approveAggregateReport',reportId:lost,payloadSha256:(await reports()).find(x=>x.id===lost).payloadSha256});
 const unknown=await send(s,{type:'sendAggregateReport',reportId:lost});
 await send(s,{type:'sendAggregateReport',reportId:lost},409);
 const looked=await send(o,{type:'lookupAggregateReport',reportId:lost});
 check(()=>{assert.equal(unknown.result.state,'uncertain');assert.equal(looked.result.state,'accepted');assert.match(looked.result.receipt,/^AGG-/);});
 r=(await reports()).find(x=>x.id===lost);check(()=>{assert.equal(r.attempts,1);assert.match(r.message,/by lookup; the report was not sent again/);});
 // An operation withdrawn after approval: closed as not sent before the checkpoint.
 const late=(await send(o,prep({definitions:['visits-confirmed']}))).result.reportId;
 await send(s,{type:'approveAggregateReport',reportId:late,payloadSha256:(await reports()).find(x=>x.id===late).payloadSha256});
 await set('mis_maternal',['lookup'],false);
 const closed=await send(o,{type:'sendAggregateReport',reportId:late});
 r=(await reports()).find(x=>x.id===late);
 check(()=>{assert.equal(closed.result.state,'cancelled');assert.equal(closed.result.refused,true);assert.equal(r.refusal.stage,'before-send');assert.equal(r.attempts,0);assert.match(r.message,/Not sent: .*no longer an aggregate-only destination/);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND subject=? AND action='externalRequest'").get(org,late).n,0,'nothing was requested');});
 // The operations read leaves the reports (and the ledger) out; the supervisor sees the history.
 const ops=await get(o,'/api/operations',200,org);check(()=>{assert.equal(JSON.stringify(ops).includes('aggregateReports'),false);});
 // Restore the release defaults for the shared synthetic organisation.
 await set('mis_maternal',['create','update','lookup'],false);await set('mis_community',['create','update','lookup'],false);
}
