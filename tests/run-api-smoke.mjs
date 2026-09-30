import {fixture} from './database-fixtures.mjs';
globalThis.sahaLegacyFixture=fixture();
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
// Keep the built Worker and its dev registry separate from the supervised UI preview.
const isolated=mkdtempSync(join(tmpdir(),'saha-api-worker-'));cpSync('dist',join(isolated,'dist'),{recursive:true});
// The port can be set with SAHA_TEST_PORT so several worktrees can run the suite at once.
const PORT=process.env.SAHA_TEST_PORT??'8787';process.env.SAHA_TEST_ORIGIN??=`http://127.0.0.1:${PORT}`;
const server=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config',join(isolated,'dist/server/wrangler.json'),'--local','--persist-to',resolve('.wrangler/test-state'),'--name','saha-api-tests','--ip','127.0.0.1','--port',PORT,'--inspector-port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_REGISTRY_PATH:join(isolated,'registry'),MINIFLARE_REGISTRY_PATH:join(isolated,'miniflare')}});
let started=false,output='';
// Slice 6l: the safe-logs smoke inspects what the Worker wrote to its console during the run.
globalThis.sahaWorkerOutput=()=>output;
const timeout=setTimeout(()=>{console.error('Worker did not start',output.slice(-3000));server.kill('SIGTERM');process.exitCode=1},45000);
async function consume(chunk){output+=chunk.toString();if(output.includes('Ready on')&&!started){started=true;clearTimeout(timeout);try{await import('./api-smoke.mjs')}catch(e){console.error(e);console.error(output.slice(-3500));process.exitCode=1}finally{server.kill('SIGTERM')}}}
server.stdout.on('data',consume);server.stderr.on('data',consume);server.on('exit',()=>{clearTimeout(timeout);rmSync(isolated,{recursive:true,force:true})});
