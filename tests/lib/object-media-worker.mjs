// Independent built Worker with ONLY a local private R2 binding; no remote bucket.
import {createRequire} from 'node:module';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {freshDatabase} from './worker.mjs';
export async function objectMediaWorker({port=9052,name='object-media',storage=true}={}){
 const dir=readdirSync('node_modules/.pnpm').filter(x=>x.startsWith('miniflare@')).sort().at(-1),{Miniflare}=createRequire(resolve('node_modules/.pnpm',dir,'node_modules/miniflare/package.json'))('miniflare');
 const cfg=JSON.parse(readFileSync('dist/server/wrangler.json','utf8')),state=resolve('.wrangler/'+name+'-state');freshDatabase(state);
 const walk=d=>readdirSync(d).flatMap(n=>{const p=join(d,n);return statSync(p).isDirectory()?walk(p):[p]});
 const mf=new Miniflare({modules:walk('dist/server').filter(p=>/\.m?js$/.test(p)).sort((a,b)=>a==='dist/server/index.js'?-1:b==='dist/server/index.js'?1:a.localeCompare(b)).map(path=>({type:'ESModule',path})),modulesRoot:'dist/server',compatibilityDate:cfg.compatibility_date,compatibilityFlags:cfg.compatibility_flags,host:'127.0.0.1',port,d1Databases:{DB:cfg.d1_databases[0].database_id},d1Persist:join(state,'v3/d1'),r2Buckets:['BUCKET'],r2Persist:join(state,'r2'),bindings:{SAHA_ENVIRONMENT:'synthetic',SAHA_EXTERNAL_APIS_ENABLED:'false',...(storage?{SAHA_MEDIA_STORAGE:'r2-private-v1'}:{})},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}}});await mf.ready;return {mf,base:`http://127.0.0.1:${port}`,stop:()=>mf.dispose()};
}
