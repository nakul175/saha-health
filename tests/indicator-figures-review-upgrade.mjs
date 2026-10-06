// Run after the exact draft diagnostic and after rebuilding the repaired Worker, on its existing isolated synthetic D1.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {client} from './lib/worker.mjs';import {startMiniflare} from './lib/miniflare.mjs';
const f=JSON.parse(readFileSync('.wrangler/figure-review-upgrade.json','utf8')),w=await startMiniflare({port:9005,name:'figures-review-submission',fresh:false});let passed=0;const check=(v,m)=>{assert.ok(v,m);passed++};
try{
 const api=client(w.base),db=await w.mf.getD1Database('DB');const post=async(who,c,status)=>{const x=await api.call(who,'/api/indicator-figures',{method:'POST',org:f.org,body:c});check(x.status===status,x.text);return x.json};
 const before=await db.prepare('SELECT digest,data FROM indicator_figures WHERE org_id=? AND id=?').bind(f.org,f.publishedId).first();
 check((await api.get(f.o,'/api/indicator-figures?id='+f.publishedId,f.org)).status===200,'Legacy published metadata remains scoped and readable');
 await post(f.o,{type:'view',figureId:f.publishedId},200);
 await post(f.r,{type:'review',figureId:f.draftId,expectedSequence:1,decision:'approve',reason:f.reason},409);
 await post(f.o,{type:'publish',figureId:f.approvedId,expectedSequence:2,reviewId:f.reviewId,reason:f.reason},409);
 await post(f.o,{type:'view',figureId:f.draftId},409);
 const reissue=await post(f.o,{type:'reissue',figureId:f.publishedId,expectedSequence:3,reason:f.reason},200);
 const rows=(await db.prepare('SELECT data FROM indicator_figure_units WHERE org_id=? AND figure_id=?').bind(f.org,reissue.figureId).all()).results;
 check(rows.length===6&&rows.every(r=>JSON.parse(r.data).sourceHashVersion===3),'Reissue captures full new source coverage for all original six');
 const reviewed=await post(f.r,{type:'review',figureId:reissue.figureId,expectedSequence:1,decision:'approve',reason:f.reason},200);
 await post(f.o,{type:'publish',figureId:reissue.figureId,expectedSequence:2,reviewId:reviewed.eventId,reason:f.reason},200);
 const after=await db.prepare('SELECT digest,data FROM indicator_figures WHERE org_id=? AND id=?').bind(f.org,f.publishedId).first();check(JSON.stringify(before)===JSON.stringify(after),'Legacy original bytes and digest survive corrected source coverage reissue');
 mkdirSync('tests/evidence/indicator-figures-review',{recursive:true});writeFileSync('tests/evidence/indicator-figures-review/source-coverage-upgrade.json',JSON.stringify({passed,failed:0,actualWorker:true,actualD1:true,existingD1:true,scope:'Legacy source coverage draft/approved refusal, protected immutable legacy publication and independently reviewed source-version3 reissue on preserved real D1.'},null,2)+'\n');console.log(JSON.stringify({passed,failed:0}));
}finally{await w.stop()}
