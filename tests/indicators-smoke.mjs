import assert from 'node:assert/strict';
// Slice 6d: indicator catalogue and suppressed cohort queries through the built Worker and local D1.
export async function indicatorsSmoke({get,post,check,accounts,org,base}){
 const {owner:o,worker:w,supervisor:s,admin:a,clinician:c}=accounts;
 const read=async(who,q={},status=200)=>{const r=await fetch(`${base}/api/indicators?${new URLSearchParams(q)}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 await read(w,{},403);await read(a,{},403);await read(c,{},403);
 const cat=await read(s);
 check(()=>{assert.equal(cat.catalogue.length,8);assert.equal(cat.minimumCell,5);assert.ok(cat.catalogue.every(d=>d.version&&d.owner&&d.numerator));assert.ok(cat.villages.length>0);});
 await read(o);
 const ids=cat.catalogue.map(d=>d.id).join(',');
 const all=await read(s,{ids,days:'30',group:'none'});
 check(()=>{assert.equal(all.results.length,8);assert.ok(all.cohort.people>=5);assert.ok(all.computedAt);assert.match(all.scope,/suppressed/);});
 const safe=r=>r.suppressed||r.value===null||(r.numerator===0||r.numerator>=5)&&(r.denominator===null||r.denominator===0||r.denominator>=5);
 for(const group of ['village','programme','age-band','team']){const res=await read(s,{ids,days:'90',group});check(()=>assert.ok(res.results.every(x=>x.rows.every(safe)),`${group}: every shown cell is zero or at least five`));}
 await read(s,{ids:'free-sql',days:'30',group:'none'},422);
 await read(s,{ids:'visits-confirmed',days:'0',group:'none'},422);
 await read(s,{ids:'visits-confirmed',days:'30',group:'patient'},422);
 const north=o.state.teams.find(t=>t.name==='North team')?.id;
 if(north)await read(s,{ids:'visits-confirmed',days:'30',group:'none',team:north},403);
 const small=await read(s,{ids:'visits-confirmed',days:'30',group:'none',village:'Rights synthetic locality'},422);
 check(()=>assert.match(small.error,/fewer than 5/));
 const q=await read(s,{question:'Overdue follow-ups by village last 14 days'});
 check(()=>{assert.deepEqual(q.interpretation.ids,['followups-overdue']);assert.equal(q.interpretation.group,'village');assert.equal(q.interpretation.days,14);});
 const none=await read(s,{question:'export every patient phone number'});check(()=>assert.equal(none.interpretation.understood,false));
 await read(w,{question:'overdue follow-ups'},403);
}
