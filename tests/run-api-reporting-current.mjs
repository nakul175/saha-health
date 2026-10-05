// Current reporting API wrapper; original API driver is preserved.
import {fixture} from './database-fixtures.mjs';
globalThis.sahaLegacyFixture=fixture();
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { connect } from 'node:net';
// Keep the built Worker and its dev registry separate from the supervised UI preview.
const isolated=mkdtempSync(join(tmpdir(),'saha-api-worker-'));cpSync('dist',join(isolated,'dist'),{recursive:true});
// The port can be set with SAHA_TEST_PORT so several worktrees can run the suite at once.
const PORT=process.env.SAHA_TEST_PORT??'8787';process.env.SAHA_TEST_ORIGIN??=`http://127.0.0.1:${PORT}`;
// Slice 10k: the local dev runtime keeps request data for its inspector, so the Worker's heap grows with every request
// (about 270 KB per workspace load locally; Miniflare without an inspector grew about 40 KB). With slices 10a–10j
// the suite crossed the local 1.4 GB heap limit, so the Worker is restarted on the same persisted D1 state between groups of
// modules (globalThis.sahaRecycleWorker, called from api-smoke.mjs). Its console output is kept across restarts for 6l.
let output='',server=null;
globalThis.sahaWorkerOutput=()=>output;
const free=()=>new Promise(r=>{const c=connect(+PORT,'127.0.0.1');c.once('connect',()=>{c.destroy();r(false)});c.once('error',()=>r(true));});
function launch(){return new Promise(async(ready,failed)=>{
 for(let i=0;i<40&&!(await free());i++)await new Promise(r=>setTimeout(r,250));
 const proc=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config',join(isolated,'dist/server/wrangler.json'),'--local','--persist-to',resolve('.wrangler/test-state'),'--name','saha-api-tests','--var','SAHA_DEMONSTRATION_PACKAGE:manual','--ip','127.0.0.1','--port',PORT,'--inspector-port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_REGISTRY_PATH:join(isolated,'registry'),MINIFLARE_REGISTRY_PATH:join(isolated,'miniflare')}});
 const from=output.length;let done=false;
 const timer=setTimeout(()=>{if(!done){done=true;proc.kill('SIGTERM');failed(new Error('Worker did not start'))}},45000);
 const consume=chunk=>{output+=chunk.toString();if(!done&&output.indexOf('Ready on',from)>=0){done=true;clearTimeout(timer);ready(proc)}};
 proc.stdout.on('data',consume);proc.stderr.on('data',consume);
 proc.on('exit',()=>{clearTimeout(timer);if(!done){done=true;failed(new Error('Worker exited before it was ready'))}});
});}
const stop=proc=>new Promise(r=>{if(!proc||proc.exitCode!==null||proc.signalCode)return r();proc.once('exit',()=>r());proc.kill('SIGTERM');});
let recycled=0;
globalThis.sahaRecycleWorker=async()=>{await stop(server);server=await launch();recycled++;};
try{server=await launch();await import('./api-reporting-current.mjs');if(recycled)console.log(`Worker restarted ${recycled} times on the same D1 state.`);}
catch(e){console.error(e);console.error(output.slice(-3500));process.exitCode=1}
finally{await stop(server);rmSync(isolated,{recursive:true,force:true})}
