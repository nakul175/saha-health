import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.saha-027-'));
let passed=0;const check=fn=>{fn();passed++},refuse=(fn,status=422)=>{try{fn();assert.fail('expected refusal');}catch(e){assert.equal(e.status,status,e.message);passed++;}};
try{
 writeFileSync(join(dir,'core.js'),"export const fail=(status,message)=>{const error=Error(message);error.status=status;throw error};\n");
 writeFileSync(join(dir,'media.js'),ts.transpileModule(readFileSync('lib/saha/media.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {reviewMediaInput,checkMedia,sniff}=await import(pathToFileURL(join(dir,'media.js'))),base={scan:'clean',quality:'acceptable',personMatch:true,retention:'visit-record',note:'Synthetic media checked against the selected encounter.',extractionDrafts:[]},at='2026-10-16T05:00:00.000Z',png=(size=2048)=>{const b=new Uint8Array(size);b.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);return b;};
 check(()=>{assert.equal(sniff(png(),'image/png'),true);checkMedia(png(),'image/png','document-or-card');});
 refuse(()=>checkMedia(png(),'image/jpeg','document-or-card'));refuse(()=>checkMedia(png(100),'image/png','document-or-card'));refuse(()=>checkMedia(png(),'image/png','voice-note'));
 const ok=reviewMediaInput({...base,extractionDrafts:[{field:'weight',value:'52 kg',sourceOffset:'page 1, box 4'}]},'asha-1',at);
 check(()=>assert.deepEqual(ok,{review:{stage:'available',scan:'clean',quality:'acceptable',personMatch:true,retention:'visit-record',note:base.note,by:'asha-1',at},extractionDrafts:[{field:'weight',value:'52 kg',sourceOffset:'page 1, box 4',status:'unconfirmed'}]}));
 for(const change of [{personMatch:false},{scan:'blocked'},{scan:'unavailable'},{quality:'low'},{quality:'unusable'}]){const out=reviewMediaInput({...base,...change},'asha-1',at);check(()=>{assert.equal(out.review.stage,'quarantined');assert.deepEqual(out.extractionDrafts,[]);});refuse(()=>reviewMediaInput({...base,...change,extractionDrafts:[{field:'weight',value:'52',sourceOffset:'p1'}]},'asha-1',at));}
 refuse(()=>reviewMediaInput({...base,scan:'unknown'},'asha-1',at));refuse(()=>reviewMediaInput({...base,quality:'unknown'},'asha-1',at));refuse(()=>reviewMediaInput({...base,personMatch:'yes'},'asha-1',at));refuse(()=>reviewMediaInput({...base,retention:'forever'},'asha-1',at));refuse(()=>reviewMediaInput({...base,note:'short'},'asha-1',at));refuse(()=>reviewMediaInput({...base,extractionDrafts:Array.from({length:21},()=>({field:'x',value:'y',sourceOffset:'z'}))},'asha-1',at));refuse(()=>reviewMediaInput({...base,extractionDrafts:[{field:'',value:'y',sourceOffset:'z'}]},'asha-1',at));
 const server=readFileSync('lib/saha/media-server.ts','utf8'),route=readFileSync('app/api/media/[id]/review/route.ts','utf8'),ui=readFileSync('app/media-panel.tsx','utf8'),partition=readFileSync('lib/saha/partition.ts','utf8'),core=readFileSync('lib/saha/core.ts','utf8');
 check(()=>{assert.match(server,/actorBinding\(request,u,true\)/);assert.match(server,/basis\(initial\.s,u,initial\.v\.id\)/);assert.match(server,/unchanged\(u,initial\.s\.organisation\.id/);assert.match(server,/replay\(u,request,key,hash/);});
 check(()=>{assert.match(server,/did not change clinical facts/);assert.match(server,/extractionDrafts:\[\]/);assert.doesNotMatch(server,/invokeProvider|executeAgent|fetch\(/);});
 check(()=>{assert.match(route,/discardUnreadMedia/);assert.match(route,/reviewMedia/);assert.match(partition,/'reviewMedia'/);});
 check(()=>{assert.match(ui,/Unconfirmed extracted draft/);assert.match(ui,/Wrong-person, unscanned or low-quality media is quarantined/);assert.match(ui,/does not call a provider/);});
 check(()=>{assert.match(core,/mediaPending/);assert.match(core,/Remove uploaded, quarantined or draft-only media before confirming/);});
 console.log(JSON.stringify({suite:'SAHA-027 documents and media review contract',passed,completedAt:new Date().toISOString()}));
}finally{rmSync(dir,{recursive:true,force:true});}
