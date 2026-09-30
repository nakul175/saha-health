'use client';
import { useCallback, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import type { Snapshot } from '@/lib/saha/types';
const GROUP_LABEL:Record<string,string>={none:'No grouping',team:'By team',village:'By village',programme:'By programme','age-band':'By age band'};
const ALL='__all';

// Slice 6d: catalogue indicators over the manager's scope, with small-cell suppression and a governed question box.
export function IndicatorsPanel({data}:{data:Snapshot}){
 const [cat,setCat]=useState<any>(null),[ids,setIds]=useState<string[]>([]),[days,setDays]=useState('30'),[group,setGroup]=useState('none'),[team,setTeam]=useState(ALL),[village,setVillage]=useState(ALL),[programme,setProgramme]=useState(ALL),[question,setQuestion]=useState(''),[interp,setInterp]=useState<any>(null),[result,setResult]=useState<any>(null),[error,setError]=useState('');
 const get=useCallback(async(q:Record<string,string>)=>{const r=await fetch('/api/indicators',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','x-saha-organisation':data.organisation.id},body:JSON.stringify(q)});const j:any=await r.json();if(!r.ok)throw Error(j.error??'Indicators unavailable.');return j;},[data.organisation.id]);
 useEffect(()=>{get({}).then(setCat).catch(()=>setCat(null));},[get]);
 if(!cat)return null;
 const run=async(q?:{ids:string[];days:number;group:string})=>{setError('');try{const x=q??{ids,days:Number(days),group};setResult(await get({ids:x.ids.join(','),days:String(x.days),group:x.group,...(team!==ALL?{team}:{}),...(village!==ALL?{village}:{}),...(programme!==ALL?{programme}:{})}));}catch(e){setResult(null);setError(e instanceof Error?e.message:'Indicators unavailable.');}};
 const ask=async()=>{setError('');try{const j=await get({question});setInterp(j.interpretation);if(j.interpretation.understood){setIds(j.interpretation.ids);setDays(String(j.interpretation.days));setGroup(j.interpretation.group);}}catch(e){setError(e instanceof Error?e.message:'Question not understood.');}};
 const pick=(label:string,value:string,set:(v:string)=>void,items:{id:string;name:string}[])=><Select value={value} onValueChange={set}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>;
 return <section className="panel member-panel"><div className="section-heading"><h2><BarChart3 size={19}/> Indicators</h2><span className="muted text-sm">Catalogue only · cells under {cat.minimumCell} suppressed</span></div>
  <div className="form-grid"><Input aria-label="Ask about an indicator" placeholder="For example: overdue follow-ups by village last 30 days" value={question} onChange={e=>setQuestion(e.target.value)}/><Button variant="outline" disabled={question.trim().length<3} onClick={ask}>Interpret</Button></div>
  {interp&&<p className="notice">{interp.understood?`Understood as: ${interp.ids.map((id:string)=>cat.catalogue.find((c:any)=>c.id===id)?.title).join(', ')} · ${GROUP_LABEL[interp.group]} · last ${interp.days} days. `:''}{interp.note}</p>}
  <fieldset><legend>Indicators</legend>{cat.catalogue.map((c:any)=><label key={c.id} className="check-row" title={`${c.numerator}${c.denominator?` / ${c.denominator}`:''}. Excludes: ${c.exclusions}. Owner: ${c.owner}. Version ${c.version}.`}><Checkbox checked={ids.includes(c.id)} onCheckedChange={v=>setIds(v?[...ids,c.id]:ids.filter(x=>x!==c.id))}/>{c.title}</label>)}</fieldset>
  <div className="form-grid">{pick('Window',days,setDays,[7,30,90,365].map(n=>({id:String(n),name:`Last ${n} days`})))}{pick('Grouping',group,setGroup,cat.groups.map((g:string)=>({id:g,name:GROUP_LABEL[g]})))}{pick('Team filter',team,setTeam,[{id:ALL,name:'All my teams'},...cat.teams.map((t:any)=>({id:t.id,name:t.name}))])}{pick('Village filter',village,setVillage,[{id:ALL,name:'All villages'},...cat.villages.map((v:string)=>({id:v,name:v}))])}{pick('Programme filter',programme,setProgramme,[{id:ALL,name:'All programmes'},...cat.programmes.map((v:string)=>({id:v,name:v}))])}</div>
  <Button disabled={!ids.length} onClick={()=>run()}>Run indicators</Button>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {result&&<><p className="muted text-sm">Computed {new Date(result.computedAt).toLocaleString()} over {result.cohort.people} people · latest source record {result.latestSourceRecord?new Date(result.latestSourceRecord).toLocaleString():'none'} · {result.scope}</p>
   {result.results.map((r:any)=><div key={r.id}><h3>{r.title} <span className="muted text-sm">v{r.version}</span></h3><Table><TableHeader><TableRow><TableHead>Group</TableHead><TableHead>{r.unit==='proportion'?'Percent':'Count'}</TableHead>{r.unit==='proportion'&&<TableHead>Numerator / denominator</TableHead>}</TableRow></TableHeader><TableBody>{r.rows.map((x:any)=><TableRow key={x.group}><TableCell>{x.group}</TableCell><TableCell>{x.suppressed?<span className="tag">suppressed</span>:r.unit==='proportion'?(x.value===null?'—':`${x.value}%`):x.value}</TableCell>{r.unit==='proportion'&&<TableCell>{x.suppressed?'—':`${x.numerator} / ${x.denominator}`}</TableCell>}</TableRow>)}</TableBody></Table></div>)}</>}
 </section>;
}
