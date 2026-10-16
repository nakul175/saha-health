import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,mkdirSync,readdirSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {dirname,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';

const compiled=mkdtempSync(join(process.cwd(),'.input-quality-gates-'));
const source=join(process.cwd(),'lib/saha');
const visit=(folder)=>{for(const name of readdirSync(folder)){const file=join(folder,name);if(statSync(file).isDirectory())visit(file);else if(file.endsWith('.ts')){const out=join(compiled,relative(source,file).replace(/\.ts$/,'.js'));mkdirSync(dirname(out),{recursive:true});writeFileSync(out,ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '([^']+)'/g,(all,path)=>path.startsWith('.')?`from '${path}.js'`:all));}}};
visit(source);
const {assessInputQuality,INPUT_QUALITY_DIMENSIONS}=await import(pathToFileURL(join(compiled,'agent.js')));
const {invokeAgent}=await import(pathToFileURL(join(compiled,'agent-provider.js')));

let passed=0;
const check=(fn)=>{fn();passed++;};
const report=(input,language='en')=>assessInputQuality(input,{language});
const failed=(input,dimension,reason,language='en')=>{
 const q=report(input,language);
 check(()=>assert.deepEqual(q.gates.map(g=>g.dimension),INPUT_QUALITY_DIMENSIONS));
 check(()=>assert.equal(q.gates.find(g=>g.dimension===dimension)?.state,'fail'));
 check(()=>assert.equal(q.assessment?.reason,reason));
 check(()=>assert.equal(q.fallback,'structured_capture'));
};

failed('Pulse 88 bpm','field_support','unsupported_case');
failed('Weight 130 pounds','field_support','unsupported_case');
failed('वजन 58 किलोग्राम','language_support','unsupported_case','en');
failed('Weight [inaudible] kg','signal_noise','noisy_input');
failed('BP 120/? mmHg','signal_noise','noisy_input');
failed('Weight not measured; BP unknown','required_input','insufficient_input');
failed('Maybe weight 58 kg','uncertainty','insufficient_input');

const good=report('Weight 58 kg; BP 120/80 mmHg');
check(()=>assert.equal(good.assessment,null));
check(()=>assert.ok(good.gates.every(g=>g.state==='pass')));

const versionPin={format:'saha-ai-version-pin-v1',capability:null,provider:{id:'custom',release:2},modelRelease:'example-v1',agentRelease:'saha-agent-1.2.0',prompt:{id:'documentary-evidence',version:'1.2.0'},tool:{contract:'saha-agent-v1',version:1},data:{inputSchema:'saha-documentary-evidence-input-v1',outputSchema:'saha-evidence-v1',version:1},evaluation:null};
const run=(input,extra={})=>({id:'quality-gate-run',version:'saha-agent-1.2.0',versionPin,task:'extract',input,context:{language:'en',setting:'community',device:'browser'},provider:{id:'custom',version:2,mode:'http',model:'example-v1'},...extra});
const integration={id:'custom',version:2,status:'active',endpoint:'https://provider.example/agent',credentialBinding:'SAHA_CUSTOM',agentContract:{version:1,model:'example-v1'}};
const runtime={SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_CUSTOM:'synthetic-test-key',SAHA_ALLOWED_ORIGINS:'https://provider.example'};
let calls=0;
for(const input of ['Cough recording, heavy background noise','Maybe weight 58 kg','Pulse 88 bpm']){
 const result=await invokeAgent(run(input),{},runtime,[integration],async()=>{calls++;throw Error('transport must not run');});
 check(()=>assert.equal(result.output.assessment?.status,'unable_to_assess'));
 check(()=>assert.deepEqual(result.output.proposals,[]));
 check(()=>assert.match(result.message,/structured capture/));
 check(()=>assert.ok(result.inputQuality?.gates.some(g=>g.state==='fail')));
}
check(()=>assert.equal(calls,0));

const clean=await invokeAgent(run('Weight 58 kg'),{},runtime,[integration],async()=>{
 calls++;
 return Response.json({proposals:[{field:'weight',value:'58',quote:'Weight 58 kg',start:0,end:12}],highlights:[],assessment:null});
});
check(()=>assert.equal(calls,1));
check(()=>assert.equal(clean.output.proposals[0]?.value,'58'));
check(()=>assert.ok(clean.inputQuality?.gates.every(g=>g.state==='pass')));

console.log(JSON.stringify({passed,failed:0,providerCalls:calls,unsafeProviderCalls:0,scope:'SAHA-057 deterministic field/language/noise/missingness/uncertainty gates and structured non-clinical fallback.'}));
rmSync(compiled,{recursive:true,force:true});
