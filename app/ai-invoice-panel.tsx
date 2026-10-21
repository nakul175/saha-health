'use client';
import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
const usd=(n:number|null)=>n===null?'Unknown (no cost rates)':'$'+n.toFixed(2);
const signed=(n:number|null,f:(x:number)=>string)=>n===null?'—':(n>0?'+':'')+f(n);
const tokens=(n:number)=>n.toLocaleString('en-US');
const FLAG:Record<string,string>={usd:'USD above threshold',tokens:'Tokens above threshold','no-rates':'No cost rates'};
const SOURCE:Record<string,string>={both:'',['invoice-only']:'Not in Saha records',['saha-only']:'Not on the invoice'};
// Slice 5h: owners record a provider invoice summary for one provider and month and compare it with Saha's
// estimates; administrators see the records. Records are append-only; a later one supersedes an earlier one.
export function AiInvoicePanel({invoices,isOwner,busy,save}:{invoices:{notice:string;columns:string[];maxLines:number;records:any[]}|null;isOwner:boolean;busy:boolean;save:(c:any)=>Promise<void>}){
 const [csv,setCsv]=useState(''),[threshold,setThreshold]=useState('5'),[reason,setReason]=useState('');
 if(!invoices)return null;
 const header=invoices.columns.join(',');
 return <section className="panel ops-panel" aria-labelledby="ai-invoice-title"><h2 id="ai-invoice-title"><ReceiptText size={20}/>AI invoice reconciliation</h2><p className="ops-meta">{invoices.notice}</p>
  {isOwner&&<form className="grid gap-2" onSubmit={e=>{e.preventDefault();void save({type:'opsInvoiceReconcile',csv,thresholdPercent:Number(threshold),reason});}}>
   <label htmlFor="invoice-csv" className="text-sm font-medium">Invoice summary for one provider and month (CSV, up to {invoices.maxLines} lines)</label>
   <p id="invoice-csv-help" className="ops-meta">Header: <code>{header}</code>. Record the provider&apos;s totals and the invoice reference only; do not attach or paste the invoice itself or any patient details.</p>
   <textarea id="invoice-csv" aria-describedby="invoice-csv-help" className="min-h-28 rounded-md border p-2 font-mono text-sm" value={csv} placeholder={`${header}\nopenai,gpt-4.1-mini,2026-08,120000,40000,0.52,INV-2026-08-001`} onChange={e=>setCsv(e.target.value)} maxLength={4000}/>
   <div className="flex flex-wrap gap-2"><Input className="max-w-40" aria-label="Flag threshold in percent" type="number" min="0.1" max="100" step="0.1" value={threshold} onChange={e=>setThreshold(e.target.value)}/><Input className="flex-1" aria-label="Reason for recording this reconciliation" placeholder="Reason, e.g. monthly invoice review" value={reason} onChange={e=>setReason(e.target.value)}/><Button type="submit" disabled={busy||!csv.trim()||reason.trim().length<5||!(Number(threshold)>=0.1&&Number(threshold)<=100)}>Record reconciliation</Button></div>
   <p className="ops-meta">A line is flagged when the token or USD difference exceeds this percentage of the invoiced figure. Recording never changes budgets or cost assumptions.</p>
  </form>}
  {!invoices.records.length?<p className="ops-meta">No invoice has been reconciled yet.</p>:invoices.records.map(r=><article key={r.id} className="grid gap-2" aria-labelledby={`inv-${r.id}`}>
   <h3 id={`inv-${r.id}`}>{r.provider} · {r.month} · invoice {r.invoiceReference} <span className="tag">{r.current?'Current':'Superseded'}</span></h3>
   <p className="ops-meta">Recorded {new Date(r.recordedAt).toLocaleString()} by {r.recordedByName} · threshold {r.thresholdPercent}% · invoiced {usd(r.totals.invoicedUsd)}, Saha estimate {usd(r.totals.estimatedUsd)} · {r.totals.flaggedLines} flagged line{r.totals.flaggedLines===1?'':'s'}{r.supersedes?' · supersedes an earlier reconciliation':''} · {r.reason}</p>
   {/* A focusable, labelled scroll region: nine columns overflow narrow screens. */}
   <div className="relative w-full overflow-x-auto" role="region" tabIndex={0} aria-label={`Invoice lines for ${r.provider} ${r.month}, invoice ${r.invoiceReference}`}><table data-slot="table" className="w-full caption-bottom text-sm"><TableHeader><TableRow><TableHead>Model</TableHead><TableHead>Saha requests</TableHead><TableHead>Saha tokens in / out</TableHead><TableHead>Invoiced tokens in / out</TableHead><TableHead>Token difference</TableHead><TableHead>Saha USD (estimate)</TableHead><TableHead>Invoiced USD</TableHead><TableHead>USD difference</TableHead><TableHead>Flag</TableHead></TableRow></TableHeader>
    <TableBody>{r.lines.map((l:any)=><TableRow key={l.model}><TableCell>{l.model}{SOURCE[l.source]&&<div className="muted text-sm">{SOURCE[l.source]}</div>}</TableCell><TableCell>{l.runs}{l.missingUsage?<div className="muted text-sm">{l.missingUsage} without usage</div>:null}</TableCell><TableCell>{tokens(l.estimated.inputTokens)} / {tokens(l.estimated.outputTokens)}</TableCell><TableCell>{tokens(l.invoiced.inputTokens)} / {tokens(l.invoiced.outputTokens)}</TableCell><TableCell>{signed(l.difference.inputTokens+l.difference.outputTokens,tokens)}{l.variance.tokensPercent!==null?` (${l.variance.tokensPercent}%)`:''}</TableCell><TableCell>{usd(l.estimated.usd)}</TableCell><TableCell>{usd(l.invoiced.usd)}</TableCell><TableCell>{signed(l.difference.usd,x=>'$'+x.toFixed(2))}{l.variance.usdPercent!==null?` (${l.variance.usdPercent}%)`:''}</TableCell><TableCell>{l.flags.length?<strong>{l.flags.map((f:string)=>FLAG[f]??f).join('; ')}</strong>:'Within threshold'}</TableCell></TableRow>)}</TableBody></table></div>
  </article>)}
 </section>;
}
