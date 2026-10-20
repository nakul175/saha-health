import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.agent-release-'));let passed=0;const check=fn=>{fn();passed++};const rejects=async(fn,re)=>{await assert.rejects(fn,re);passed++};
try{
 writeFileSync(join(dir,'core.js'),`import {createHash,randomUUID} from 'node:crypto';export const uuid=randomUUID;export async function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex')}export function fail(status,message){const e=Error(message);e.status=status;throw e}`);
 {let code=ts.transpileModule(readFileSync('lib/saha/agent-release-control.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;code=code.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,'agent-release-control.js'),code);}
 const x=await import(pathToFileURL(join(dir,'agent-release-control.js'))),hex=n=>n.repeat(64),members=[{userId:'owner',status:'active',isOwner:true,role:'admin',version:1},{userId:'reviewer',status:'active',isOwner:false,role:'clinician',version:1},{userId:'worker',status:'active',isOwner:false,role:'asha',version:1}],state=x.emptyAgentReleaseControl();
 const manifest=(summary='Initial controlled release')=>({capabilityKey:'visit-assistant',prompt:{id:'visit-prompt',version:'1.0.0',sha256:hex('a')},tools:[{id:'read-visit',version:'2.1.0',sha256:hex('b')}],routing:{id:'visit-router',version:'3.0.0',sha256:hex('c')},model:{providerId:'provider-disabled',releaseId:'model-2026-10'},knowledgeSources:[{id:'approved-guidance',version:'4',sha256:hex('d')}],releaseSuite:{id:'agent-release-suite',version:'5',sha256:hex('e')},rollbackCompatibleWith:[],changeSummary:summary});
 const result=(baselineReleaseId=null,baselineResultSha256=null)=>({suiteId:'agent-release-suite',suiteVersion:'5',suiteSha256:hex('e'),baselineReleaseId,baselineResultSha256,resultSha256:hex('f'),total:42,failed:0,regressions:0,passedAt:'2026-10-16T00:00:00.000Z'});
 await rejects(()=>x.proposeAgentRelease(state,members,members[2],manifest(),result()),/owner or administrator/);
 await rejects(()=>x.proposeAgentRelease(state,members,members[0],{...manifest(),prompt:{id:'p',version:'1',sha256:'mutable'}},result()),/immutable version/);
 await rejects(()=>x.proposeAgentRelease(state,members,members[0],manifest(),{...result(),regressions:1}),/no failures or regressions/);
 const first=await x.proposeAgentRelease(state,members,members[0],manifest(),result());check(()=>assert.equal(first.revision,1));
 check(()=>assert.throws(()=>x.reviewAgentRelease(state,members,members[0],first.id,1,'REV-1'),/author cannot/));
 x.reviewAgentRelease(state,members,members[1],first.id,1,'REV-1');const bound1=x.activateAgentRelease(state,members,members[0],first.id,2,'Approved local configuration');check(()=>assert.deepEqual(bound1.tools,['read-visit@2.1.0']));
 const encounter=structuredClone(bound1);check(()=>assert.equal(encounter.manifestHash,first.manifestHash));
 await rejects(()=>x.proposeAgentRelease(state,members,members[0],manifest('Unreviewed alias change'),result(null,null)),/latest release revision/);
 const secondManifest={...manifest('Reviewed prompt and model update'),prompt:{id:'visit-prompt',version:'2.0.0',sha256:hex('1')},model:{providerId:'provider-disabled',releaseId:'model-2026-11'},rollbackCompatibleWith:[first.id]};
 const second=await x.proposeAgentRelease(state,members,members[0],secondManifest,result(first.id,hex('f')));check(()=>assert.equal(second.revision,2));
 check(()=>assert.throws(()=>x.activateAgentRelease(state,members,members[0],second.id,1,'skip review'),/independently reviewed/));
 x.reviewAgentRelease(state,members,members[1],second.id,1,'REV-2');const bound2=x.activateAgentRelease(state,members,members[0],second.id,2,'Approved after regression comparison');check(()=>assert.match(bound2.model,/2026-11/));
 const restored=x.rollbackAgentRelease(state,members,members[0],'visit-assistant',first.id,'Regression detected; restore approved revision');check(()=>assert.equal(restored.releaseId,first.id));check(()=>assert.equal(x.activeAgentRelease(state,members,'visit-assistant').binding.releaseId,first.id));
 // A stale author or reviewer invalidates authority even for a previously approved release.
 members[1].version=2;check(()=>assert.throws(()=>x.activeAgentRelease(state,members,'visit-assistant'),/reviewer authority changed/));
 check(()=>assert.equal(encounter.manifestHash,first.manifestHash));check(()=>assert.equal(state.releases[0].history.some(h=>h.action==='restored'),true));
 mkdirSync('tests/evidence/agent-release-control',{recursive:true});writeFileSync('tests/evidence/agent-release-control/contract.json',JSON.stringify({passed,failed:0,scope:'Immutable prompt/tool/routing/model/knowledge/suite pins; exact regression comparison; independent review and current-authority binding; activation refusal; historical encounter binding; compatible rollback to a previously approved release; configuration-only control with no provider activation.'},null,2)+'\n');console.log(JSON.stringify({passed,failed:0,suite:'SAHA-051 agent release change control'}));
}finally{rmSync(dir,{recursive:true,force:true})}
