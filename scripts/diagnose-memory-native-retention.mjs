// Manual macOS-only owned-process diagnostic; never an O-2 release gate.
// No inspector, forced collection, heap tuning, audit omission, or hosted traffic.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {startMiniflare} from '../tests/lib/miniflare.mjs';
import {identity} from '../tests/lib/worker.mjs';
import {processTable,descendantPids,processMemory} from '../tests/lib/process-memory.mjs';
assert.equal(process.platform,'darwin','Native allocation-class inspection requires the macOS heap tool');
const out=process.env.SAHA_NATIVE_MEMORY_EVIDENCE??'tests/evidence/memory-native-retention';
mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url);
const {Miniflare}=await import(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
const wr=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
const result={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),date:new Date().toISOString(),platform:process.platform,architecture:process.arch,nodeVersion:process.version,workerdVersion:require(require.resolve('workerd/package.json',{paths:[require.resolve('wrangler')]})).version,miniflareVersion:require(require.resolve('miniflare/package.json',{paths:[require.resolve('wrangler')]})).version,inspector:false,forcedGc:false,snapshots:false,heapFlags:false,loads:500,concurrency:4,heapCommand:['/usr/bin/heap','--addresses=workerd::DeleteQueue','--noContent','owned workerd PID'],cases:[],limits:['Native heap scans pause the owned process and may alter timing; they do not attach a V8 inspector or request collection.','DeleteQueue count is a native request-graph proxy, not aggregate byte attribution, JS liveness, or per-isolate ownership.','Application and D1 control differ in isolate count and work; neither proves the upstream issue is the sole cause.','Only synthetic local macOS runtime is measured; O-2 plateau and hosted memory acceptance remain open.']};
const save=()=>writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function owned(){const table=processTable(),own=new Set(descendantPids(process.pid,table));const pids=table.filter(r=>own.has(r.pid)&&/(?:^|[\s/])workerd(?:\s|$)/.test(r.command)).map(r=>r.pid);assert.equal(pids.length,1);return {pid:pids[0],rssKb:processMemory(pids[0],table).rss};}
function inspect(phase,completedLoads){const before=owned(),started=Date.now();const raw=execFileSync('/usr/bin/heap',['--addresses=workerd::DeleteQueue','--noContent',String(before.pid)],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});const allocations=[...raw.matchAll(/^0x[0-9a-f]+: workerd::DeleteQueue \((\d+) bytes\)$/gm)];assert.match(raw,/Active blocks in all zones that match pattern/,'Heap visibility unavailable');assert.ok(allocations.length,'No countable DeleteQueue allocations: do not interpret as zero');const after=owned();assert.equal(before.pid,after.pid);return {phase,completedLoads,rssBeforeKb:before.rssKb,rssAfterKb:after.rssKb,scanDurationMs:Date.now()-started,deleteQueueCount:allocations.length,deleteQueueAllocationBytes:allocations.reduce((sum,m)=>sum+Number(m[1]),0),physicalFootprint:raw.match(/^Physical footprint:\s+([^\n]+)/m)?.[1]?.trim()??null,totalMallocNodes:Number(raw.match(/All zones: (\d+) nodes malloced/)?.[1]??NaN),mallocSizeDistribution:raw.match(/^All zones:.*$/m)?.[0]??null};}
async function burst(m,path,n,headers,expectedCount){let i=0;await Promise.all(Array.from({length:4},async()=>{while(i++<n){const r=await fetch(m.base+path,{headers});assert.equal(r.status,200);const body=await r.arrayBuffer();if(expectedCount!==undefined)assert.equal(JSON.parse(new TextDecoder().decode(body)).count,expectedCount);}}));}
for(const name of ['saha-workspace','inline-d1-read-batch']){
 const row={name,phases:[],successfulLoads:0};result.cases.push(row);let m;
 try{
  if(name==='saha-workspace')m=await startMiniflare({port:8969,name:'o2-native-retention-app',bindings:{SAHA_ENVIRONMENT:'synthetic'}});
  else{const script=`export default {async fetch(req,env){const queries=Array.from({length:23},(_,i)=>env.DB.prepare(i===0?'SELECT * FROM fixture LIMIT 250':'SELECT * FROM fixture WHERE id<0'));const rows=await env.DB.batch(queries);return Response.json({count:rows[0].results.length})}}`;const mf=new Miniflare({modules:true,script,host:'127.0.0.1',port:8969,compatibilityDate:wr.compatibility_date,compatibilityFlags:wr.compatibility_flags,d1Databases:{DB:'o2-native-d1'},d1Persist:'.wrangler/o2-native-d1'});await mf.ready;m={base:'http://127.0.0.1:8969',stop:()=>mf.dispose()};const db=await mf.getD1Database('DB');await db.prepare('DROP TABLE IF EXISTS fixture').run();await db.prepare('CREATE TABLE fixture(id INTEGER PRIMARY KEY, detail TEXT)').run();await db.batch(Array.from({length:250},(_,i)=>db.prepare('INSERT INTO fixture VALUES(?,?)').bind(i,'Synthetic no-patient audit-sized fixture '.repeat(13))));row.queriesPerLoad=23;row.rowsPerLoad=250;}
  const app=name==='saha-workspace',path=app?'/api/workspace':'/',headers=app?identity('owner').headers:undefined,expected=app?undefined:250;
  for(const [phase,n] of [['warm100',100],['total250',150],['total500',250]]){await burst(m,path,n,headers,expected);row.successfulLoads+=n;await pause(1000);row.phases.push(inspect(phase,row.successfulLoads));save();console.log(name,phase,JSON.stringify(row.phases.at(-1)));}
  await pause(20000);row.phases.push(inspect('idle20s',row.successfulLoads));row.completed=true;save();console.log(name,'idle20s',JSON.stringify(row.phases.at(-1)));
 }finally{await m?.stop();save();}
}
result.completed=true;save();
