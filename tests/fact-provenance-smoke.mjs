import assert from 'node:assert/strict';
// Slice 2c: per-measurement source and time through the built Worker and local D1: online save, field sync,
// field registration, history and the FHIR example download.
export async function factProvenanceSmoke({get,post,check,accounts,org,base}){
 const {owner:o}=accounts;await get(o,'/api/workspace',200,org);
 const minute=t=>new Date(t).toISOString().slice(0,16),visitAt=minute(Date.now()-2*3600000),earlier=minute(Date.now()-26*3600000),future=minute(Date.now()+3600000);
 const blank={date:visitAt,systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic provenance visit.',source:'measured'};
 const pid=(await post(o,{type:'createPerson',name:`Provenance Synthetic ${crypto.randomUUID().slice(0,6)}`,age:30,sex:'Female',village:'Provenance synthetic locality',programme:'Maternal care',teamId:'default'})).result.personId;
 const vid=(await post(o,{type:'startVisit',personId:pid})).result.visitId;const version=()=>o.state.visits.find(v=>v.id===vid).version;
 // Refusals: contradictions, a time on a blank value, future times, unknown measurement or source.
 await post(o,{type:'saveVisit',visitId:vid,version:version(),facts:{...blank,weight:'61',provenance:{weight:{source:'declined'}}}},422);
 await post(o,{type:'saveVisit',visitId:vid,version:version(),facts:{...blank,provenance:{temperature:{source:'measured'}}}},422);
 await post(o,{type:'saveVisit',visitId:vid,version:version(),facts:{...blank,provenance:{weeks:{source:'unknown',at:earlier}}}},422);
 await post(o,{type:'saveVisit',visitId:vid,version:version(),facts:{...blank,weight:'61',provenance:{weight:{source:'reported',at:future}}}},422);
 await post(o,{type:'saveVisit',visitId:vid,version:version(),facts:{...blank,provenance:{pulse:{source:'measured'}}}},422);
 await post(o,{type:'saveVisit',visitId:vid,version:version(),facts:{...blank,weight:'61',provenance:{weight:{source:'guessed'}}}},422);
 check(()=>assert.equal(o.state.visits.find(v=>v.id===vid).facts.provenance,undefined,'refusals store nothing'));
 // A draft saved without per-measurement entries stays valid; then one with them is stored as sent.
 await post(o,{type:'saveVisit',visitId:vid,version:version(),facts:{...blank,weight:'60'}});
 const facts={...blank,systolic:'150',diastolic:'96',weight:'61',weeks:'20',provenance:{weight:{source:'reported',at:earlier},weeks:{source:'reported'},temperature:{source:'declined'}}};
 await post(o,{type:'saveVisit',visitId:vid,version:version(),facts});
 check(()=>assert.deepEqual(o.state.visits.find(v=>v.id===vid).facts.provenance,facts.provenance));
 const hist=await get(o,`/api/history?personId=${pid}`,200,org);
 check(()=>assert.ok(hist.revisions.some(r=>r.changes.some(c=>c.field==='facts.provenance.weight.source'&&c.after==='reported')),'history records the change'));
 // Confirm, then the FHIR example carries each observation's own time; the declined temperature is absent.
 await post(o,{type:'confirmVisit',visitId:vid,version:version()});
 const fhir=await get(o,`/api/fhir/${vid}?organisationId=${org}`),obs=fhir.entry.map(e=>e.resource);
 check(()=>{const w=obs.find(r=>r.id===`${vid}-weight`);assert.equal(w.effectiveDateTime,new Date(earlier+'Z').toISOString());assert.ok(w.method);});
 check(()=>{const bp=obs.find(r=>r.id===`${vid}-bp`);assert.equal(bp.effectiveDateTime,new Date(visitAt+'Z').toISOString());assert.match(bp.note[0].text,/measured \(visit-level\)/);});
 check(()=>assert.equal(obs.some(r=>r.id===`${vid}-temperature`),false));
 // Field sync accepts per-measurement entries and applies the same checks.
 const p=o.state.people.find(x=>x.id===pid);const prep=await post(o,{type:'prepareFieldVisit',personId:pid,version:p.version});const lease=prep.result.packet.payload;
 await post(o,{type:'syncFieldVisit',personId:pid,leaseId:lease.leaseId,packageHash:prep.result.packageHash,facts:{...blank,temperature:'37.2',provenance:{temperature:{source:'not-asked'}}},answers:{},absence:{}},422);
 await post(o,{type:'syncFieldVisit',personId:pid,leaseId:lease.leaseId,packageHash:prep.result.packageHash,facts:{...blank,temperature:'37.2',provenance:{temperature:{source:'measured',at:earlier},weight:{source:'not-asked'}}},answers:{},absence:{}});
 check(()=>assert.deepEqual(o.state.visits.find(v=>v.id===lease.visitId).facts.provenance,{temperature:{source:'measured',at:earlier},weight:{source:'not-asked'}}));
 // Field registration applies the same checks to its first visit.
 const reg={type:'registerFieldPerson',registrationId:crypto.randomUUID(),capturedAt:new Date().toISOString(),name:`Provenance Field ${crypto.randomUUID().slice(0,6)}`,age:25,sex:'Female',village:'Provenance synthetic locality',programme:'General care',teamId:'default'};
 await post(o,{...reg,facts:{...blank,weight:'55',provenance:{weight:{source:'unknown'}}}},422);
 const made=await post(o,{...reg,facts:{...blank,weight:'55',provenance:{weight:{source:'reported',at:earlier}}}});
 check(()=>assert.equal(o.state.visits.find(v=>v.id===made.result.visitId).facts.provenance.weight.source,'reported'));
}
