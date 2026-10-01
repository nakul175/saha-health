'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
type Command=(c:any,s?:string)=>Promise<any>;
const NONE='__none',NEW='__new';
const blank={title:'',unit:'count',numerator:'visits-confirmed',denominator:NONE,programme:NONE,ageBand:NONE,sex:NONE,exclude:[] as string[],exclusionsNote:'',owner:'',cadence:'Monthly',minimumCohort:'5'};
// Slice 6s: the owner-maintained indicator registry. Every version is listed with its reason; owners add,
// revise and retire definitions built from the fixed vocabulary. Any recorded version can be run again.
export function IndicatorRegistryPanel({cat,busy,command,reload,runVersion}:{cat:any;busy:boolean;command:Command;reload:()=>Promise<void>;runVersion:(ref:string)=>void}){
 const [target,setTarget]=useState(NEW),[id,setId]=useState(''),[f,setF]=useState(blank),[reason,setReason]=useState(''),[history,setHistory]=useState(false);
 const v=cat.vocabulary,current=cat.catalogue as any[],label=(m:string)=>v.measures.find((x:any)=>x.id===m)?.label??m;
 const set=(k:string,x:any)=>setF({...f,[k]:x});
 const choose=(t:string)=>{setTarget(t);if(t===NEW){setF(blank);return;}const d=current.find(x=>x.id===t);if(!d)return;setF({title:d.title,unit:d.unit,numerator:d.numeratorMeasure,denominator:d.denominatorMeasure??NONE,programme:d.filters.programme??NONE,ageBand:d.filters.ageBand??NONE,sex:d.filters.sex??NONE,exclude:d.exclude,exclusionsNote:d.exclusions==='None'?'':d.exclusions,owner:d.owner,cadence:d.cadence,minimumCohort:String(d.minimumCohort)});};
 const spec=()=>({title:f.title.trim(),unit:f.unit,numerator:f.numerator,denominator:f.denominator===NONE?null:f.denominator,filters:{...(f.programme!==NONE?{programme:f.programme}:{}),...(f.ageBand!==NONE?{ageBand:f.ageBand}:{}),...(f.sex!==NONE?{sex:f.sex}:{})},exclude:f.exclude,exclusionsNote:f.exclusionsNote.trim(),owner:f.owner.trim(),cadence:f.cadence,minimumCohort:Number(f.minimumCohort)});
 const done=async(r:any)=>{if(r){setReason('');if(target===NEW){setId('');setF(blank);}await reload();}};
 const latest=current.find(x=>x.id===target);
 const save=async()=>done(target===NEW?await command({type:'addIndicatorDefinition',id:id.trim(),spec:spec(),reason},'Indicator definition added.'):await command({type:'reviseIndicatorDefinition',id:target,expectedVersion:latest.version,spec:spec(),reason},'Indicator definition revised.'));
 const retire=async()=>{if(latest&&await command({type:'retireIndicatorDefinition',id:target,expectedVersion:latest.version,reason},'Indicator definition retired.')){setTarget(NEW);setF(blank);setReason('');await reload();}};
 const pick=(lbl:string,value:string,onChange:(x:string)=>void,items:{id:string;name:string}[])=><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={lbl}><SelectValue/></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>;
 const measures=v.measures.map((m:any)=>({id:m.id,name:m.label}));
 return <div className="indicator-registry"><h3>Indicator registry</h3>
  <p className="muted text-sm">Definitions are versioned and never edited in place. Each result names the version it used; any recorded version can be run again to reproduce an earlier result.</p>
  <Table><TableHeader><TableRow><TableHead>Indicator</TableHead><TableHead>Version</TableHead><TableHead>Definition</TableHead><TableHead>Owner · cadence</TableHead><TableHead>Minimum cohort</TableHead></TableRow></TableHeader><TableBody>{current.map(d=><TableRow key={d.id}><TableCell>{d.title}{d.builtIn?'':' (organisation)'}</TableCell><TableCell>v{d.version}</TableCell><TableCell className="text-sm">{d.numerator}{d.denominator?` ÷ ${d.denominator}`:''}{Object.keys(d.filters).length?` · only ${Object.values(d.filters).join(', ')}`:''}{d.exclude.length?` · excluding ${d.exclude.join(', ')}`:''}</TableCell><TableCell>{d.owner} · {d.cadence}</TableCell><TableCell>{d.minimumCohort}</TableCell></TableRow>)}</TableBody></Table>
  <Button variant="outline" onClick={()=>setHistory(!history)} aria-expanded={history}>{history?'Hide version history':'Show version history'}</Button>
  {history&&<Table><TableHeader><TableRow><TableHead>Indicator</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Recorded</TableHead><TableHead>Reason</TableHead><TableHead><span className="sr-only">Run</span></TableHead></TableRow></TableHeader><TableBody>{(cat.registry as any[]).filter(r=>!r.builtIn||cat.registry.some((x:any)=>x.id===r.id&&!x.builtIn)).map(r=><TableRow key={r.id+r.version}><TableCell>{r.title} <span className="muted text-sm">{r.id}</span></TableCell><TableCell>v{r.version}</TableCell><TableCell>{r.status}</TableCell><TableCell>{new Date(r.at).toLocaleDateString()} · {r.by}</TableCell><TableCell className="text-sm">{r.reason}</TableCell><TableCell>{r.status==='active'&&<Button variant="outline" size="sm" onClick={()=>runVersion(`${r.id}@${r.version}`)} aria-label={`Run ${r.title} version ${r.version}`}>Run v{r.version}</Button>}</TableCell></TableRow>)}</TableBody></Table>}
  {cat.canMaintain&&cat.protection&&<p className="notice amber-notice" role="note">{cat.protection}</p>}
  {cat.canMaintain&&<fieldset className="registry-form"><legend>Maintain a definition (owners)</legend>
   <div className="form-grid">{pick('Definition to maintain',target,choose,[{id:NEW,name:'New definition'},...current.map(d=>({id:d.id,name:`${d.title} (v${d.version})`}))])}
    {target===NEW&&<Input aria-label="Identifier" placeholder="Identifier, e.g. older-adults-seen" value={id} onChange={e=>setId(e.target.value)}/>}
    <Input aria-label="Title" placeholder="Title" value={f.title} onChange={e=>set('title',e.target.value)}/>
    {pick('Unit',f.unit,x=>set('unit',x),[{id:'count',name:'Count'},{id:'proportion',name:'Proportion'}])}
    {pick('Numerator',f.numerator,x=>set('numerator',x),measures)}
    {pick('Denominator',f.denominator,x=>set('denominator',x),[{id:NONE,name:'No denominator'},...measures])}
    {pick('Programme filter for this definition',f.programme,x=>set('programme',x),[{id:NONE,name:'Any programme'},...v.filters.programme.map((x:string)=>({id:x,name:x}))])}
    {pick('Age band filter for this definition',f.ageBand,x=>set('ageBand',x),[{id:NONE,name:'Any age'},...v.filters.ageBand.map((x:string)=>({id:x,name:`Age ${x}`}))])}
    {pick('Sex filter for this definition',f.sex,x=>set('sex',x),[{id:NONE,name:'Any sex'},...v.filters.sex.map((x:string)=>({id:x,name:x}))])}
    {pick('Cadence',f.cadence,x=>set('cadence',x),v.cadences.map((x:string)=>({id:x,name:x})))}
    <Input aria-label="Minimum cohort" type="number" min={v.minimumCohort} max={1000} value={f.minimumCohort} onChange={e=>set('minimumCohort',e.target.value)}/>
    <Input aria-label="Definition owner" placeholder="Owner, e.g. Programme manager" value={f.owner} onChange={e=>set('owner',e.target.value)}/>
    <Input aria-label="Exclusions note" placeholder="Exclusions in words" value={f.exclusionsNote} onChange={e=>set('exclusionsNote',e.target.value)}/></div>
   <div>{v.exclusions.map((x:string)=><label key={x} className="check-row"><Checkbox checked={f.exclude.includes(x)} onCheckedChange={c=>set('exclude',c?[...f.exclude,x]:f.exclude.filter(y=>y!==x))}/>Exclude {x==='identity-provisional'?'provisional identities':'patients with no programme'}</label>)}</div>
   <p className="muted text-sm">Numerator: {label(f.numerator)}{f.denominator!==NONE?`. Denominator: ${label(f.denominator)}`:''}.</p>
   <Input aria-label="Reason for this change" placeholder="Reason (recorded with the version)" value={reason} onChange={e=>setReason(e.target.value)}/>
   <div className="form-grid"><Button disabled={busy||reason.trim().length<10||f.title.trim().length<3||f.owner.trim().length<2||(target===NEW&&!id.trim())} onClick={save}>{target===NEW?'Add definition':'Save as new version'}</Button>
    {target!==NEW&&<Button variant="outline" disabled={busy||reason.trim().length<10} onClick={retire}>Retire definition</Button>}</div>
  </fieldset>}
 </div>;
}
