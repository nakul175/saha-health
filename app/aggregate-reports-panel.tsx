'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import { operationsOf } from '@/lib/saha/adapter-operations';
import type { Integration, Snapshot } from '@/lib/saha/types';
import CompletenessNotice from './reporting-completeness-notice';
type Command=(c:any,s?:string)=>Promise<any>;
const STATE:Record<string,string>={prepared:'Awaiting approval',approved:'Approved, not sent',sending:'Sending',accepted:'Received',rejected:'Rejected by destination',uncertain:'Outcome unknown',cancelled:'Not sent'};
const GROUP:Record<string,string>={none:'No grouping',village:'By village','programme':'By programme','age-band':'By age band'};
const today=()=>new Date().toISOString().slice(0,10),monthStart=()=>today().slice(0,8)+'01';
// Slice 7g: aggregate report delivery on an aggregate-only destination's card: prepare (owner, or supervisor for
// their teams), approve (a different authorised person), send, look up an unknown outcome, and the history with
// receipts, manifests and minimisation checks. Authorization is on the server; this only offers the actions.
export function AggregateReportsPanel({i,data,busy,command}:{i:Integration;data:Snapshot;busy:boolean;command:Command}){
 const [value,setValue]=useState<any>(null),[error,setError]=useState(''),[defs,setDefs]=useState<string[]>([]),[teams,setTeams]=useState<string[]>([]),[group,setGroup]=useState('none'),[start,setStart]=useState(monthStart()),[end,setEnd]=useState(today());
 const load=useCallback(async()=>{try{const r=await fetch('/api/aggregate-reports',{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}}),j:any=await r.json();if(!r.ok)throw Error(j.error);setValue(j);setError('');}catch(e){setError(e instanceof Error&&e.message?e.message:'Aggregate reports are unavailable.');}},[data.organisation.id]);
 const aggregateOnly=operationsOf(i).aggregateOnly;
 useEffect(()=>{if(aggregateOnly)load();},[load,aggregateOnly,data.organisation.revision]);
 if(i.kind!=='mis'||!aggregateOnly)return null;
 if(error)return <div className="aggregate-reports"><p className="text-sm muted">Aggregate reports: {error}</p></div>;
 if(!value)return <div className="aggregate-reports"><p className="text-sm muted">Loading aggregate reports…</p></div>;
 const run=async(c:any,label:string)=>{const r=await command(c,label);await load();return r;};
 const reports=(value.reports as any[]).filter(r=>r.destinationId===i.id),toggle=(xs:string[],x:string,on:boolean)=>on?[...xs,x]:xs.filter(y=>y!==x);
 return <section className="aggregate-reports" aria-label={`${i.name} aggregate reports`}>
  <h3>Aggregate reports</h3>
  <p className="text-sm muted">Only suppressed aggregate cells are sent: counts from 1 to 4 are never released, and every report passes a payload minimisation check before it is sent. A different authorised person approves each report; the preparer or approver sends it within {value.approvalHours} hours. Demonstration destination: nothing leaves Saha.</p>
  <details className="aggregate-prepare"><summary>Prepare a report</summary>
   <form className="form-stack" onSubmit={async e=>{e.preventDefault();const r=await run({type:'prepareAggregateReport',destinationId:i.id,definitions:defs,period:{start,end},teamIds:teams,group},'Aggregate report prepared');if(r){setDefs([]);}}}>
    <fieldset><legend>Indicators (current versions are pinned)</legend>{(value.catalogue as any[]).map(d=><label key={d.id} className="check-label"><Checkbox aria-label={d.title} checked={defs.includes(d.id)} disabled={busy||(!defs.includes(d.id)&&defs.length>=8)} onCheckedChange={on=>setDefs(toggle(defs,d.id,on===true))}/>{d.title} <span className="muted">v{d.version}</span></label>)}</fieldset>
    <fieldset><legend>Teams in your reporting scope</legend>{(value.teams as any[]).map(t=><label key={t.id} className="check-label"><Checkbox aria-label={t.name} checked={teams.includes(t.id)} disabled={busy} onCheckedChange={on=>setTeams(toggle(teams,t.id,on===true))}/>{t.name}</label>)}</fieldset>
    <div className="button-row"><label className="field"><span>Period start</span><Input type="date" value={start} max={end} onChange={e=>setStart(e.target.value)} required/></label><label className="field"><span>Period end</span><Input type="date" value={end} max={today()} onChange={e=>setEnd(e.target.value)} required/></label>
     <label className="field"><span>Grouping</span><NativeSelect value={group} onChange={e=>setGroup(e.target.value)}>{(value.groups as string[]).map(g=><option key={g} value={g}>{GROUP[g]??g}</option>)}</NativeSelect></label></div>
    <Button type="submit" variant="outline" disabled={busy||!defs.length||!teams.length}>Prepare report</Button>
   </form>
  </details>
  {!reports.length?<p className="text-sm muted">No aggregate reports for this destination yet.</p>:<ul className="aggregate-history" aria-label="Report history">{reports.map(r=>{const mine=r.preparedBy===value.viewer,sender=[r.preparedBy,r.approvedBy].includes(value.viewer),last=r.minimisation.at(-1);return <li key={r.id}>
   <div><strong>{STATE[r.state]??r.state}</strong> · {r.period.start} to {r.period.end} · {r.teamNames.join(', ')} · {GROUP[r.group]??r.group}</div>
   <div className="text-sm">{r.definitions.join(', ')} · {r.rowCount} rows · SHA-256 <code>{r.payloadSha256.slice(0,16)}…</code>{r.receipt&&<> · Receipt <strong>{r.receipt}</strong></>} · attempts {r.attempts}</div>
   <div className="text-sm muted">Prepared by {r.preparedByName} {new Date(r.preparedAt).toLocaleString()}{r.approvedByName&&<> · approved by {r.approvedByName}</>}{last&&<> · minimisation check ({last.stage}): {last.passed?`passed, ${last.fields} fields and ${last.cells} cells checked`:`failed: ${last.problems[0]}`}</>}</div>
   {r.reporting&&<><CompletenessNotice value={r.reporting} label="Aggregate report source completeness"/><div className="text-sm muted" aria-label="Aggregate report source freshness">{r.reporting.freshness.teams.flatMap((t:any)=>t.sources.map((s:any)=><p key={`${t.team}:${s.source}`}>{t.team} · {s.label}: latest {s.latestAt??'unknown'}; arrivals {s.arrivals}; late {s.late}{s.lateShare===null?'':` (${s.lateShare}%)`}.</p>))}</div></>}
   <p className="text-sm">{r.message}</p>
   <div className="button-row">
    {r.state==='prepared'&&!mine&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>run({type:'approveAggregateReport',reportId:r.id,payloadSha256:r.payloadSha256},'Aggregate report approved')}>Approve this report</Button>}
    {r.state==='prepared'&&mine&&<span className="text-sm muted">Awaiting approval by another authorised person.</span>}
    {r.state==='approved'&&sender&&<Button size="sm" disabled={busy} onClick={()=>run({type:'sendAggregateReport',reportId:r.id},'Aggregate report sent')}>Send report</Button>}
    {r.state==='uncertain'&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>run({type:'lookupAggregateReport',reportId:r.id},'Receipt lookup finished')}>Look up receipt</Button>}
   </div>
   <details><summary>Manifest and steps</summary>
    {/* Slice 6ad: figures go to the destination only; a reader sees which blocks were released or withheld. */}
    {r.blocks?<table className="aggregate-cells"><caption className="sr-only">Report blocks</caption><thead><tr><th scope="col">Team</th><th scope="col">Indicator</th><th scope="col">Status</th></tr></thead><tbody>{(r.blocks as any[]).map((b:any)=><tr key={b.team+b.indicator}><td>{b.team}</td><td>{b.indicator} v{b.version}</td><td>{b.withheld?`Withheld (${b.withheld==='cohort'?'cohort below minimum':'differencing protection'})`:'Included in the report'}</td></tr>)}</tbody></table>:<p className="text-sm muted">This report is closed; its payload is not kept and can be recomputed from the pinned definitions.</p>}
    <p className="text-sm muted">The figures are sent to the destination only and are not shown here: they were checked for small groups against what the destination has received, not against what you have been shown. Run the same indicators on the indicator page to see them.</p>
    <p className="text-sm muted">Manifest: {r.definitions.join(', ')} · {r.rowCount} rows · SHA-256 {r.payloadSha256}</p>
    <ol className="text-sm">{(r.events as any[]).map((e,n)=><li key={n}>{new Date(e.at).toLocaleString()} · {STATE[e.state]??e.state} · {e.detail}{e.ref?` (${e.ref.command})`:''}</li>)}</ol>
   </details>
  </li>;})}</ul>}
 </section>;
}
