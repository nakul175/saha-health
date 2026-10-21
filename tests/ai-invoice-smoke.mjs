import assert from 'node:assert/strict';
// Slice 5h: AI invoice reconciliation over HTTP and local D1, in the main test organisation (the owner account is at its
// limit of owned organisations). Synthetic invoice summaries only.
export async function aiInvoiceSmoke({get,post,check,accounts,org}){
 const {owner:o,supervisor:sv,admin:a}=accounts,d=new Date(),prev=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)).toISOString().slice(0,7),next=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)).toISOString().slice(0,7);
 // Visibility follows budgets: owners and administrators, not supervisors.
 const supView=await get(sv,'/api/operations',200,org);check(()=>assert.equal(supView.invoices,null));
 let view=await get(o,'/api/operations',200,org);const budgetsBefore=view.operations.budgets??[],ratesBefore=view.operations.rates??null;
 check(()=>{assert.equal(view.alertRules,'1.3.0'/* SAHA-117 adds operational signals; invoice rules remain enforced */);assert.deepEqual(view.invoices.records,[]);assert.deepEqual(view.invoices.columns,['provider','model','month','input_tokens','output_tokens','amount_usd','invoice_reference']);assert.match(view.invoices.notice,/never changes budgets or cost assumptions/);assert.ok(!view.alerts.some(x=>x.id.startsWith('ai-invoice')),'no provider use, nothing to reconcile');});
 const adminView=await get(a,'/api/operations',200,org);check(()=>assert.deepEqual(adminView.invoices.records,[]));
 const H='provider,model,month,input_tokens,output_tokens,amount_usd,invoice_reference',body=(csv,extra={})=>({type:'opsInvoiceReconcile',version:view.operations.version,csv,thresholdPercent:5,reason:'Synthetic monthly invoice review',...extra});
 const first=`${H}\nopenai,synthetic-model,${prev},1000,500,0.05,INV-SYN-001`;
 // Owners only; bounded, validated input; nothing stored on refusal.
 await post(a,body(first),403,undefined,org);
 await post(sv,body(first),403,undefined,org);
 await post(o,body(`${H}\nopenai,synthetic-model,${next},1,1,0.01,INV-SYN-001`),422,undefined,org);
 await post(o,body(`provider,model\nopenai,synthetic-model`),422,undefined,org);
 await post(o,body('x'.repeat(4001)),422,undefined,org);
 await post(o,body(first,{thresholdPercent:0}),422,undefined,org);
 await post(o,body(first,{version:view.operations.version+5}),409,undefined,org);
 view=await get(o,'/api/operations',200,org);check(()=>assert.equal(view.invoices.records.length,0));
 // Record, then replay with the same key.
 const key=crypto.randomUUID(),req=body(first),made=await post(o,req,200,key,org),again=await post(o,req,200,key,org);
 check(()=>{assert.equal(made.result.flaggedLines,1);assert.equal(made.result.supersedes,null);assert.equal(again.replayed,true);assert.equal(again.result.reconciliationId,made.result.reconciliationId);});
 view=await get(o,'/api/operations',200,org);
 const r1=view.invoices.records[0];
 check(()=>{assert.equal(view.invoices.records.length,1);assert.equal(r1.current,true);assert.equal(r1.provider,'openai');assert.equal(r1.month,prev);assert.equal(r1.invoiceReference,'INV-SYN-001');assert.equal(r1.recordedBy,o.id);assert.deepEqual(r1.rates,ratesBefore,'the cost assumptions in force are kept with the record');});
 check(()=>{const l=r1.lines[0];assert.equal(l.source,'invoice-only');assert.equal(l.runs,0);assert.equal(l.estimated.usd,ratesBefore?0:null);assert.deepEqual(l.flags,ratesBefore?['usd','tokens']:['tokens','no-rates']);assert.deepEqual(l.invoiced,{inputTokens:1000,outputTokens:500,usd:0.05});});
 check(()=>{const x=view.alerts.find(x=>x.id==='ai-invoice-variance');assert.equal(x.count,1);assert.equal(x.owner,'owners');assert.match(x.action,/openai invoice INV-SYN-001 \(1 line\)/);});
 // Rates recorded later do not change the earlier record; a corrected reconciliation supersedes it.
 await post(o,{type:'opsRates',version:view.operations.version,input:10,output:20},200,undefined,org);
 view=await get(o,'/api/operations',200,org);
 const second=await post(o,body(`${H}\nopenai,synthetic-model,${prev},0,0,0,INV-SYN-001-C`,{reason:'Corrected synthetic invoice'}),200,undefined,org);
 view=await get(o,'/api/operations',200,org);
 check(()=>{assert.equal(second.result.supersedes,r1.id);assert.equal(second.result.flaggedLines,0);assert.deepEqual(view.invoices.records.map(r=>[r.invoiceReference,r.current,r.supersededBy]),[['INV-SYN-001-C',true,null],['INV-SYN-001',false,second.result.reconciliationId]]);});
 check(()=>{const {supersededBy,current,...old}=view.invoices.records[1],{supersededBy:_s,current:_c,...orig}=r1;assert.deepEqual(old,orig,'the superseded record is unchanged');assert.equal(view.invoices.records[0].rates.input,10);assert.deepEqual(view.operations.budgets??[],budgetsBefore,'no budget created or changed');assert.equal(view.operations.rates.input,10);});
 check(()=>assert.ok(!view.alerts.some(x=>x.id==='ai-invoice-variance'),'the current record has no flagged line'));
 // A flagged current record raises the owners' alert; administrators see it but cannot acknowledge it.
 await post(o,body(`${H}\nopenai,synthetic-model,${prev},0,0,1.5,INV-SYN-001-D`),200,undefined,org);
 view=await get(o,'/api/operations',200,org);const alert=view.alerts.find(x=>x.id==='ai-invoice-variance');
 const seen=await get(a,'/api/operations',200,org);check(()=>{assert.equal(alert.count,1);assert.ok(seen.alerts.some(x=>x.id==='ai-invoice-variance'));assert.equal(seen.invoices.records.length,3);});
 await post(a,{type:'opsAcknowledgeAlert',alertId:'ai-invoice-variance',count:1,note:'Administrator looking into it'},403,undefined,org);
 await post(o,{type:'opsAcknowledgeAlert',alertId:'ai-invoice-variance',count:1,note:'Asked the provider for a corrected invoice'},200,undefined,org);
 view=await get(o,'/api/operations',200,org);check(()=>assert.equal(view.alerts.find(x=>x.id==='ai-invoice-variance').acknowledged.note,'Asked the provider for a corrected invoice'));
 // Audited with the reference, figures and the statement that budgets and rates were unchanged.
 const ws=await get(o,'/api/workspace',200,org);
 check(()=>{const lines=ws.audit.filter(e=>e.action==='opsInvoiceReconcile');assert.equal(lines.length,3);assert.ok(lines.some(e=>/Invoice INV-SYN-001 for provider openai, .* estimated (USD 0\.00|unknown \(no cost rates\)), 1 line\(s\), 1 above the 5% threshold\. Budgets and cost assumptions unchanged/.test(e.detail)));assert.ok(lines.some(e=>new RegExp(`Supersedes reconciliation ${r1.id}`).test(e.detail)));});
 // Leave the main organisation without an open invoice alert for later suites.
 view=await get(o,'/api/operations',200,org);await post(o,body(`${H}\nopenai,synthetic-model,${prev},0,0,0,INV-SYN-001-E`,{reason:'Closing synthetic review'}),200,undefined,org);
 view=await get(o,'/api/operations',200,org);check(()=>assert.ok(!view.alerts.some(x=>x.id==='ai-invoice-variance')));
 await get(o,'/api/workspace',200,org);
}
