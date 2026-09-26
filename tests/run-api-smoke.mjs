import {fixture} from './database-fixtures.mjs';
globalThis.sahaLegacyFixture=fixture();
import { spawn } from 'node:child_process';
const server=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/test-state','--ip','127.0.0.1','--port','8787','--inspector-port','0'],{stdio:['ignore','pipe','pipe']});
let started=false,output='';
const timeout=setTimeout(()=>{console.error('Worker did not start',output.slice(-3000));server.kill('SIGTERM');process.exitCode=1},45000);
async function consume(chunk){output+=chunk.toString();if(output.includes('Ready on')&&!started){started=true;clearTimeout(timeout);try{await import('./api-smoke.mjs')}catch(e){console.error(e);console.error(output.slice(-3500));process.exitCode=1}finally{server.kill('SIGTERM')}}}
server.stdout.on('data',consume);server.stderr.on('data',consume);server.on('exit',()=>clearTimeout(timeout));
