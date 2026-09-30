// Checks actual prototype script transitions with a minimal DOM stub.
// This is not browser rendering, accessibility or mobile layout validation.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
const dir=path.dirname(new URL(import.meta.url).pathname);
const html=fs.readFileSync(path.join(dir,'../Health-AI-Wireframes-v1.0.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',checked:true,addEventListener(){},setAttribute(){},focus(){}});return elements.get(id);};
const document={getElementById:element,querySelectorAll:()=>[],querySelector:()=>({focus(){},setAttribute(){}})};
const context=vm.createContext({document,console});vm.runInContext(script,context);
const evaluate=s=>vm.runInContext(s,context);const checks=[];
function check(name,condition){if(!condition)throw Error(name);checks.push(name);}
for(let n=1;n<=22;n++){const id='SCR'+String(n).padStart(2,'0');evaluate(`go('${id}')`);check(id+' generates a screen',element('content').innerHTML.includes('<h1')&&element('content').innerHTML.includes(id));}
evaluate('state=initial();render();act("start");act("capture");act("save");act("review");state.reviewed=true;act("confirm");act("submit");');
check('Destination A independently accepted',evaluate('state.destA')==='Accepted');
check('Destination B uncertain',evaluate('state.destB')==='Uncertain');
evaluate('state.network="offline";render();');check('Offline change preserves accepted receipt',evaluate('state.destA')==='Accepted');
evaluate('state.network="online";act("reconcile");');check('Reconciliation resolves B',evaluate('state.destB')==='Accepted');
evaluate('act("revoke");');check('Revocation preserves clinical confirmation',evaluate('state.confirmed')===true);check('Revocation invalidates action approval',evaluate('state.approved')===false);
evaluate('act("switch");');check('Person switch clears prior review',evaluate('state.reviewed')===false);check('Person switch clears actions',evaluate('state.destA')==='Not submitted');
evaluate('state=initial();state.network="offline";state.saved=true;state.reviewed=true;act("confirm");act("submit");');check('Offline submission queues only',evaluate('state.destA')==='Queued on device');
evaluate('act("revoke");act("sync");');check('Revoked queue cannot disclose on sync',evaluate('state.destA')==='Blocked'&&evaluate('state.destB')==='Blocked');
evaluate('state=initial();state.aiAck=true;act("ai");');check('Simulated AI yields distinct assessment state',evaluate('state.ai')===true);evaluate('go("SCR06");');check('Unable-to-assess limitation visible',element('content').innerHTML.includes('Unable to assess'));
evaluate('state=initial();state.aiAck=true;state.network="offline";act("ai");');check('Cloud AI cannot run offline',evaluate('state.ai')===false);
check('No external script or stylesheet dependency',!/<script[^>]+src=|<link[^>]+href=/i.test(html));
check('Synthetic label present',html.includes('SYNTHETIC PROTOTYPE'));
const report={checks:checks.length,status:'Passed',scope:'Prototype JavaScript state and generated markup only; browser visuals unverified',check_names:checks};
fs.writeFileSync(path.join(dir,'wireframe_state_results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks,status:report.status,scope:report.scope}));
