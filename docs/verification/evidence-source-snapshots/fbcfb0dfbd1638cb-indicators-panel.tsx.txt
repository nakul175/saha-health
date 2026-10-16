'use client';
import CompletenessNotice from './reporting-completeness-notice';
import { useCallback, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import type { Snapshot } from '@/lib/saha/types';
import { IndicatorRegistryPanel } from './indicator-registry-panel';
const GROUP_LABEL:Record<string,string>={none:'No grouping',team:'By team',village:'By village',programme:'By programme','age-band':'By age band'};
const ALL='__all';

// Slice 6d: catalogue indicators over the manager's scope, with small-cell suppression and a governed question box.
// Slice 6s: results name the definition version used; withheld results say why; CSV keeps the suppression.
export function IndicatorsPanel({data,command,busy=false}:{data:Snapshot;command?:(c:any,s?:string)=>Promise<any>;busy?:boolean}){
 const [cat,setCat]=useState<any>(null),[ids,setIds]=useState<string[]>([]),[days,setDays]=useState('30'),[group,setGroup]=useState('none'),[team,setTeam]=useState(ALL),[village,setVillage]=useState(ALL),[programme,setProgramme]=useState(ALL),[question,setQuestion]=useState(''),[interp,setInterp]=useState<any>(null),[result,setResult]=useState<any>(null),[error,setError]=useState(''),[exported,setExported]=useState('');
 const get=useCallback(async(q:Record<string,string>)=>{const r=await fetch('/api/indicators',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','x-saha-organisation':data.organisation.id},body:JSON.stringify(q)});const j:any=await r.json();if(!r.ok)throw Error(j.error??'Indicators unavailable.');return j;},[data.organisation.id]);
 const reload=useCallback(async()=>{try{setCat(await get({}));}catch{setCat(null);}},[get]);
 useEffect(()=>{reload();},[reload]);
 if(!cat)return null;
 const query=(x:{ids:string[];days:number;group:string})=>({ids:x.ids.join(','),days:String(x.days),group:x.group,...(team!==ALL?{team}:{}),...(village!==ALL?{village}:{}),...(programme!==ALL?{programme}:{})});
 const run=async(q?:{ids:string[];days:number;group:string})=>{setError('');try{const x=q??{ids,days:Number(days),group};setResult(await get(query(x)));}catch(e){setResult(null);setError(e instanceof Error?e.message:'Indicators unavailable.');}};
 const csv=async()=>{setError('');setExported('');try{const r=await fetch('/api/indicators',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','x-saha-organisation':data.organisation.id},body:JSON.stringify({...query({ids,days:Number(days),group}),format:'csv'})});if(!r.ok){const j:any=await r.json().catch(()=>({}));throw Error(j.error??'Export unavailable.');}const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='saha-indicators.csv';a.click();URL.revokeObjectURL(url);setExported(`Downloaded draft export ${r.headers.get('x-saha-export-id')} · SHA-256 ${r.headers.get('x-saha-content-sha256')?.slice(0,12)}…`);}catch(e){setError(e instanceof Error?e.message:'Export unavailable.');}};
 const ask=async()=>{setError('');try{const j=await get({question});setInterp(j.interpretation);if(j.interpretation.understood){setIds(j.interpretation.ids);setDays(String(j.interpretation.days));setGroup(j.interpretation.group);}}catch(e){setError(e instanceof Error?e.message:'Question not understood.');}};
 const pick=(label:string,value:string,set:(v:string)=>void,items:{id:string;name:string}[])=><Select value={value} onValueChange={set}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>;
 return <section className="panel member-panel"><div className="section-heading"><h2><BarChart3 size={19}/> Indicators</h2><span className="muted text-sm">Catalogue only · cells under {cat.minimumCell} suppressed</span></div>
  <div className="form-grid"><Input aria-label="Ask about an indicator" placeholder="For example: overdue follow-ups by village last 30 days" value={question} onChange={e=>setQuestion(e.target.value)}/><Button variant="outline" disabled={question.trim().length<3} onClick={ask}>Interpret</Button></div>
  {interp&&<p className="notice">{interp.understood?`Understood as: ${interp.ids.map((id:string)=>cat.catalogue.find((c:any)=>c.id===id)?.title).join(', ')} · ${GROUP_LABEL[interp.group]} · last ${interp.days} days. `:''}{interp.note}</p>}
  <fieldset><legend>Indicators</legend>{cat.catalogue.map((c:any)=><label key={c.id} className="check-row" title={`${c.numerator}${c.denominator?` / ${c.denominator}`:''}. Excludes: ${c.exclusions}. Owner: ${c.owner}. Version ${c.version}.`}><Checkbox checked={ids.includes(c.id)} onCheckedChange={v=>setIds(v?[...ids,c.id]:ids.filter(x=>x!==c.id))}/>{c.title}</label>)}</fieldset>
  <div className="form-grid">{pick('Window',days,setDays,[7,30,90,365].map(n=>({id:String(n),name:`Last ${n} days`})))}{pick('Grouping',group,setGroup,cat.groups.map((g:string)=>({id:g,name:GROUP_LABEL[g]})))}{pick('Team filter',team,setTeam,[{id:ALL,name:'All my teams'},...cat.teams.map((t:any)=>({id:t.id,name:t.name}))])}{pick('Village filter',village,setVillage,[{id:ALL,name:'All villages'},...cat.villages.map((v:string)=>({id:v,name:v}))])}{pick('Programme filter',programme,setProgramme,[{id:ALL,name:'All programmes'},...cat.programmes.map((v:string)=>({id:v,name:v}))])}</div>
  <div className="form-grid"><Button disabled={!ids.length} onClick={()=>run()}>Run indicators</Button><Button variant="outline" disabled={!ids.length} onClick={csv}>Download CSV</Button></div>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {exported&&<p role="status" className="notice">{exported}</p>}
  {result&&<><p className="muted text-sm">Computed {new Date(result.computedAt).toLocaleString()} over {result.cohort.people} people · latest source record {result.latestSourceRecord?new Date(result.latestSourceRecord).toLocaleString():'none'} · {result.scope}</p>
   {result.completeness&&<CompletenessNotice value={result.completeness}/>}
   {result.freshness&&<Freshness f={result.freshness}/>}
   {result.results.map((r:any)=><div key={r.id}><h3>{r.title} <span className="muted text-sm">definition {r.id} v{r.version}</span></h3>{r.lateArrivals&&!r.refused&&<p className="muted text-sm">{r.lateArrivals.applicable&&r.lateArrivals.since?`Since your previous release (${new Date(r.lateArrivals.since).toLocaleString()}): late visits now counted ${r.lateArrivals.count}.`:r.lateArrivals.note}</p>}{r.refused?<p className="notice amber-notice">{r.message}</p>:<Table><TableHeader><TableRow><TableHead>Group</TableHead><TableHead>{r.unit==='proportion'?'Percent':'Count'}</TableHead>{r.unit==='proportion'&&<TableHead>Numerator / denominator</TableHead>}</TableRow></TableHeader><TableBody>{r.rows.map((x:any)=><TableRow key={x.group}><TableCell>{x.group}</TableCell><TableCell>{x.suppressed?<span className="tag">suppressed</span>:r.unit==='proportion'?(x.value===null?'—':`${x.value}%`):x.value}</TableCell>{r.unit==='proportion'&&<TableCell>{x.suppressed?'—':`${x.numerator} / ${x.denominator}`}</TableCell>}</TableRow>)}</TableBody></Table>}</div>)}</>}
  {command&&<IndicatorRegistryPanel cat={cat} busy={busy} command={command} reload={reload} runVersion={ref=>{setIds([ref]);run({ids:[ref],days:Number(days),group});}}/>}
 </section>;
}
// Slice 6ac: source freshness per team the viewer belongs to, with banded counts and a data-still-syncing warning.
function Freshness({f}:{f:any}){
 return <div><h3>Source freshness</h3><p className="muted text-sm">{f.note}</p>
  {f.teams.map((t:any)=><div key={t.team}>{t.syncing&&<p role="status" className="notice amber-notice">{t.team}: {t.syncing.message}</p>}
   <Table><TableHeader><TableRow><TableHead>{t.team}: source</TableHead><TableHead>Latest record</TableHead><TableHead>Arrived in window</TableHead><TableHead>Late (over {f.thresholdHours} h)</TableHead><TableHead>Late share</TableHead></TableRow></TableHeader>
    <TableBody>{t.sources.map((x:any)=><TableRow key={x.source}><TableCell title={`Arrival: ${x.arrival}. Described time: ${x.described}.`}>{x.label}</TableCell><TableCell>{x.latestAt?new Date(x.latestAt).toLocaleString():'none'}</TableCell><TableCell>{x.arrivals}</TableCell><TableCell>{x.late}</TableCell><TableCell title={x.lateShareNote??''}>{x.lateShare===null?'not stated':`about ${x.lateShare}%`}</TableCell></TableRow>)}</TableBody></Table></div>)}
 </div>;
}
