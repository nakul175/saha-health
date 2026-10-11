// BR-OPS-05: deferred React commit with the former POST resolved by a layout observer.
// Actual component and Button; synthetic API double only, not server/clinical/formal acceptance.
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
const out=resolve(process.env.SAHA_SUPPORT_COMMIT_EVIDENCE??'tests/reports/support-commit-transition');
mkdirSync(out,{recursive:true});
const tmp=mkdtempSync(resolve('.support-commit-'));
const esbuildPath=resolve('node_modules/.pnpm',readdirSync('node_modules/.pnpm').filter(n=>n.startsWith('esbuild@')).sort().at(-1),'node_modules/esbuild/lib/main.js');
const {build}=createRequire(esbuildPath)(esbuildPath);
const checks=[],errors=[];let browser,server;
const check=(actual,criterion)=>checks.push({criterion,passed:actual===true});
const sourceHash=createHash('sha256').update(readFileSync('app/work-support-panel.tsx')).digest('hex');
try{
 writeFileSync(join(tmp,'entry.tsx'),`
import React,{startTransition,useEffect,useLayoutEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import{WorkSupportPanel}from'../app/work-support-panel';
window.__events=[];window.__trace=[];window.__resolveAtCommit=null;
window.fetch=(url,options={})=>new Promise(resolve=>{window.__events.push({url:String(url),method:options.method??'GET',headers:options.headers??{},body:options.body?JSON.parse(options.body):null,resolve,settled:false,phase:window.__phase});window.__trace.push({event:'request',index:window.__events.length-1,phase:window.__phase});});
window.__respond=(index,body)=>{const e=window.__events[index];e.settled=true;e.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));};
function App(){const[actor,setActor]=useState('A');window.__changeDeferred=()=>startTransition(()=>setActor('B'));
 const data={organisation:{id:'org-'+actor},user:{userId:'actor-'+actor},membership:{version:1,role:'asha',isOwner:false,status:'active',teamIds:['team-'+actor]},role:'asha',burdenMeasurement:{enabled:true,version:1}};
 const visit={id:'visit-'+actor,personId:'person-'+actor};
 useLayoutEffect(()=>{window.__phase='layout-'+actor;window.__trace.push({event:'layout-commit',actor,text:document.getElementById('root').textContent});if(actor==='B'&&window.__resolveAtCommit!==null){const index=window.__resolveAtCommit;window.__resolveAtCommit=null;window.__trace.push({event:'resolve-former-post-from-layout',index});window.__respond(index,{recorded:true});}},[actor]);
 useEffect(()=>{window.__phase='passive-'+actor;window.__trace.push({event:'parent-passive',actor});},[actor]);
 return <main><h1>Deferred support context {actor}</h1><WorkSupportPanel data={data as any} visit={visit as any}/></main>;
}createRoot(document.getElementById('root')).render(<App/>);
`);
 await build({entryPoints:[join(tmp,'entry.tsx')],outfile:join(tmp,'bundle.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',alias:{'@':process.cwd()},logLevel:'silent'});
 server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'application/javascript':'text/html');res.end(req.url==='/bundle.js'?readFileSync(join(tmp,'bundle.js')):'<div id="root"></div><script src="/bundle.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const{chromium}=await import(process.env.SAHA_BROWSER_PACKAGE??'@playwright/test');
 browser=await chromium.launch({headless:true,...(process.env.SAHA_CHROMIUM?{executablePath:process.env.SAHA_CHROMIUM}:{})});
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>__events.some(e=>e.method==='GET'));
 await page.evaluate(()=>__respond(0,{rows:[],helpers:[],canAssign:false,overflow:false,enabled:true}));
 await page.getByRole('button',{name:'Request work support',exact:true}).click();
 await page.waitForFunction(()=>__events.some(e=>e.method==='POST'));
 const oldPost=await page.evaluate(()=>__events.findIndex(e=>e.method==='POST'));
 check(oldPost>=0,'Actual original support action is in flight before transition');
 await page.evaluate(index=>{window.__resolveAtCommit=index;__changeDeferred();},oldPost);
 await page.waitForFunction(()=>__trace.some(t=>t.event==='parent-passive'&&t.actor==='B'));
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const observed=await page.evaluate(()=>({trace:__trace,events:__events.map((e,index)=>({index,url:e.url,method:e.method,headers:e.headers,body:e.body,settled:e.settled,phase:e.phase})),text:document.getElementById('root').textContent}));
 const commitIndex=observed.trace.findIndex(t=>t.event==='layout-commit'&&t.actor==='B');
 const resolvedIndex=observed.trace.findIndex(t=>t.event==='resolve-former-post-from-layout');
 const passiveIndex=observed.trace.findIndex(t=>t.event==='parent-passive'&&t.actor==='B');
 check(commitIndex>=0,'React startTransition actually commits the changed account/organisation/visit');
 check(resolvedIndex>commitIndex&&resolvedIndex<passiveIndex,'Former POST response is resolved from committed layout before parent passive work');
 check(observed.events[oldPost].settled,'Former action receives its successful acknowledgement during the commit interval');
 const later=observed.events.slice(oldPost+1).filter(e=>e.method==='GET');
 const oldReads=later.filter(e=>e.headers['x-saha-organisation']==='org-A'||e.url.includes('visit-A'));
 check(oldReads.length===0,'Former-context POST success cannot launch any old-context GET after the new commit');
 check(later.filter(e=>e.headers['x-saha-organisation']==='org-B'&&e.url.endsWith('visit-B')).length===1,'Current context independently starts exactly one correctly scoped read');
 check(observed.events.filter(e=>e.method==='POST').length===1,'Context transition never creates or retries another support action');
 check(errors.length===0,'Actual component deferred transition has no uncaught browser error');
 writeFileSync(join(out,'observations.json'),JSON.stringify({...observed,oldReads,errors},null,2)+'\n');
}catch(e){checks.push({criterion:'Deferred-commit test completed without fixture/runtime failure',passed:false,error:String(e)});writeFileSync(join(out,'failure.log'),e.stack??String(e));}
finally{
 await browser?.close();if(server)await new Promise(r=>server.close(r));rmSync(tmp,{recursive:true,force:true});
 const passed=checks.filter(c=>c.passed).length,failed=checks.filter(c=>!c.passed).length;
 const result={passed,failed,skipped:0,sourceHash,checks,errors,actualReact:true,actualChromium:true,scope:'Actual source/Button; non-synchronous React startTransition and layout-observer response delivery before passive work. Explicit synthetic API double, not backend/clinical/formal/physical/hosting acceptance.',cleanup:{serverClosed:!server||!server.listening,browserClosed:!browser||!browser.isConnected()}};
 writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed,failed,skipped:0}));if(failed)process.exitCode=1;
}
