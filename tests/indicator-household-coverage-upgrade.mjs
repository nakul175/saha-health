import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {identity,client} from './lib/worker.mjs';
import {startMiniflare} from './lib/miniflare.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'tests/evidence/report-household-counting-repair'),state=resolve(root,'.wrangler/report-v2-coverage-upgrade'),fixture=resolve(root,'.wrangler/report-v2-coverage-fixture.json');
const prepare=process.argv.includes('--prepare-v2');let passed=0;const check=(a,b,m)=>{assert.equal(a,b,m);passed++};
const w=await startMiniflare({port:9017,name:'report-v2-coverage-upgrade',state,fresh:prepare});
try{
 const api=client(w.base),db=await w.mf.getD1Database('DB'),reason='Synthetic immutable coverage upgrade independently reviewed';
 const stored=async(org,id)=>JSON.stringify({header:await db.prepare('SELECT * FROM indicator_figures WHERE org_id=? AND id=?').bind(org,id).first(),units:(await db.prepare('SELECT * FROM indicator_figure_units WHERE org_id=? AND figure_id=? ORDER BY person_id').bind(org,id).all()).results});
 if(prepare){
  const owner=identity('coverage-v2-owner'),reviewer=identity('coverage-v2-reviewer'),s=(await api.get(owner,'/api/workspace')).json,org=s.organisation.id,rs=(await api.get(reviewer,'/api/workspace')).json;
  const inv=await api.command(owner,{type:'createInvite',accountCode:rs.user.accountCode,label:'Synthetic coverage reviewer',role:'supervisor',teamIds:['default']},org);check(inv.status,200);check((await api.command(reviewer,{type:'joinOrganisation',token:inv.json.result.token},org)).status,200);
  const post=async(who,body)=>{const r=await api.call(who,'/api/indicator-figures',{method:'POST',org,body});check(r.status,200,r.text);return r.json};
  const body={type:'prepare',query:{ids:['visits-confirmed@1'],days:30,group:'none'},cutoff:new Date().toISOString(),reason},draft=await post(owner,body),approved=await post(owner,body),published=await post(owner,body);
  const approval=await post(reviewer,{type:'review',figureId:approved.figureId,expectedSequence:1,decision:'approve',reason}),pr=await post(reviewer,{type:'review',figureId:published.figureId,expectedSequence:1,decision:'approve',reason});
  await post(owner,{type:'publish',figureId:published.figureId,expectedSequence:2,reviewId:pr.eventId,reason});
  const originals={};for(const id of [draft.figureId,approved.figureId,published.figureId]){originals[id]=await stored(org,id);const units=JSON.parse(originals[id]).units;check(units.length,6);check(units.every(u=>JSON.parse(u.data).sourceHashVersion===2),true,'Fixture must be created by actual source coverage V2 Worker');}
  mkdirSync(dirname(fixture),{recursive:true});writeFileSync(fixture,JSON.stringify({owner,reviewer,org,draft:draft.figureId,approved:approved.figureId,published:published.figureId,reviewId:approval.eventId,originals},null,2)+'\n');
 }else{
  const f=JSON.parse(readFileSync(fixture,'utf8')),post=(who,body)=>api.call(who,'/api/indicator-figures',{method:'POST',org:f.org,body});
  check((await post(f.reviewer,{type:'review',figureId:f.draft,expectedSequence:1,decision:'approve',reason})).status,409,'Old V2 draft cannot receive a new-semantic approval');
  check((await post(f.owner,{type:'publish',figureId:f.approved,expectedSequence:2,reviewId:f.reviewId,reason})).status,409,'Old V2 approved figure cannot be newly published');
  check((await post(f.owner,{type:'view',figureId:f.draft})).status,409,'Unpublished old coverage is not silently shown');
  const old=await post(f.owner,{type:'view',figureId:f.published});check(old.status,200);check(old.json.figure.results[0].rows[0].value,0);
  for(const id of [f.draft,f.approved,f.published])check(await stored(f.org,id),f.originals[id],'Original header/unit bytes preserved');
  const next=await post(f.owner,{type:'reissue',figureId:f.published,expectedSequence:3,reason});check(next.status,200,next.text);const id=next.json.figureId;
  const units=(await db.prepare('SELECT data FROM indicator_figure_units WHERE org_id=? AND figure_id=?').bind(f.org,id).all()).results;check(units.length,6);check(units.every(u=>JSON.parse(u.data).sourceHashVersion===3),true);
  const reviewed=await post(f.reviewer,{type:'review',figureId:id,expectedSequence:1,decision:'approve',reason});check(reviewed.status,200,reviewed.text);
  check((await post(f.owner,{type:'publish',figureId:id,expectedSequence:2,reviewId:reviewed.json.eventId,reason})).status,200);
  const opened=await post(f.owner,{type:'view',figureId:id});check(opened.status,200);check(opened.json.figure.results[0].rows[0].value,0);check(await stored(f.org,f.published),f.originals[f.published]);
 }
 mkdirSync(out,{recursive:true});writeFileSync(resolve(out,prepare?'actual-v2-fixture.json':'actual-v2-upgrade.json'),JSON.stringify({passed,failed:0,actualWorker:true,actualD1:true,existingD1:!prepare,fixtureCreatedWithV2Worker:prepare,scope:prepare?'Actual source-coverage2 public prepare/review/publication creates retained fixture; diagnostic setup, not upgrade qualification.':'Preserved actual V2 D1: refuse stale draft review/publication/view, preserve existing original publication and byte-identical protected material, require independently reviewed V3 reissue.'},null,2)+'\n');console.log(JSON.stringify({passed,failed:0,prepare}));
}finally{await w.stop()}
