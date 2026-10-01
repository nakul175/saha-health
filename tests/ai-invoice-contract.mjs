// Slice 5h contract: AI invoice reconciliation — CSV bounds and validation, Saha estimates per provider/model/month,
// differences and threshold flags, owner-only append-only records with supersession, audit, no change to budgets or
// rates, and the owner-owned invoice alerts for the previous month. Synthetic data only.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.ai-invoice-contract-'));let passed=0;const check=fn=>{fn();passed++};
const status=(fn,code,pattern)=>{try{fn();}catch(e){assert.equal(e.status,code,e.message);if(pattern)assert.match(e.message,pattern);passed++;return e;}assert.fail(`expected ${code}`);};
try{
 for(const file of ['types','programmes','mis','adapter-operations','core','fact-provenance','ai-budget','ai-invoice','alerts','operations','access','referral-rules'])writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const I=await import(pathToFileURL(join(dir,'ai-invoice.js'))),A=await import(pathToFileURL(join(dir,'alerts.js'))),{maintenanceAllows}=await import(pathToFileURL(join(dir,'operations.js')));
 const now='2026-09-15T10:00:00.000Z',aug='2026-08-10T09:00:00.000Z';
 const owner={userId:'owner',displayName:'Synthetic owner',role:'clinician',status:'active',teamIds:['team'],version:1,isOwner:true},admin={...owner,userId:'admin',role:'admin',isOwner:false},supervisor={...owner,userId:'sup',role:'supervisor',isOwner:false},suspended={...owner,userId:'gone',status:'suspended'};
 const prov=(id,mode,model)=>({id,name:id,mode,model,version:1,available:true,reason:''});
 const run=(x)=>({id:Math.random().toString(36).slice(2),status:'applied',createdAt:aug,startedAt:aug,expiresAt:aug,callCount:1,provider:prov('openai','openai','gpt-a'),...x});
 const runs=[run({usage:{inputTokens:100000,outputTokens:50000}}),run({usage:{inputTokens:20000,outputTokens:10000}}),run({provider:prov('openai','openai','gpt-b')}),run({callCount:0,status:'pending'}),run({provider:prov('local','local','rules')}),run({startedAt:now,createdAt:now,usage:{inputTokens:5,outputTokens:5}}),run({provider:prov('other-http','http','m1'),usage:{inputTokens:10,outputTokens:10}})];
 const state=(rates={input:1,output:2,at:aug})=>({organisation:{id:'org'},members:[owner,admin,supervisor,suspended],workspace:{people:[],visits:[{id:'v',personId:'p',agentRuns:structuredClone(runs)}],audit:[]},operations:{version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates,budgets:[{capabilityKey:'fixture-cap',monthlyUsd:3,setBy:'owner',setAt:aug,reason:'Synthetic cap'}]}});
 const actor=m=>({userId:m.userId,displayName:m.displayName});
 const H='provider,model,month,input_tokens,output_tokens,amount_usd,invoice_reference';
 const csv=(...lines)=>[H,...lines].join('\n');
 const rec=(s,c,m=owner)=>I.applyInvoiceReconciliation(s,{type:'opsInvoiceReconcile',version:s.operations?.version??0,thresholdPercent:5,reason:'Synthetic monthly invoice review',...c},actor(m),m,now);

 // CSV parsing and bounds.
 check(()=>assert.deepEqual(I.parseCsv('﻿a,"b,c","d ""e"""\r\n\r\n1,2,3\n'),[['a','b,c','d "e"'],['1','2','3']]));
 status(()=>I.parseCsv('a,"b\n1,2'),422,/unclosed/);
 status(()=>I.parseInvoice('provider,model,month',now),422,/Missing: input_tokens/);
 status(()=>I.parseInvoice(H+',extra\n',now),422,/Not recognised: 1/);
 status(()=>I.parseInvoice(H.replace('model','provider'),now),422,/repeated/);
 status(()=>I.parseInvoice(H,now),422,/no invoice lines/);
 status(()=>I.parseInvoice(csv(...Array.from({length:13},(_,i)=>`openai,m${i},2026-08,1,1,0.01,INV-1`)),now),422,/At most 12/);
 const bad=status(()=>I.parseInvoice(csv('openai,gpt-a,2026-08,1,1,0.01,INV-1','other,gpt-a,2026-07,-1,1,0.0000001,INV-2','openai,=cmd,2026-10,1,1,1,INV-1','openai,gpt-z,2026-13,1,1,1,INV-1','openai,gpt-y,2026-08,1,1'),now),422);
 check(()=>{for(const p of [/Row 3: provider must be the same|Row 3: every line must name the same provider/,/Row 3: token counts/,/Row 3: amount_usd/,/Row 3: every line must name the same month/,/Row 3: every line must carry the same invoice reference/,/Row 3: each model appears once/,/Row 4: model must be/,/Row 4: month cannot be in the future/,/Row 5: month must be YYYY-MM/,/Row 6: expected 7 fields, found 5/])assert.match(bad.message,p);});
 check(()=>{const p=I.parseInvoice(csv('openai,gpt-a,2026-08,120000,60000,0.24,INV-2026-08'),now);assert.deepEqual(p,{provider:'openai',month:'2026-08',invoiceReference:'INV-2026-08',rows:[{model:'gpt-a',inputTokens:120000,outputTokens:60000,amountUsd:0.24}]});});

 // Saha's own usage: sent external requests of that provider and month only.
 const s=state();
 check(()=>assert.deepEqual(Object.fromEntries(I.sahaUsage(s,'openai','2026-08')),{'gpt-a':{runs:2,missingUsage:0,inputTokens:120000,outputTokens:60000},'gpt-b':{runs:1,missingUsage:1,inputTokens:0,outputTokens:0}},'unsent, local, other-month and other-provider requests excluded'));
 check(()=>assert.equal(I.previousMonth(now),'2026-08'));
 check(()=>assert.equal(I.previousMonth('2026-01-03T00:00:00Z'),'2025-12'));

 // Schema bounds and owner-only recording.
 check(()=>assert.equal(I.applyInvoiceReconciliation(s,{type:'opsInvoiceReconcile',version:0,csv:'x'.repeat(4001),thresholdPercent:5,reason:'Synthetic review'},actor(owner),owner,now),null,'over-long file fails the schema'));
 check(()=>assert.equal(I.applyInvoiceReconciliation(s,{type:'opsInvoiceReconcile',version:0,csv:H,thresholdPercent:0,reason:'Synthetic review'},actor(owner),owner,now),null,'zero threshold fails the schema'));
 check(()=>assert.equal(I.applyInvoiceReconciliation(s,{type:'opsInvoiceReconcile',version:0,csv:H,thresholdPercent:5,reason:'Synthetic review',file:'x'},actor(owner),owner,now),null,'no extra fields (no uploaded file)'));
 const good=csv('openai,gpt-a,2026-08,120000,60000,0.24,INV-2026-08','openai,gpt-c,2026-08,1000,1000,0.01,INV-2026-08');
 status(()=>rec(s,{csv:good},admin),403,/owner/);
 status(()=>rec(s,{csv:good},supervisor),403,/owner/);
 status(()=>rec(s,{csv:good},suspended),403,/owner/);
 status(()=>rec(s,{csv:good,version:3}),409,/Refresh/);
 check(()=>{assert.equal(s.operations.version,0);assert.equal(I.reconciliations(s).length,0);assert.equal(s.workspace.audit.length,0,'nothing stored on refusal');});
 const beforeRates=structuredClone(s.operations.rates),beforeBudgets=structuredClone(s.operations.budgets);
 const first=rec(s,{csv:good});
 check(()=>{assert.equal(first.lines,3);assert.equal(first.flaggedLines,2);assert.equal(first.supersedes,null);assert.equal(s.operations.version,1);});
 const r1=I.reconciliations(s)[0],line=m=>r1.lines.find(l=>l.model===m);
 check(()=>assert.deepEqual(r1.lines.map(l=>[l.model,l.source]),[['gpt-a','both'],['gpt-c','invoice-only'],['gpt-b','saha-only']]));
 check(()=>assert.deepEqual(line('gpt-a'),{model:'gpt-a',source:'both',runs:2,missingUsage:0,estimated:{inputTokens:120000,outputTokens:60000,usd:0.24},invoiced:{inputTokens:120000,outputTokens:60000,usd:0.24},difference:{inputTokens:0,outputTokens:0,usd:0},variance:{tokensPercent:0,usdPercent:0},flags:[]}));
 check(()=>{const l=line('gpt-c');assert.deepEqual(l.difference,{inputTokens:1000,outputTokens:1000,usd:0.01});assert.deepEqual(l.variance,{tokensPercent:100,usdPercent:100});assert.deepEqual(l.flags,['usd','tokens']);});
 check(()=>{const l=line('gpt-b');assert.equal(l.estimated.usd,0.012,'a sent request without usage counts at the reserved allowance');assert.equal(l.missingUsage,1);assert.deepEqual(l.variance,{tokensPercent:null,usdPercent:null});assert.deepEqual(l.flags,['usd'],'Saha recorded cost the invoice does not show');});
 check(()=>assert.deepEqual(r1.totals,{estimatedUsd:0.252,invoicedUsd:0.25,differenceUsd:-0.002,flaggedLines:2}));
 check(()=>{assert.equal(r1.recordedBy,'owner');assert.equal(r1.thresholdPercent,5);assert.deepEqual(r1.rates,beforeRates);assert.equal(r1.invoiceReference,'INV-2026-08');});
 check(()=>{const a=s.workspace.audit.at(-1);assert.equal(a.action,'opsInvoiceReconcile');assert.match(a.detail,/Invoice INV-2026-08 for provider openai, 2026-08, reconciled against Saha estimates: invoiced USD 0\.25, estimated USD 0\.25, 3 line\(s\), 2 above the 5% threshold\. Budgets and cost assumptions unchanged: Synthetic monthly invoice review/);});
 check(()=>{assert.deepEqual(s.operations.rates,beforeRates);assert.deepEqual(s.operations.budgets,beforeBudgets,'budgets and rates are never changed automatically');});
 // Validation failure stores nothing.
 status(()=>rec(s,{csv:csv('openai,gpt-a,2026-08,1,1,1,INV-1','openai,gpt-a,2026-08,1,1,1,INV-1')}),422,/each model appears once/);
 check(()=>{assert.equal(s.operations.version,1);assert.equal(I.reconciliations(s).length,1);assert.equal(s.workspace.audit.length,1);});

 // Threshold: gpt-a invoiced 126,000 / 60,000 tokens and USD 0.25 differs by 3.23% and 4%.
 const near=csv('openai,gpt-a,2026-08,126000,60000,0.25,INV-2026-08-R');
 const t5=state(),t3=state();rec(t5,{csv:near});rec(t3,{csv:near,thresholdPercent:3});
 check(()=>{const l=I.reconciliations(t5)[0].lines[0];assert.deepEqual(l.variance,{tokensPercent:3.23,usdPercent:4});assert.deepEqual(l.flags,[],'within a 5% threshold');});
 check(()=>assert.deepEqual(I.reconciliations(t3)[0].lines[0].flags,['usd','tokens'],'above a 3% threshold'));
 check(()=>{const at=state();rec(at,{csv:near,thresholdPercent:4});assert.deepEqual(I.reconciliations(at)[0].lines[0].flags,[],'a difference equal to the threshold does not exceed it');});

 // Append-only supersession for the same provider and month; another month does not supersede.
 const frozen=JSON.stringify(I.reconciliations(s)[0]);
 const second=rec(s,{csv:csv('openai,gpt-a,2026-08,120000,60000,0.24,INV-2026-08-C','openai,gpt-b,2026-08,6000,0,0.012,INV-2026-08-C'),reason:'Corrected invoice from provider'});
 check(()=>{assert.equal(second.supersedes,r1.id);assert.equal(second.flaggedLines,1,'only the line whose tokens Saha did not record');assert.equal(JSON.stringify(I.reconciliations(s)[0]),frozen,'the earlier record is unchanged');assert.equal(s.operations.version,2);assert.match(s.workspace.audit.at(-1).detail,new RegExp(`Supersedes reconciliation ${r1.id}`));});
 check(()=>{const l=I.reconciliations(s)[1].lines.find(x=>x.model==='gpt-b');assert.deepEqual(l.flags,['tokens'],'tokens the invoice shows that Saha did not record are flagged');});
 const july=rec(s,{csv:csv('openai,gpt-a,2026-07,0,0,0,INV-2026-07')});
 check(()=>{assert.equal(july.supersedes,null);assert.equal(july.flaggedLines,0,'no use and nothing invoiced: nothing to flag');});
 check(()=>{const v=I.invoiceView(s);assert.deepEqual(v.columns,['provider','model','month','input_tokens','output_tokens','amount_usd','invoice_reference']);assert.equal(v.records.length,3);assert.deepEqual(v.records.filter(r=>r.month==='2026-08').map(r=>[r.current,r.supersededBy]),[[true,null],[false,second.reconciliationId]]);assert.match(v.notice,/not.*change budgets|never changes budgets/);});

 // Without cost rates the USD side cannot be estimated and every line is flagged for it.
 const nr=state(null);rec(nr,{csv:good});
 check(()=>{const r=I.reconciliations(nr)[0];assert.equal(r.totals.estimatedUsd,null);assert.equal(r.totals.differenceUsd,null);assert.ok(r.lines.every(l=>l.estimated.usd===null&&l.flags.includes('no-rates')));assert.deepEqual(r.lines.find(l=>l.model==='gpt-a').flags,['no-rates']);assert.match(nr.workspace.audit.at(-1).detail,/estimated unknown \(no cost rates\)/);});
 // An organisation without an operations record starts one at version 0.
 const empty=state();delete empty.operations;rec(empty,{csv:good});
 check(()=>{assert.equal(empty.operations.version,1);assert.equal(empty.operations.rates,null);});

 // Bounded, never pruned.
 const full=state();full.operations.invoiceReconciliations=Array.from({length:60},(_,i)=>({...r1,id:'r'+i}));
 status(()=>rec(full,{csv:good}),422,/At most 60/);
 check(()=>assert.equal(full.operations.invoiceReconciliations.length,60));

 // Alerts for the previous month (owners): providers used without a reconciliation, and flagged current ones.
 const fresh=state();
 check(()=>assert.deepEqual(I.invoiceAlertInputs(fresh,now),{month:'2026-08',unreconciled:['openai','other-http'],flagged:[]}));
 rec(fresh,{csv:good});
 check(()=>assert.deepEqual(I.invoiceAlertInputs(fresh,now),{month:'2026-08',unreconciled:['other-http'],flagged:[{provider:'openai',invoiceReference:'INV-2026-08',flaggedLines:2}]}));
 check(()=>assert.deepEqual(I.invoiceAlertInputs(s,now).flagged,[{provider:'openai',invoiceReference:'INV-2026-08-C',flaggedLines:1}],'only the current record counts; the superseded one with two flags does not'));
 check(()=>assert.deepEqual(I.invoiceAlertInputs(fresh,'2026-10-02T00:00:00.000Z'),{month:'2026-09',unreconciled:['openai'],flagged:[]},'the September request is due next month'));
 const alerts=A.alertsFor({invoices:I.invoiceAlertInputs(fresh,now),report:null,telemetry:null,operations:null,now});
 check(()=>{assert.equal(A.ALERT_RULES_VERSION,'1.2.0');assert.deepEqual(alerts.map(a=>[a.id,a.severity,a.count,a.owner,a.tab]),[['ai-invoice-variance','high',1,'owners','service'],['ai-invoice-unreconciled','normal',1,'owners','service']]);});
 check(()=>{assert.match(alerts[0].action,/openai invoice INV-2026-08 \(2 lines\)/);assert.match(alerts[0].action,/not changed automatically/);assert.match(alerts[1].action,/2026-08.*other-http/);assert.match(alerts[0].title,/2026-08/);});
 check(()=>assert.deepEqual(A.alertsFor({invoices:null,report:null,telemetry:null,operations:null,now}),[],'no invoice data, no invoice alerts'));
 check(()=>{assert.equal(A.canAcknowledge(admin,A.ALERT_OWNERS['ai-invoice-variance']),false);assert.equal(A.canAcknowledge(owner,A.ALERT_OWNERS['ai-invoice-unreconciled']),true);});
 check(()=>{const o=state();A.applyAlertAck(o,{type:'opsAcknowledgeAlert',alertId:'ai-invoice-unreconciled',count:1,note:'Invoice requested from provider'},actor(owner),owner,now);const x=A.alertsFor({invoices:I.invoiceAlertInputs(fresh,now),report:null,telemetry:null,operations:null,acknowledgements:o.operations.acknowledgements,viewerId:'admin',now});assert.equal(x.find(a=>a.id==='ai-invoice-unreconciled').acknowledged.note,'Invoice requested from provider');});
 status(()=>A.applyAlertAck(state(),{type:'opsAcknowledgeAlert',alertId:'ai-invoice-variance',count:1,note:'Looking into it now'},actor(admin),admin,now),403,/owner acknowledges budget and invoice alerts/);
 // Recording evidence stays available during maintenance, like other operations commands.
 check(()=>assert.equal(maintenanceAllows({type:'opsInvoiceReconcile'}),true));
 const result={suite:'AI invoice reconciliation contract (slice 5h)',passed,completedAt:new Date().toISOString()};
 writeFileSync('tests/ai-invoice-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
