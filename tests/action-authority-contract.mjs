import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.action-authority-contract-'));let passed=0;
try{
 for(const f of ['action-authority'])writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {bindActionAuthority,actionAuthorityCurrent}=await import(pathToFileURL(join(dir,'action-authority.js')));
 const now='2026-10-16T05:00:00.000Z';
 const facts={actorId:'reviewer',actorVersion:7,taskId:'message-1',taskVersion:4,evidenceHash:'e'.repeat(64),action:'simulate-contact-attempt',destination:'TEST-RECIPIENT',purpose:'outreach-reminder',capabilityVersions:{template:3,contact:9,policy:'contact-v1'}};
 const approval=await bindActionAuthority(facts,now,60000);
 assert.equal(await actionAuthorityCurrent(approval,facts,'2026-10-16T05:00:59.999Z'),true);passed++;
 for(const [field,value] of [['actorId','other'],['actorVersion',8],['taskId','message-2'],['taskVersion',5],['evidenceHash','f'.repeat(64)],['action','send'],['destination','TEST-OTHER'],['purpose','other']]){assert.equal(await actionAuthorityCurrent(approval,{...facts,[field]:value},now),false);passed++;}
 for(const capabilityVersions of [{...facts.capabilityVersions,template:4},{...facts.capabilityVersions,contact:10},{...facts.capabilityVersions,policy:'contact-v2'}]){assert.equal(await actionAuthorityCurrent(approval,{...facts,capabilityVersions},now),false);passed++;}
 assert.equal(await actionAuthorityCurrent(approval,facts,'2026-10-16T05:01:00.001Z'),false);passed++;
 assert.equal(await actionAuthorityCurrent({...approval,bindingHash:'0'.repeat(64)},facts,now),false);passed++;
 assert.equal(await actionAuthorityCurrent({...approval,destination:'TEST-TAMPERED'},facts,now),false);passed++;
 assert.equal(await actionAuthorityCurrent(undefined,facts,now),false);passed++;
 await assert.rejects(()=>bindActionAuthority(facts,now,0),/positive/);passed++;
 writeFileSync('tests/action-authority-contract-result.json',JSON.stringify({passed,suite:'exact actor, task, evidence, action, destination, purpose, capability version, expiry and tamper binding',completedAt:new Date().toISOString()},null,2)+'\n');
 console.log(`${passed} action authority contract checks passed`);
}finally{rmSync(dir,{recursive:true,force:true});}
