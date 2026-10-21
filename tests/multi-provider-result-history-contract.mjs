import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.multi-provider-history-'));let passed=0;const check=(condition,message)=>{assert.ok(condition,message);passed++};
try{
 const source=readFileSync('lib/saha/provider-result-history.ts','utf8');
 writeFileSync(join(dir,'provider-result-history.js'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const H=await import(pathToFileURL(join(dir,'provider-result-history.js')));
 const result=(id,at,provider,model,version,text,review='unreviewed')=>({id,providerId:provider.toLowerCase(),providerName:provider,mode:'demo',status:'succeeded',text,createdAt:at,inputHash:'input-'+id,reviewed:review==='reviewed',providerSnapshot:{id:provider.toLowerCase(),name:provider,mode:'demo',integrationVersion:version,model,contractVersion:'saha-agent-v1'},inputSnapshot:{hash:'input-'+id,visitVersion:version,observedAt:['2026-10-01T09:00','2026-10-01T09:05'],invokedAt:at},outputSnapshot:{hash:'output-'+id,original:text},review:{state:review,...(review==='reviewed'?{by:'worker',at:'2026-10-01T12:00:00.000Z'}:{})}});
 const old=result('old','2026-10-01T10:00:00.000Z','Provider A','model-a-1',4,'Original A','reviewed');
 const newer=result('new','2026-10-01T11:00:00.000Z','Provider B','model-b-2',7,'Original B');
 const legacy={id:'legacy',providerId:'retired',providerName:'Retired provider',mode:'demo',status:'unable_to_assess',text:'Original legacy output',createdAt:'2026-09-01T10:00:00.000Z',inputHash:'legacy-input',reviewed:false};
 const rows=H.providerResultHistory([newer,legacy,old]);
 check(rows.length===3,'keeps every invocation');check(rows[0].id==='legacy','chronological history');check(rows[1].id==='old','old result retained');check(rows[2].id==='new','new result independent');
 check(rows[1].provider==='Provider A','original provider A');check(rows[1].model==='model-a-1','original model A');check(rows[1].integrationVersion===4,'original provider version A');check(rows[1].contractVersion==='saha-agent-v1','contract version A');
 check(rows[2].provider==='Provider B','original provider B');check(rows[2].model==='model-b-2','original model B');check(rows[2].integrationVersion===7,'original provider version B');check(rows[2].originalOutput==='Original B','original output B');
 check(rows[1].originalOutput==='Original A','original output A');check(rows[1].inputHash==='input-old','input hash A');check(rows[1].outputHash==='output-old','output hash A');check(rows[1].observedAt.length===2,'input times A');
 check(rows[1].reviewState==='reviewed','review state A');check(rows[1].reviewedAt==='2026-10-01T12:00:00.000Z','review timestamp A');check(rows[2].reviewState==='unreviewed','review state B');check(rows[2].reviewedAt===null,'unreviewed has no invented time');
 check(rows[0].legacy===true,'legacy labelled');check(rows[0].model==='not retained','legacy model not inferred');check(rows[0].integrationVersion===null,'legacy version not inferred');check(rows[0].outputHash===null,'legacy output hash not invented');check(rows[0].originalOutput==='Original legacy output','legacy output retained');
 const comparison=H.independentComparison([old,newer]);check(comparison.rows.length===2,'comparison includes both');check(comparison.providers.length===2,'providers separate');check(comparison.comparable===false,'no false equivalence');check(comparison.selected===null,'no automatic winner');check(comparison.clinicalUse===false,'no automatic clinical use');
 const core=readFileSync('lib/saha/core.ts','utf8'),ui=readFileSync('app/workspace.tsx','utf8');
 for(const token of ['providerSnapshot','inputSnapshot','outputSnapshot','integrationVersion','contractVersion','observedAt'])check(core.includes(token),'creation retains '+token);
 check(core.includes("r.review={state:'reviewed',by:actor,at:now}"),'review identity and time retained');check(core.includes('already has a review decision'),'duplicate review refused');check(core.includes('Current permission for AI assistance is required.'),'permission refusal retained');check(core.includes("if(i.kind!=='ai')"),'non-AI provider refused');check(core.includes("if(i.mode==='demo')"),'no provider activation added');
 check(ui.includes('exact model and integration version were not retained'),'legacy gap disclosed');check(ui.includes('without treating their outputs as equivalent'),'false equivalence warning');check(ui.includes('outputSnapshot?.original??r.text'),'original output displayed');check(ui.includes('inputSnapshot?.observedAt'),'input timestamps displayed');check(ui.includes('providerSnapshot.model'),'model displayed');
 const record=structuredClone(old);H.providerResultHistory([record]);check(JSON.stringify(record)===JSON.stringify(old),'projection does not mutate result');
 console.log(JSON.stringify({suite:'SAHA-060 multi-provider result history',passed}));
}finally{rmSync(dir,{recursive:true,force:true});}
