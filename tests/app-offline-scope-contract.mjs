import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const {appValidateOnlineBook}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('public/field/app-grants.js','utf8')).toString('base64'));
let passed=0;const now=Date.now(),payload={userId:'worker',organisationId:'original-org',personId:'patient',issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+100000).toISOString()},book=()=>({userId:'worker',drafts:[{packet:{payload}}]});
const good={role:'asha',user:{userId:'worker'},organisation:{id:'original-org'},people:[{id:'patient'}]},response=s=>({ok:true,json:async()=>s});let calls=[];
await appValidateOnlineBook(book(),async(path,options)=>{calls.push({path,options});return response(path==='/api/workspace'?good:{delta:good})});assert.equal(calls[1].options.headers['x-saha-organisation'],'original-org');assert.equal(calls[1].options.cache,'no-store');passed++;
for(const status of [401,403,404,500]){await assert.rejects(appValidateOnlineBook(book(),async path=>path==='/api/workspace'?response(good):{ok:false,status}));passed++;}
for(const delta of [{...good,people:[]},{...good,user:{userId:'other'}},{...good,role:'admin'},{...good,organisation:{id:'home-org'}}]){await assert.rejects(appValidateOnlineBook(book(),async path=>response(path==='/api/workspace'?good:{delta})));passed++;}
await appValidateOnlineBook(book(),async()=>{throw new TypeError('Failed to fetch')});passed++;
await appValidateOnlineBook(book(),async path=>{if(path==='/api/workspace')return response(good);throw new TypeError('Failed to fetch')});passed++;
await assert.rejects(appValidateOnlineBook(book(),async()=>({ok:true,json:async()=>{throw Error('invalid JSON')}})));passed++;
mkdirSync('tests/evidence/app-offline-scope',{recursive:true});writeFileSync('tests/evidence/app-offline-scope/contract.json',JSON.stringify({passed,failed:0},null,2)+'\n');console.log({passed});
