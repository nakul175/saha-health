// Slice 5i contract: drift monitoring from shadow comparisons — 7-day periods by visit confirmation date, agreement
// rates over rated fields, flagged drops between consecutive periods with enough rated fields, counts only.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.drift-contract-'));let passed=0;const check=fn=>{fn();passed++};
try{
 for(const file of ['drift'])writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const D=await import(pathToFileURL(join(dir,'drift.js')));
 const now='2026-09-30T10:00:00.000Z',day=n=>new Date(Date.parse('2026-09-30T12:00:00Z')-n*86400000).toISOString();
 // Periods: four 7-day windows ending at the end of the current UTC day.
 const P=D.periods(now);
 check(()=>assert.deepEqual(P.map(p=>[p.from.slice(0,10),p.to.slice(0,10)]),[['2026-09-03','2026-09-10'],['2026-09-10','2026-09-17'],['2026-09-17','2026-09-24'],['2026-09-24','2026-10-01']]));
 // Results: `fields` outcomes per visit; the period is the visit's confirmation date.
 let n=0;const visits=[],results=[];
 const add=(daysAgo,outcomes,status='compared')=>{const id='v'+(n++);visits.push({id,personId:'p',confirmedAt:day(daysAgo)});results.push({visitId:id,personId:'p',visitVersion:1,at:now,status,fields:status==='compared'?outcomes.map((o,i)=>({field:'f'+i,shadow:'1',confirmed:'1',outcome:o})):undefined});};
 // Period 2 (10–16 Sep): 12 rated, 11 agree (91.7%). Period 3 (17–23 Sep): 12 rated, 10 agree (83.3%, -8.4 stable).
 // Period 4 (24–30 Sep): 13 rated, 5 agree (38.5%, -44.8 drop), plus not-recorded, unable and a not-run visit.
 for(let i=0;i<4;i++)add(14,['agreement','agreement','agreement']);
 add(22,['agreement']);
 const p2=results.slice(0,4);p2[0].fields[0].outcome='disagreement';
 for(let i=0;i<4;i++)add(7,['agreement','agreement','agreement']);results[5].fields[0].outcome='missing';results[6].fields[0].outcome='disagreement';
 for(let i=0;i<4;i++)add(1,['agreement','disagreement','missing']);add(1,['not-recorded','unable']);add(2,[],'unable');add(2,[],'not-run');
 // A result whose visit is gone is placed by its comparison time.
 results.push({visitId:'gone',personId:'p',visitVersion:1,at:day(0),status:'compared',fields:[{field:'f0',outcome:'agreement'}]});
 const shadow={id:'sh1',entryId:'cap-2',revision:2,key:'fixture-cap',results};
 const s={workspace:{visits},governance:{entries:[{id:'cap-2',revision:2,state:'reviewed',spec:{key:'fixture-cap',title:'Synthetic capability'}}]}};
 const [row]=D.driftReport(s,[shadow],now);
 check(()=>{assert.equal(row.entryId,'cap-2');assert.equal(row.key,'fixture-cap');assert.equal(row.revision,2);assert.equal(row.title,'Synthetic capability');assert.equal(row.state,'reviewed');});
 check(()=>assert.deepEqual(row.periods.map(p=>[p.visits,p.rated,p.rate]),[[1,1,100],[4,12,91.7],[4,12,83.3],[7,13,38.5]]));
 check(()=>{const p=row.periods[3];assert.deepEqual([p.agreement,p.disagreement,p.missing,p.notRecorded,p.unable],[5,4,4,1,2],'not-recorded and unable are counted, not rated; the not-run visit is not counted');});
 check(()=>assert.deepEqual(row.changes.map(c=>[c.points,c.status]),[[null,'insufficient'],[-8.4,'stable'],[-44.8,'drop']]));
 check(()=>assert.equal(row.status,'drop'));
 check(()=>{const json=JSON.stringify(row);assert.ok(!/"v\d+"|"p"|visitId|personId|confirmed"/.test(json),'no visit, person or value identifiers');});
 // Threshold edges: a drop of exactly 10 points is not flagged; fewer than 10 rated fields is insufficient.
 const mk=(a,b)=>{const vs=[],rs=[];let k=0;const put=(daysAgo,agree,total)=>{for(let i=0;i<total;i++){const id='x'+(k++);vs.push({id,confirmedAt:day(daysAgo)});rs.push({visitId:id,at:now,status:'compared',fields:[{field:'f',outcome:i<agree?'agreement':'disagreement'}]});}};put(7,...a);put(1,...b);return D.driftReport({workspace:{visits:vs},governance:{entries:[]}},[{entryId:'e',revision:1,key:'k',results:rs}],now)[0];};
 check(()=>{const r=mk([10,10],[9,10]);assert.deepEqual(r.changes[2],{from:r.periods[2].from,to:r.periods[3].to,points:-10,status:'stable'});assert.equal(r.status,'stable');});
 check(()=>{const r=mk([10,10],[8,10]);assert.equal(r.changes[2].status,'drop');assert.equal(r.changes[2].points,-20);});
 check(()=>{const r=mk([9,9],[0,9]);assert.equal(r.changes[2].status,'insufficient');assert.equal(r.status,'insufficient','nine rated fields per period are not enough');});
 check(()=>{const r=mk([5,10],[10,10]);assert.equal(r.changes[2].points,50);assert.equal(r.changes[2].status,'stable','a rise is never a drop');});
 check(()=>{const r=mk([10,10],[8,10]);assert.equal(r.title,'k','a revision no longer in governance keeps its key as the label');assert.equal(r.state,'unknown');});
 // Several shadows of the same revision are combined; revisions are separate rows; drops first.
 const two=D.driftReport(s,[shadow,{id:'sh2',entryId:'cap-2',revision:2,key:'fixture-cap',results:[{visitId:'gone',at:day(15),status:'compared',fields:[{field:'f',outcome:'agreement'}]}]},{id:'sh3',entryId:'cap-1',revision:1,key:'fixture-cap',results:[]}],now);
 check(()=>{assert.deepEqual(two.map(r=>[r.entryId,r.status]),[['cap-2','drop'],['cap-1','insufficient']]);assert.equal(two[0].periods[1].visits,5);});
 check(()=>assert.deepEqual(D.driftReport(s,[],now),[],'no shadow, no row'));
 check(()=>assert.match(D.DRIFT_NOTICE,/Nothing is suspended automatically/));
 const result={suite:'Drift monitoring contract (slice 5i)',passed,completedAt:new Date().toISOString()};
 writeFileSync('tests/drift-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
