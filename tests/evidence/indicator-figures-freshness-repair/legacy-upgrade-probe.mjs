// Evidence-only: run from repository root against a copied actual pre-repair author72 state.
// Not a registered fresh-database test; no counting records or authority are manufactured.
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startMiniflare} from '../../lib/miniflare.mjs';
import {client} from '../../lib/worker.mjs';
const state=mkdtempSync(join(tmpdir(),'saha-figure-legacy-upgrade-'));
cpSync(process.env.SAHA_LEGACY_FIGURE_STATE??'.wrangler/indicator-figures-state',state,{recursive:true});
const w=await startMiniflare({port:9005,name:'figure-legacy-upgrade',state,fresh:false});let passed=0;
const check=(v,m)=>{assert.ok(v,m);passed++;};
try {
 const db=await w.mf.getD1Database('DB'),api=client(w.base);
 const published=(await db.prepare("SELECT f.* FROM indicator_figures f WHERE EXISTS(SELECT 1 FROM indicator_figure_events e WHERE e.org_id=f.org_id AND e.figure_id=f.id AND e.kind='published') ORDER BY created_at").all()).results;
 check(published.length>=2,'Actual old author lifecycle database has original and reissue publications');
 const values=[];
 for(const f of published){
  const units=(await db.prepare('SELECT data FROM indicator_figure_units WHERE org_id=? AND figure_id=?').bind(f.org_id,f.id).all()).results;
  check(units.length>0&&units.every(x=>JSON.parse(x.data).sourceHashVersion===undefined),'Persisted actual old publication has legacy source coverage');
  const who={id:f.author_id,headers:{'oai-authenticated-user-id':f.author_id,'oai-authenticated-user-email':'figures-owner-'+f.author_id.split('-')[1]+'@example.invalid'}};
  const shown=await api.call(who,'/api/indicator-figures',{method:'POST',org:f.org_id,body:{type:'view',figureId:f.id}});
  check(shown.status===200,shown.text);
  check(shown.json.figure.results[0].rows[0].value===JSON.parse(f.data).result.results[0].rows[0].value,'Legacy original value survives source coverage upgrade');
  const after=await db.prepare('SELECT digest,data FROM indicator_figures WHERE org_id=? AND id=?').bind(f.org_id,f.id).first();
  check(after.data===f.data&&after.digest===f.digest,'Legacy stored figure bytes and digest unchanged');
  const afterUnits=(await db.prepare('SELECT data FROM indicator_figure_units WHERE org_id=? AND figure_id=?').bind(f.org_id,f.id).all()).results;
  check(JSON.stringify(afterUnits)===JSON.stringify(units),'Legacy counting evidence unchanged');
  values.push(shown.json.figure.results[0].rows[0].value);
 }
 check(values.includes(6)&&values.includes(0),'Actual six original and corrected zero remain separately published');
 writeFileSync('tests/evidence/indicator-figures-freshness-repair/legacy-upgrade.json',JSON.stringify({passed,failed:0,actualWorker:true,actualD1:true,source:'Copied actual pre-repair author72 database, unchanged rows',values},null,2)+'\n');
 console.log(JSON.stringify({passed,failed:0,values}));
}finally{await w.stop();rmSync(state,{recursive:true,force:true});}
