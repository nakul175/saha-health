import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.saha-056-'));
let passed=0;
const check=fn=>{fn();passed++};
const rejects=async(fn,pattern)=>{await assert.rejects(fn,pattern);passed++};
try{
 for(const file of (await import('node:fs')).readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){
  const source=readFileSync(join('lib/saha',file),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
  writeFileSync(join(dir,file.replace(/\.ts$/,'.js')),code);
 }
 const A=await import(pathToFileURL(join(dir,'agent.js')));
 const P=await import(pathToFileURL(join(dir,'agent-provider.js')));
 const input='weight 58 kg';
 const output={proposals:[{field:'weight',value:'58',quote:input,start:0,end:input.length}],highlights:[]};
 const provider={id:'custom',name:'Synthetic provider',mode:'http',model:'fixture-v1',version:4,available:true,reason:'fixture'};
 const versionPin={format:'saha-ai-version-pin-v1',capability:null,provider:{id:'custom',release:4},modelRelease:'fixture-v1',agentRelease:A.AGENT_VERSION,prompt:{id:'documentary-evidence',version:'1.2.0'},tool:{contract:'saha-agent-v1',version:1},data:{inputSchema:'saha-documentary-evidence-input-v1',outputSchema:'saha-evidence-v1',version:1},evaluation:null};
 const run={id:'req-056',version:A.AGENT_VERSION,versionPin,task:'extract',input,provider};
 const integration={id:'custom',name:'Synthetic provider',kind:'ai',mode:'http',status:'active',version:4,endpoint:'https://provider.example/agent',credentialBinding:'SAHA_FIXTURE',agentContract:{version:1,model:'fixture-v1'},programmes:[],description:'fixture'};
 const runtime={SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_ALLOWED_ORIGINS:'https://provider.example',SAHA_FIXTURE:'not-a-real-secret'};

 check(()=>P.validateInvocationContract(run));
 check(()=>assert.throws(()=>P.validateInvocationContract({...run,version:'stale'}),e=>e instanceof P.AgentContractError&&/input contract/.test(e.message)));
 check(()=>assert.throws(()=>P.validateInvocationContract({...run,provider:{...provider,version:0}}),e=>e instanceof P.AgentContractError&&/identity or version/.test(e.message)));
 check(()=>assert.throws(()=>P.validateInvocationContract({...run,task:'review'}),e=>e instanceof P.AgentContractError&&/not supported/.test(e.message)));

 let observed;
 const accepted=await P.invokeAgent(run,{},runtime,[integration],async(_url,init)=>{observed=JSON.parse(init.body);return Response.json(output)});
 check(()=>assert.equal(accepted.output.proposals[0].value,'58'));
 check(()=>assert.deepEqual({contract:observed.contract,requestId:observed.requestId,agentVersion:observed.agentVersion,providerVersion:observed.providerVersion,model:observed.model,responseMode:observed.responseMode,media:observed.media,limits:observed.limits},{contract:'saha-agent-v1',requestId:'req-056',agentVersion:A.AGENT_VERSION,providerVersion:4,model:'fixture-v1',responseMode:'synchronous',media:{request:'application/json',response:'application/json',binary:'unsupported'},limits:{maxOutputTokens:1400,maxCalls:1,maxResponseBytes:64000}}));
 check(()=>assert.equal('tools' in observed,false));

 await rejects(()=>P.invokeAgent(run,{},runtime,[integration],async()=>new Response(JSON.stringify(output),{status:202,headers:{'content-type':'application/json'}})),/asynchronous response/);
 await rejects(()=>P.invokeAgent(run,{},runtime,[integration],async()=>new Response(JSON.stringify(output),{status:200,headers:{'content-type':'application/octet-stream'}})),/unsupported media type/);
 await rejects(()=>P.invokeAgent(run,{},runtime,[integration],async()=>new Response('{bad',{status:200,headers:{'content-type':'application/json'}})),/invalid UTF-8 JSON/);
 await rejects(()=>P.invokeAgent(run,{},runtime,[integration],async()=>Response.json({...output,tool:'send_records'})),/approved evidence contract/);
 await rejects(()=>P.invokeAgent(run,{},runtime,[integration],async()=>Response.json({proposals:[{field:'weight',value:'59',quote:input,start:0,end:input.length}],highlights:[]})),/cited source/);
 await rejects(()=>P.invokeAgent(run,{},runtime,[{...integration,agentContract:{version:1,model:'changed'}}],async()=>Response.json(output)),/configuration is no longer available|model pin changed/);
 await rejects(()=>P.invokeAgent(run,{},runtime,[{...integration,version:4,agentContract:{version:2,model:'fixture-v1'}}],async()=>Response.json(output)),/contract or model pin changed/);
 const execution=readFileSync('lib/saha/agent-execution.ts','utf8');
 check(()=>assert.match(execution,/delete run\.output;delete run\.assessment;delete run\.usage/));
 check(()=>assert.match(execution,/Invalid provider output quarantined; no clinical result stored/));
 check(()=>assert.match(execution,/noResultStored:true/));
 console.log(JSON.stringify({story:'SAHA-056',passed,failed:0,providerCalls:'synthetic injected transport only',clinicalMutation:false,providerActivation:false}));
}finally{rmSync(dir,{recursive:true,force:true});}
