import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
// Execute the actual Worker-compatible provider code in Node with an injected
// transport. No provider credentials or external network traffic are used.
const dir=mkdtempSync(join(process.cwd(),'.agent-contract-'));
let passed=0;
try{
 for(const file of ['types','programmes','mis','adapter-operations','core','fact-provenance','agent','task-limits','governance','capability-lifecycle','access','agent-provider','ai-budget']){let code=ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;code=code.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,file+'.js'),code);}
 const {validateOutput,localExtract}=await import(pathToFileURL(join(dir,'agent.js')));const {invokeAgent,readOpenAI}=await import(pathToFileURL(join(dir,'agent-provider.js')));
 const check=fn=>{fn();passed++};const rejects=async(fn,pattern)=>{await assert.rejects(fn,pattern);passed++};
 const input='weight 58 kg';const output={proposals:[{field:'weight',value:'58',quote:input,start:0,end:input.length}],highlights:[]};
 check(()=>assert.equal(validateOutput(output,input,'extract').output.proposals[0].value,'58'));
 check(()=>assert.throws(()=>validateOutput({...output,tool:'send_records'},input,'extract'),/contract/));
 check(()=>assert.throws(()=>validateOutput({...output,proposals:[{...output.proposals[0],start:1}]},input,'extract'),/source/));
 check(()=>assert.throws(()=>validateOutput({...output,proposals:[{...output.proposals[0],value:'59'}]},input,'extract'),/source/));
 check(()=>assert.throws(()=>validateOutput(output,input,'summary'),/cannot propose/));
 const bad='temperature 58 C';check(()=>assert.throws(()=>validateOutput({proposals:[{...output.proposals[0],quote:bad,end:bad.length}],highlights:[]},bad,'extract'),/units/));
 check(()=>assert.equal(localExtract('yesterday weight 58 kg; mother weight 55 kg; no cough for 3 days').proposals.length,0));
 const negative='No weight 58 kg';check(()=>assert.throws(()=>validateOutput({proposals:[{field:'weight',value:'58',quote:'weight 58 kg',start:3,end:15}],highlights:[]},negative,'extract'),/context/));
 const pressure='BP 120/80 mmHg';check(()=>assert.throws(()=>validateOutput({proposals:[{field:'systolic',value:'80',quote:pressure,start:0,end:pressure.length}],highlights:[]},pressure,'extract'),/field/));
 const run={id:'contract-run',task:'extract',input,provider:{id:'openai',mode:'openai',model:'gpt-4.1-mini-2025-04-14'}};const runtime={OPENAI_API_KEY:'test-not-a-real-key',SAHA_EXTERNAL_APIS_ENABLED:'true'};
 let calls=0;const send=async(url,init)=>{calls++;check(()=>{assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.redirect,'manual');assert.equal(init.headers['Idempotency-Key'],run.id);const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.max_output_tokens,1400);assert.equal(body.text.format.strict,true);assert.equal(body.tools,undefined);assert.equal(body.previous_response_id,undefined);assert.deepEqual(JSON.parse(body.input),{task:'extract',source:input})});return Response.json({status:'completed',model:run.provider.model,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}],usage:{input_tokens:100,output_tokens:60}})};
 const result=await invokeAgent(run,{},runtime,[],send);check(()=>{assert.equal(calls,1);assert.equal(result.output.proposals[0].value,'58');assert.equal(result.usage.outputTokens,60)});
 await rejects(()=>invokeAgent(run,{},runtime,[],async()=>{throw Error('timed out')}),/No automatic retry/);
 await rejects(()=>invokeAgent(run,{},runtime,[],async()=>Response.json({}, {status:429})),/HTTP 429/);
 // Slice 11f: redirect mode 'manual' (workerd rejects 'error'); a redirect is refused and never followed.
 {let hops=0;await rejects(()=>invokeAgent(run,{},runtime,[],async()=>{hops++;return new Response(null,{status:307,headers:{location:'https://elsewhere.example/'}});}),/HTTP 307/);check(()=>assert.equal(hops,1));}
 await rejects(()=>invokeAgent(run,{},runtime,[],async()=>new Response('x'.repeat(64001))),/size limit/);
 await rejects(()=>invokeAgent(run,{},runtime,[],async()=>new Response('invalid')),/invalid JSON/);
 await rejects(()=>invokeAgent(run,{}, {...runtime,SAHA_EXTERNAL_APIS_ENABLED:'false'},[],send),/disabled/);
 await rejects(()=>invokeAgent(run,{}, {...runtime,OPENAI_API_KEY:''},[],send),/credential/);
 check(()=>assert.throws(()=>readOpenAI({status:'incomplete'},run.provider.model),/incomplete/));
 check(()=>assert.throws(()=>readOpenAI({status:'completed',model:'changed'},run.provider.model),/model version/));
 check(()=>assert.throws(()=>readOpenAI({status:'completed',model:run.provider.model,output:[{type:'message',content:[{type:'refusal'}]}]},run.provider.model),/declined/));
 const integration={id:'custom',version:2,status:'active',endpoint:'https://provider.example/agent',credentialBinding:'SAHA_CUSTOM',agentContract:{version:1,model:'example-v1'}};const custom={...run,provider:{id:'custom',version:2,mode:'http',model:'example-v1'}};
 await rejects(()=>invokeAgent(custom,{}, {...runtime,SAHA_CUSTOM:'test'},[integration],send),/not approved/);
 const customResult=await invokeAgent(custom,{}, {...runtime,SAHA_CUSTOM:'test',SAHA_ALLOWED_ORIGINS:'https://provider.example'},[integration],async(url,init)=>{check(()=>{assert.equal(url,integration.endpoint);assert.equal(JSON.parse(init.body).contract,'saha-agent-v1');assert.equal(JSON.parse(init.body).limits.maxCalls,1)});return Response.json(output)});check(()=>assert.equal(customResult.output.proposals[0].value,'58'));
 console.log(JSON.stringify({passed,suite:'agent provider contract (mock transport)',liveProviderTested:false}));writeFileSync('tests/agent-contract-result.json',JSON.stringify({passed,liveProviderTested:false,completedAt:new Date().toISOString()},null,2)+'\n');
}finally{rmSync(dir,{recursive:true,force:true})}
