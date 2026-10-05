// Current CSV parser checks indicator blocks, preserving all original privacy assertions; four-column completeness metadata is not a clinical count.
import assert from 'node:assert/strict';
import {coherentReportingFixture} from './lib/privacy-api-coherent-fixture.mjs';
import { createHash } from 'node:crypto';
// Slice 6s: owner-maintained indicator registry, reproduction by version, differencing protection and the
// suppressed CSV, through the built Worker and local D1. Runs last: it adds definitions to the shared organisation.
export async function indicatorRegistrySmoke({get,post,check,accounts,org,sql,base}){
 const coherent=await coherentReportingFixture({get,post,check},'registry',{defaultTeam:true});accounts=coherent.accounts;org=coherent.org;
 const {owner:o,worker:w,supervisor:sup,stranger:x}=accounts;
 // Slice 6aa: differencing now compares every release of the viewer's last seven days through the people behind it,
 // across groupings and windows, so the shared supervisor's earlier indicator queries (indicators and reuse smokes, other
 // windows) correctly withhold some of these results. The registry checks run as a fresh supervisor of the same team, so
 // they test the registry and not the earlier smokes' query history; the assertions are unchanged.
 const s={id:`${sup.id}-registry`,headers:{...sup.headers,'oai-authenticated-user-id':`${sup.id}-registry`},state:null};
 await get(s);{const inv=(await post(o,{type:'createInvite',accountCode:s.state.user.accountCode,label:'Registry supervisor',role:'supervisor',teamIds:['default']},200,crypto.randomUUID(),org)).result;await post(s,{type:'joinOrganisation',token:inv.token});}
 const ask=async(who,body,status=200,orgId=org)=>{const r=await fetch(`${base}/api/indicators`,{method:'POST',headers:{...who.headers,'Content-Type':'application/json','x-saha-organisation':orgId},body:JSON.stringify(body)});const text=await r.text();const j=(r.headers.get('content-type')??'').includes('json')?JSON.parse(text):text;check(()=>assert.equal(r.status,status,text.slice(0,300)));return {j,r};};
 const as=(who,body,status=200)=>post(who,body,status,crypto.randomUUID(),org);
 const release=async(result)=>{const reviewed=await as(s,{type:'reviewIndicatorDefinition',id:result.id,expectedVersion:result.version,expectedGovernanceVersion:result.governanceVersion,decision:'approve',reason:'Independent registry smoke definition review'});const effectiveAt=new Date(Date.now()+500).toISOString();await as(o,{type:'releaseIndicatorDefinition',id:result.id,expectedVersion:result.version,expectedGovernanceVersion:reviewed.result.governanceVersion,reviewEventId:reviewed.result.eventId,effectiveAt,reason:'Reviewed synthetic smoke dated release'});while(Date.now()<Date.parse(effectiveAt))await new Promise(r=>setTimeout(r,20));};
 const tag=crypto.randomUUID().slice(0,6),id=`smoke-${tag}`;
 const spec=(over={})=>({title:`Visits ${tag}`,unit:'count',numerator:'visits-confirmed',denominator:null,filters:{},exclude:[],exclusionsNote:'Voided and superseded visits',owner:'Programme manager',cadence:'Weekly',minimumCohort:5,...over});
 // Catalogue: built-ins are version 1 registry entries; only owners may maintain.
 const cat=(await ask(o,{})).j,supCat=(await ask(s,{})).j;
 check(()=>{assert.ok(cat.registry.filter(r=>r.builtIn).length===12&&cat.registry.filter(r=>r.builtIn).every(r=>r.version===1&&r.by==='Saha release'));assert.ok(cat.vocabulary.measures.some(m=>m.id==='patients'));assert.deepEqual(cat.vocabulary.exclusions,['identity-provisional','no-programme']);assert.equal(cat.canMaintain,true);assert.equal(supCat.canMaintain,false);});
 const add={type:'addIndicatorDefinition',id,spec:spec(),reason:'Weekly visit count for the smoke review'};
 await as(s,add,403);await as(w,add,403);
 await as(o,{...add,spec:spec({numerator:'patient-names'})},422);await as(o,{...add,spec:{...spec(),sql:'select 1'}},422);await as(o,{...add,spec:spec({unit:'proportion'})},422);
 const added=await as(o,add);await as(o,{...add,reason:'Second attempt at the same identifier'},409);
 check(()=>{assert.equal(added.result.id,id);assert.equal(added.result.version,1);assert.equal(added.result.status,'proposed');});await ask(s,{ids:id,days:30,group:'none'},422);await release(added.result);
 // Results name the definition and version used; an earlier result is reproduced from its version.
 const first=(await ask(s,{ids:id,days:30,group:'none'})).j;
 check(()=>{const r=first.results[0];assert.equal(r.id,id);assert.equal(r.version,1);assert.equal(r.definition.version,1);assert.match(r.definition.canonical,/"numerator":"visits-confirmed"/);assert.ok(Array.isArray(r.rows)&&r.rows.length===1);});
 await as(o,{type:'reviseIndicatorDefinition',id,expectedVersion:2,spec:spec(),reason:'Stale version must be refused'},409);
 await release((await as(o,{type:'reviseIndicatorDefinition',id,expectedVersion:1,spec:spec({minimumCohort:1000}),reason:'Raise the minimum cohort for this definition'})).result);
 const now=(await ask(s,{ids:id,days:30,group:'none'})).j.results[0],again=(await ask(s,{ids:`${id}@1`,days:30,group:'none'})).j.results[0];
 check(()=>{assert.equal(now.version,2);assert.equal(now.refused,'cohort');assert.deepEqual(now.rows,[]);assert.equal(again.version,1);assert.deepEqual(again.rows,first.results[0].rows,'version 1 reproduces the earlier result');});
 await release((await as(o,{type:'retireIndicatorDefinition',id,expectedVersion:2,reason:'Replaced by the programme dashboard'})).result);
 const retired=(await ask(s,{ids:id,days:30,group:'none'},422)).j;check(()=>assert.match(retired.error,/retired/));
 await ask(s,{ids:`${id}@1`,days:30,group:'none'});
 const afterCat=(await ask(s,{})).j;check(()=>{assert.ok(!afterCat.catalogue.some(d=>d.id===id));assert.deepEqual(afterCat.registry.filter(r=>r.id===id).map(r=>[r.version,r.status]),[[1,'active'],[2,'active'],[3,'retired']]);});
 const audit=sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action=? AND subject=?').get(org,'indicatorDefinition',id);check(()=>assert.equal(Number(audit.n),9));
 // The ledger is hashes and counts: no village names in the operations row, and it is not returned to operators.
 const data=JSON.parse(sql.prepare('SELECT data FROM operations WHERE org_id=?').get(org).data);
 check(()=>{assert.ok(data.indicatorReleases.length>0);const text=JSON.stringify(data.indicatorReleases);for(const v of cat.villages)assert.ok(!text.includes(v),'no village names in the ledger');assert.ok(!text.includes(s.id),'no viewer identifier in the ledger');});
 const opsRead=await fetch(`${base}/api/operations`,{headers:{...o.headers,'x-saha-organisation':org}}).then(r=>r.json());check(()=>assert.ok(opsRead.operations&&!('indicatorReleases' in opsRead.operations)));
 // CSV of indicator results carries the suppression and names each definition version.
 // Slice 6aa: the export runs as another fresh supervisor, so this file shows suppression on its own and not differencing
 // against the registry queries above (their 30-day total minus these village cells is checked and can be withheld).
 const sc={id:`${sup.id}-export`,headers:{...sup.headers,'oai-authenticated-user-id':`${sup.id}-export`},state:null};
 await get(sc);{const inv=(await post(o,{type:'createInvite',accountCode:sc.state.user.accountCode,label:'Export supervisor',role:'supervisor',teamIds:['default']},200,crypto.randomUUID(),org)).result;await post(sc,{type:'joinOrganisation',token:inv.token});}
 const {j:csv,r:csvRes}=await ask(sc,{ids:'visits-confirmed,patients-seen',days:90,group:'village',format:'csv'});
 check(()=>{assert.match(csvRes.headers.get('content-type'),/text\/csv/);assert.match(csv,/^"Indicator","visits-confirmed","Version","1",/m);const rows=csv.trim().split(/\r?\n/).map(l=>l.split(',').map(c=>c.replace(/^"|"$/g,'')));let inData=false;const cells=[];for(const row of rows){if(row[0]==='Indicator'){inData=false;continue;}if(row[0]==='Group'){inData=true;continue;}if(row[0]==='Manifest'||row[0]==='Withheld'){inData=false;continue;}if(inData){assert.equal(row.length,4,'each indicator data row preserves four columns');cells.push(...row.slice(1));}}assert.ok(rows.some(row=>row[0]==='Source completeness'),'completeness metadata remains present');assert.ok(cells.length>0);assert.ok(cells.every(v=>v==='suppressed'||v===''||Number(v)===0||Number(v)>=5||/\./.test(v)),'no shown count from 1 to 4');});
 // Slice 6s-2: the indicator CSV names its export and ends with a manifest a receiver can check; the export is audited.
 const lines=csv.split('\r\n');if(lines.at(-1)==='')lines.pop();const body=lines.slice(0,-2),trailer=lines.slice(-2),digest=createHash('sha256').update(body.map(l=>l+'\r\n').join('')).digest('hex'),exportId=csvRes.headers.get('x-saha-export-id');
 check(()=>{assert.equal(trailer[0],`"Manifest","Data rows","${body.length}"`);assert.equal(trailer[1],`"Manifest","Content SHA-256","${digest}"`);assert.equal(csvRes.headers.get('x-saha-content-sha256'),digest);assert.match(exportId,/^[0-9a-f-]{36}$/);assert.ok(body.includes(`"Export identifier","${exportId}"`));assert.ok(body.some(l=>l.startsWith('"Generated by",')));});
 const exported=sql.prepare('SELECT detail,actor_id FROM audit_events WHERE org_id=? AND action=? AND subject=?').get(org,'indicatorExport',exportId);
 check(()=>{assert.ok(exported,'export audited');assert.equal(exported.actor_id,sc.id);assert.ok(exported.detail.includes(digest)&&exported.detail.includes('visits-confirmed v1')&&exported.detail.includes(`${body.length} data rows`));for(const v of cat.villages)assert.ok(!exported.detail.includes(v),'no village names in the audit line');});
 // Differencing in an organisation of known shape: 7 people in one village and 2 in another.
 const own=(await post(x,{type:'createOrganisation',name:`Differencing ${tag}`})).result.organisationId;
 for(let i=0;i<9;i++)await post(x,{type:'createPerson',name:`Difference Synthetic ${tag} ${String.fromCharCode(65+i)}${i}`,age:20+i*5,sex:'Female',village:i<7?`Diff North ${tag}`:`Diff South ${tag}`,programme:'General care',teamId:'default'},200,crypto.randomUUID(),own);
 const total=(await ask(x,{ids:'visits-confirmed',days:30,group:'none'},200,own)).j;check(()=>assert.equal(total.cohort.people,9));
 const north=(await ask(x,{ids:'visits-confirmed',days:30,group:'none',village:`Diff North ${tag}`},422,own)).j;check(()=>assert.match(north.error,/fewer than 5 people/));
 const south=(await ask(x,{ids:'visits-confirmed',days:30,group:'none',village:`Diff South ${tag}`},422,own)).j;check(()=>assert.match(south.error,/cohort has fewer than 5/));
 const same=(await ask(x,{ids:'patients-seen',days:30,group:'none'},200,own)).j;check(()=>assert.equal(same.cohort.people,9,'the same filters remain available'));
 // Another viewer's ledger is separate: the supervisor of the shared organisation is unaffected.
 await ask(s,{ids:'visits-confirmed',days:30,group:'none'});
}
