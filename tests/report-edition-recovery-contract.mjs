import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
// Execute the actual exported request function with controlled collaborators.
// This isolates recovery bounds/error classification; it is not an HTTP/D1 authority test.
const server=readFileSync('lib/saha/indicator-figures-server.ts','utf8');
const core=readFileSync('lib/saha/core.ts','utf8');
const errorSource=core.slice(core.indexOf('export class AppError'),core.indexOf('export const uuid'));
const handlerSource=server.slice(server.indexOf('export async function figurePost'));
const js=ts.transpileModule(errorSource+'\n'+handlerSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/export /g,'');
const factory=new Function('context','protectedView','readFigure','schema','boundedJsonBody',js+'\nreturn {figurePost,AppError};');
let passed=0;const check=(actual,expected)=>{assert.deepEqual(actual,expected);passed++;};
const initial={org:'synthetic-org',u:{userId:'synthetic-viewer'},s:{revision:0},m:{version:1}};
const req=()=>new Request('http://synthetic.invalid/api/indicator-figures',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'view',figureId:'synthetic-figure'})});
const message='Current edition disclosure authority changed. Nothing was shown.';
async function scenario(kind){
 const calls={context:0,view:0,figure:0};const seen=[];let api;
 const context=async()=>{const n=calls.context++;if(n&&kind==='revoked')throw new api.AppError(403,'Inactive membership');return {...initial,u:{userId:n&&kind==='actor-change'?'different-viewer':initial.u.userId},org:n&&kind==='org-change'?'different-org':initial.org,s:{revision:n},m:{version:n+1}};};
 const readFigure=async(s,id)=>{calls.figure++;check(id,'synthetic-figure');return {revision:s.revision};};
 const protectedView=async(s,u,m,l)=>{calls.view++;seen.push({revision:s.revision,member:m.version,figure:l.revision,actor:u.userId});
  if(kind==='success-first'||kind==='success-second'&&calls.view===2)return {safe:true};
  if(kind==='ordinary-error')throw new Error(message);
  if(kind==='spoof')throw Object.assign(new Error(message),{status:409});
  if(kind==='other-409')throw new api.AppError(409,'Figure evidence failed its integrity check. Nothing was shown.');
  if(kind==='same-message-403')throw new api.AppError(403,message);
  if(kind==='privacy')throw new api.AppError(422,'Unsafe comparison');
  throw new api.AppError(409,message);
 };
 api=factory(context,protectedView,readFigure,{safeParse:c=>({success:true,data:c})},r=>r.json());
 let result,error;try{result=await api.figurePost(req());}catch(e){error=e;}
 return {calls,seen,result,error};
}
let r=await scenario('success-first');check(r.result,{safe:true});check(r.calls,{context:1,view:1,figure:1});
r=await scenario('success-second');check(r.result,{safe:true});check(r.calls,{context:2,view:2,figure:2});check(r.seen.map(x=>[x.revision,x.member,x.figure]),[[0,1,0],[1,2,1]]);
r=await scenario('persistent');check(r.result,undefined);check(r.error.status,409);check(r.error.message,message);check(r.calls,{context:3,view:3,figure:3});
for(const kind of ['ordinary-error','spoof','other-409','same-message-403','privacy']){r=await scenario(kind);check(r.result,undefined);check(r.calls,{context:1,view:1,figure:1});check(Boolean(r.error),true);}
for(const kind of ['actor-change','org-change','revoked']){r=await scenario(kind);check(r.result,undefined);check(r.error.status,403);check(r.calls,{context:2,view:1,figure:1});}
mkdirSync('tests/reports',{recursive:true});writeFileSync('tests/reports/report-edition-recovery-contract.json',JSON.stringify({passed,failed:0,scope:'Actual transpiled figurePost request function; controlled dependency outcomes; distinct from real HTTP/D1 controls; no domain approval'},null,2)+'\n');console.log(JSON.stringify({passed,failed:0}));
