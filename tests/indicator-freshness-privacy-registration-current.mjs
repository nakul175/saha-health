import assert from 'node:assert/strict';
import {coherentReportingFixture} from './lib/privacy-api-coherent-fixture.mjs';
// Slice 6ac: source freshness, late arrivals and the data-still-syncing warning through the built Worker and local D1.
export async function indicatorFreshnessSmoke({get,post,check,accounts,org,sql,base}){
 const coherent=await coherentReportingFixture({get,post,check},'freshness',{defaultTeam:true});accounts=coherent.accounts;org=coherent.org;
 const {owner:o,supervisor:s,worker:w}=accounts;
 await post(o,{type:'startVisit',personId:o.state.people[0].id});
 const read=async(who,q,status=200)=>{const r=await fetch(`${base}/api/indicators`,{method:'POST',headers:{...who.headers,'Content-Type':'application/json','x-saha-organisation':org},body:JSON.stringify(q)});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const cat=await fetch(`${base}/api/indicators`,{headers:{...s.headers,'x-saha-organisation':org}}).then(r=>r.json());
 const BANDS=['fewer than 5','5–19','20–99','100 or more'];
 // A field grant synced under the 6ac stamp: an existing team-default person with a draft (startVisit reuses it), facts unchanged.
 const draft=o.state.visits.find(v=>v.state==='draft'&&!v.voidedAt&&!v.supersededBy&&o.state.people.some(p=>p.id===v.personId&&p.teamId==='default'&&p.assigned&&!p.mergedInto&&!(p.fieldLeases??[]).some(l=>l.status==='active')));
 check(()=>assert.ok(draft,'a team-default draft visit exists'));
 let p=o.state.people.find(x=>x.id===draft.personId);
 const prep=await post(o,{type:'prepareFieldVisit',personId:p.id,version:p.version}),lease=prep.result.packet.payload;
 check(()=>assert.equal(lease.visitId,draft.id));
 await post(o,{type:'syncFieldVisit',personId:p.id,leaseId:lease.leaseId,packageHash:prep.result.packageHash,facts:lease.facts,answers:{},absence:{}});
 check(()=>{const v=o.state.visits.find(x=>x.id===lease.visitId);assert.equal(v.fieldSync.leaseId,lease.leaseId);assert.ok(Date.parse(v.fieldSync.at)<=Date.now()&&Date.parse(v.fieldSync.at)>Date.now()-600000);});
 // A second grant prepared and left unsynced, then dated 13 hours back in D1: the team shows "data still syncing".
 p=o.state.people.find(x=>x.id===draft.personId);
 const prep2=await post(o,{type:'prepareFieldVisit',personId:p.id,version:p.version}),lease2=prep2.result.packet.payload;
 const row=JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,p.id).data);row.fieldLeases.find(l=>l.id===lease2.leaseId).createdAt=new Date(Date.now()-13*3600000).toISOString();
 sql.prepare('UPDATE patients SET data=? WHERE org_id=? AND id=?').run(JSON.stringify(row),org,p.id);
 const q={ids:'visits-confirmed,followups-overdue,submissions-unresolved',days:'30',group:'none',team:'default'};
 const first=await read(s,q);
 check(()=>{const f=first.freshness;assert.equal(f.thresholdHours,72);assert.deepEqual(f.teams.map(t=>t.team),cat.teams.map(t=>t.name));
  assert.deepEqual(f.teams[0].sources.map(x=>x.source),['online-visits','field-syncs','imports','programme-receipts']);
  for(const x of f.teams[0].sources){assert.ok(BANDS.includes(x.arrivals));assert.ok(BANDS.includes(x.late));assert.ok(x.lateShare===null||x.lateShare%10===0);assert.ok(x.latestAt===null||new Date(x.latestAt).getUTCMinutes()===0);}
  assert.ok(f.teams[0].sources.find(x=>x.source==='field-syncs').latestAt,'the synced field visit is the latest field record');
  assert.equal(f.teams[0].syncing.grants,'fewer than 5');assert.match(f.teams[0].syncing.message,/Data still syncing/);});
 // Team names may contain a village word ("Rampur care team"); the check looks outside team names.
 check(()=>{let text=JSON.stringify(first.freshness);for(const t of cat.teams)text=text.split(t.name).join('');for(const v of cat.villages)assert.ok(!text.includes(v),`no village name (${v}) in freshness`);assert.ok(!text.includes(p.id)&&!text.includes(p.name)&&!text.includes(lease.leaseId));});
 // Late arrivals: stated only on released results, not applicable to measures without a visit source; a repeat names the previous release.
 const second=await read(s,q);
 check(()=>{for(const r of second.results){if(r.refused){assert.equal(r.lateArrivals,undefined);continue;}
  if(r.id==='visits-confirmed'){assert.equal(r.lateArrivals.applicable,true);assert.ok(r.lateArrivals.since);assert.ok(['fewer than 5','5–19','20–99','100 or more'].includes(r.lateArrivals.count));}
  else assert.equal(r.lateArrivals.applicable,false);}});
 // A repeated query gives the same team figures (nothing in them comes from the release just recorded).
 check(()=>assert.deepEqual(second.freshness.teams,first.freshness.teams));
 await read(w,q,403);
 // The CSV export is unchanged: no freshness or late-arrival rows.
 const csv=await fetch(`${base}/api/indicators`,{method:'POST',headers:{...s.headers,'Content-Type':'application/json','x-saha-organisation':org},body:JSON.stringify({...q,format:'csv'})});const body=await csv.text();
 check(()=>{assert.equal(csv.status,200);assert.ok(!/\bfreshness\b|\blate\b|\bsyncing\b/i.test(body));});
 await post(o,{type:'revokeFieldLease',personId:p.id,leaseId:lease2.leaseId});
}
