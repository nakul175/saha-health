'use client';
import { useCallback, useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import type { Snapshot } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
const label=(s:string)=>s.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase());

// Slice 6c: owners set retention schedules, place and release holds, and review what would be eligible. Nothing is deleted.
export function RetentionPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:Command}){
 const [view,setView]=useState<any>(null),[years,setYears]=useState<Record<string,string>>({}),[basis,setBasis]=useState(''),[scope,setScope]=useState('person'),[personId,setPersonId]=useState(''),[reason,setReason]=useState(''),[reference,setReference]=useState(''),[release,setRelease]=useState('');
 const load=useCallback(async()=>{const r=await fetch('/api/retention',{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}});if(r.ok){const j:any=await r.json();setView(j);setYears(Object.fromEntries((j.policy?.rules??[]).map((x:any)=>[x.recordClass,String(x.years)])));}},[data.organisation.id]);
 useEffect(()=>{if(data.canManage)load();},[load,data.canManage]);
 const run=async(body:any,ok:string)=>{const r=await command(body,ok);if(r)await load();return r;};
 if(!data.canManage||!view)return null;
 const rules=view.classes.filter((c:any)=>years[c.recordClass]).map((c:any)=>({recordClass:c.recordClass,years:Number(years[c.recordClass])}));
 return <section className="panel member-panel"><div className="section-heading"><h2><Archive size={19}/> Retention and holds</h2><span className="muted text-sm">{view.policy?`Schedule version ${view.policy.version}`:'No schedule set'}</span></div>
  <p className="notice amber-notice">{view.disposal}</p>
  <Table><TableHeader><TableRow><TableHead>Record class</TableHead><TableHead>Counted from</TableHead><TableHead>Keep for (years)</TableHead><TableHead>Records</TableHead><TableHead>Past schedule</TableHead><TableHead>Held</TableHead><TableHead>Would be eligible</TableHead></TableRow></TableHeader><TableBody>{view.review.map((r:any)=><TableRow key={r.recordClass}><TableCell>{label(r.recordClass)}</TableCell><TableCell className="muted">{r.trigger}</TableCell><TableCell><Input aria-label={`Years to keep ${label(r.recordClass)}`} type="number" min={1} max={50} value={years[r.recordClass]??''} onChange={e=>setYears({...years,[r.recordClass]:e.target.value})}/></TableCell><TableCell>{r.total}</TableCell><TableCell>{r.years?r.pastSchedule:'—'}</TableCell><TableCell>{r.held}</TableCell><TableCell>{r.years?r.eligible:'—'}</TableCell></TableRow>)}</TableBody></Table>
  <div className="form-grid"><Input aria-label="Basis for the schedule" placeholder="Basis, e.g. approved records policy reference" value={basis} onChange={e=>setBasis(e.target.value)}/><Button disabled={busy||!rules.length||rules.some((r:any)=>!(r.years>=1&&r.years<=50))||basis.trim().length<10} onClick={()=>run({type:'retentionPolicySet',rules,basis},'Retention schedule saved.')}>Save schedule</Button></div>
  <h3>Holds</h3>{view.holds.length?<ul className="revision-list">{view.holds.map((h:any)=><li key={h.id}><strong>{h.scope==='organisation'?'Whole organisation':h.personName}</strong> · {h.reference} · {h.reason} · {h.released?`released ${new Date(h.released.at).toLocaleDateString()}`:'current'}{!h.released&&<Button size="sm" variant="ghost" disabled={busy||release.trim().length<10} onClick={()=>run({type:'retentionHoldRelease',holdId:h.id,reason:release},'Hold released.')}>Release</Button>}</li>)}</ul>:<p className="muted">No holds.</p>}
  {view.holds.some((h:any)=>!h.released)&&<Input aria-label="Reason to release a hold" placeholder="Reason to release a hold, at least ten characters" value={release} onChange={e=>setRelease(e.target.value)}/>}
  <div className="form-grid"><Select value={scope} onValueChange={setScope}><SelectTrigger aria-label="Hold scope"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="person">One patient</SelectItem><SelectItem value="organisation">Whole organisation</SelectItem></SelectContent></Select>{scope==='person'&&<Select value={personId} onValueChange={setPersonId}><SelectTrigger aria-label="Patient to hold"><SelectValue placeholder="Patient in your scope"/></SelectTrigger><SelectContent>{data.people.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>}<Input aria-label="Hold reference" placeholder="Case or request reference" value={reference} onChange={e=>setReference(e.target.value)}/><Input aria-label="Hold reason" placeholder="Why records must be kept" value={reason} onChange={e=>setReason(e.target.value)}/><Button variant="outline" disabled={busy||(scope==='person'&&!personId)||reference.trim().length<3||reason.trim().length<10} onClick={()=>run({type:'retentionHoldPlace',scope,...(scope==='person'?{personId}:{}),reason,reference},'Hold placed.').then(r=>{if(r){setReason('');setReference('');}})}>Place hold</Button></div>
 </section>;
}
