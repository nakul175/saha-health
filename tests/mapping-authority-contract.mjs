import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.mapping-authority-'));
let passed=0;
const check=fn=>{fn();passed++;};

try{
  writeFileSync(join(dir,'mis.js'),ts.transpileModule(readFileSync('lib/saha/mis.ts','utf8'),{
    compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
  }).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
  writeFileSync(join(dir,'types.js'),`export const PROGRAMMES=['General care'];export const currentIdentifiers=()=>[];`);
  writeFileSync(join(dir,'core.js'),`import {createHash} from 'node:crypto';export const digest=async v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');export const uuid=()=>crypto.randomUUID();export function fail(status,message){throw Object.assign(new Error(message),{status});}export const person=(w,id)=>w.people.find(x=>x.id===id);export const visit=(w,id)=>w.visits.find(x=>x.id===id);`);
  const {configureMis,misSchema}=await import(pathToFileURL(join(dir,'mis.js')));
  const u={userId:'owner',displayName:'Synthetic owner'};
  const m={userId:'owner',displayName:'Synthetic owner',status:'active',isOwner:true,role:'clinician',version:4,teamIds:['team-a']};
  const i={id:'mis',name:'Synthetic mapping',version:2,status:'active',kind:'mis',mode:'http',programmes:['General care'],mis:{contract:'saha-mis-v1',mapping:[{source:'weight',target:'kg',required:true}],corrections:false}};
  const s={organisation:{id:'org'},members:[m],workspace:{integrations:[i],people:[],visits:[],submissions:[],audit:[]}};
  const base=()=>({integrationId:i.id,version:i.version,lifecycleVersion:i.mis.lifecycle?.version??0});
  const run=(type,extra={})=>configureMis(s,misSchema.parse({type,...base(),...extra}),u,m,{});
  const manifest={mapping:[{source:'weight',target:'weight_kg',required:true}],programmes:['General care'],corrections:false,source:{reference:'synthetic-destination-contract',version:'2'},terminology:[],effectiveAt:'2020-01-01T00:00:00.000Z'};
  const draft=await run('draftMisMapping',manifest);
  let impact=await run('impactMisMapping',{revisionId:draft.revisionId});
  await run('reviewMisMapping',{revisionId:draft.revisionId,impactHash:impact.impactHash});
  check(()=>assert.equal(i.mis.lifecycle.events.at(-1).memberVersion,4));

  // An assignment/authority edit invalidates the old dry-run and review, even while the person remains an owner.
  m.version=5;m.teamIds=['team-b'];
  await assert.rejects(()=>run('applyMisMapping',{revisionId:draft.revisionId,impactHash:impact.impactHash}),/authority or assignment changed/);passed++;
  check(()=>{assert.equal(i.version,2);assert.equal(i.status,'active');assert.equal(i.mis.mapping[0].target,'kg')});

  impact=await run('impactMisMapping',{revisionId:draft.revisionId});
  await run('reviewMisMapping',{revisionId:draft.revisionId,impactHash:impact.impactHash});
  await run('applyMisMapping',{revisionId:draft.revisionId,impactHash:impact.impactHash});
  check(()=>{assert.equal(i.version,3);assert.equal(i.status,'suspended');assert.equal(i.mis.mapping[0].target,'weight_kg')});
  check(()=>assert.equal(i.mis.lifecycle.events.at(-1).memberVersion,5));
  console.log({passed,failed:0});
} finally {
  rmSync(dir,{recursive:true,force:true});
}
