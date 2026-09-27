import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const handlers={},stored=new Map(),deleted=[];let fetches=0,offline=false,redirect=false;const origin='https://synthetic.example';
const key=x=>typeof x==='string'?new URL(x,origin).href:x.url;
const cache={put:async(k,v)=>stored.set(key(k),v.clone()),match:async k=>stored.get(key(k))?.clone()};
const ctx=vm.createContext({URL,Response,Promise,Error,self:{location:{origin},addEventListener:(e,fn)=>handlers[e]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>cache,keys:async()=>['saha-field-shell-v0','unrelated-cache'],delete:async k=>deleted.push(k)},fetch:async()=>{fetches++;if(offline)throw Error('Disconnected');return redirect?Response.redirect(origin+'/signin',302):new Response('Public shell only',{headers:{'Content-Type':'text/html'}})}});
vm.runInContext(readFileSync('public/field/sw.js','utf8'),ctx);let passed=0;const check=fn=>{fn();passed++};
async function life(name){let p;handlers[name]({waitUntil:x=>p=x});await p;}
await life('install');check(()=>assert.equal(stored.size,4));await life('activate');check(()=>assert.deepEqual(deleted,['saha-field-shell-v0']));
for(const path of ['/api/workspace','/api/commands','/','/signout-with-chatgpt','/field/index.html?account=other']){let intercepted=false;handlers.fetch({request:new Request(origin+path),respondWith:()=>intercepted=true});check(()=>assert.equal(intercepted,false));}
let response;offline=true;handlers.fetch({request:new Request(origin+'/field/index.html'),respondWith:r=>response=r});check(()=>assert.ok(response));assert.equal(await (await response).text(),'Public shell only');passed++;
offline=false;redirect=true;await assert.rejects(()=>life('install'),/Shell unavailable/);passed++;
check(()=>assert.equal(stored.size,4));
writeFileSync('tests/field-shell-result.json',JSON.stringify({passed,at:new Date().toISOString(),coverage:'Injected service-worker event/cache transport: only four static shell assets cached, API/auth excluded, disconnected fallback, failed install rejects redirects. Not a browser service-worker test.'},null,2));console.log(`${passed} offline shell policy checks passed`);
