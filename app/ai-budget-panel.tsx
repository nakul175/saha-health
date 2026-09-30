'use client';
import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
const STATE:Record<string,string>={within:'Within budget',near:'80% or more used',reached:'Reached: new requests refused','no-rates':'No cost rates: requests refused','no-budget':'No budget set','no-charge':'Local rules, no charge'};
const usd=(n:number|null)=>n===null?'—':'$'+n.toFixed(2);
// Slice 5a: monthly cost budgets per AI capability on the Operations page. Owners set them;
// administrators see them. Figures are estimates from recorded cost assumptions, not invoices.
export function AiBudgetPanel({budgets,isOwner,busy,save}:{budgets:{notice:string;month:string;rows:any[]}|null;isOwner:boolean;busy:boolean;save:(c:any)=>Promise<void>}){
 const [amount,setAmount]=useState<Record<string,string>>({}),[reason,setReason]=useState<Record<string,string>>({});
 if(!budgets)return null;
 return <section className="panel ops-panel" aria-labelledby="ai-budget-title"><h2 id="ai-budget-title"><Wallet size={20}/>AI capability budgets · {budgets.month}</h2><p className="ops-meta">{budgets.notice} When a budget is reached, new requests for that capability are refused before anything is sent and the worker continues with structured capture; no other model is chosen.</p>
  {budgets.rows.length?<Table><TableHeader><TableRow><TableHead>Capability</TableHead><TableHead>Monthly budget</TableHead><TableHead>Used (estimate)</TableHead><TableHead>Reserved</TableHead><TableHead>Remaining</TableHead><TableHead>Status</TableHead>{isOwner&&<TableHead>Change</TableHead>}</TableRow></TableHeader><TableBody>{budgets.rows.map(r=><TableRow key={r.capabilityKey}><TableCell><strong>{r.title}</strong><small className="audit-actor">{r.capabilityKey} · {r.providerId}{r.missingUsage?` · ${r.missingUsage} calls without usage, counted at the reserved allowance`:''}</small></TableCell><TableCell>{usd(r.monthlyUsd)}</TableCell><TableCell>{usd(r.spentUsd)}</TableCell><TableCell>{usd(r.reservedUsd)}</TableCell><TableCell>{usd(r.remainingUsd)}</TableCell><TableCell className={r.state==='reached'||r.state==='no-rates'?'ops-alert':''}>{STATE[r.state]??r.state}</TableCell>
   {isOwner&&<TableCell>{r.providerId==='local'?<span className="muted text-sm">Not needed</span>:<div className="grid gap-2"><Input aria-label={`Monthly budget in USD for ${r.title}`} type="number" min="0.01" step="0.01" placeholder="USD per month" value={amount[r.capabilityKey]??''} onChange={e=>setAmount({...amount,[r.capabilityKey]:e.target.value})}/><Input aria-label={`Reason for the budget change for ${r.title}`} placeholder="Reason, e.g. contract reference" value={reason[r.capabilityKey]??''} onChange={e=>setReason({...reason,[r.capabilityKey]:e.target.value})}/><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy||!(Number(amount[r.capabilityKey])>=0.01)||(reason[r.capabilityKey]??'').trim().length<5} onClick={()=>save({type:'opsBudget',capabilityKey:r.capabilityKey,monthlyUsd:Number(amount[r.capabilityKey]),reason:reason[r.capabilityKey]})}>Set budget</Button>{r.monthlyUsd!==null&&<Button size="sm" variant="ghost" disabled={busy||(reason[r.capabilityKey]??'').trim().length<5} onClick={()=>save({type:'opsBudget',capabilityKey:r.capabilityKey,monthlyUsd:null,reason:reason[r.capabilityKey]})}>Clear budget</Button>}</div></div>}</TableCell>}
  </TableRow>)}</TableBody></Table>:<p className="ops-meta">No AI capability has been registered in clinical governance yet.</p>}
 </section>;
}
