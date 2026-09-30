'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FACT_SOURCES, MEASURE_LABEL, RECORDED_SOURCES, SOURCE_LABEL, factProvenance, measureValue } from '@/lib/saha/fact-provenance';
import type { Facts, FactSource, Measure, Person } from '@/lib/saha/types';
// Slice 2c: source and observation time for each measurement (BR-DATA-02). "Same as visit" keeps the visit-level
// source and time; a blank measurement may record why it is missing.
export function visitMeasures(p:Person,f:Facts):Measure[]{
 const wanted:Measure[]=['bloodPressure','weight','temperature'];
 if(p.programmes.includes('Maternal care')||f.weeks||f.provenance?.weeks)wanted.push('weeks');
 if(p.programmes.includes('TB screening')||f.coughDays||f.provenance?.coughDays)wanted.push('coughDays');
 return wanted;
}
export function ProvenanceEditor({facts,measures,onChange}:{facts:Facts;measures:Measure[];onChange:(f:Facts)=>void}){
 const set=(m:Measure,next:{source?:string;at?:string})=>{const current=facts.provenance?.[m],source=next.source??current?.source??'visit',at=next.at??current?.at??'',provenance={...(facts.provenance??{})};
  if(source==='visit')delete provenance[m];else provenance[m]={source:source as FactSource,...(at?{at}:{})};
  const {provenance:_old,...rest}=facts;onChange(Object.keys(provenance).length?{...rest,provenance}:rest);};
 return <details className="provenance-editor" open={!!facts.provenance}><summary>Source and time for each measurement</summary>
  <p className="muted text-sm">“Same as visit” uses the source and time above. For a blank measurement you may record why it is missing; it stays unknown and is never read as normal.</p>
  {measures.map(m=>{const p=facts.provenance?.[m],value=measureValue(facts,m),shown=m==='bloodPressure'?(facts.systolic||facts.diastolic?`${facts.systolic||'?'}/${facts.diastolic||'?'}`:''):value;
   return <div className="provenance-row" key={m}><div className="form-grid three"><div className="provenance-label"><strong>{MEASURE_LABEL[m]}</strong><span className="muted text-sm">{shown?`Value ${shown}`:'No value'}</span></div>
    <label className="field"><span>{MEASURE_LABEL[m]} source</span><Select value={p?.source??'visit'} onValueChange={s=>set(m,{source:s})}><SelectTrigger aria-label={`${MEASURE_LABEL[m]} source`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="visit">Same as visit</SelectItem>{FACT_SOURCES.map(s=><SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>)}</SelectContent></Select></label>
    <label className="field"><span>{MEASURE_LABEL[m]} time (UTC)</span><Input type="datetime-local" value={p?.at??''} disabled={!p||!value} onChange={e=>set(m,{at:e.target.value})}/></label></div>
    {p&&value&&!(RECORDED_SOURCES as readonly string[]).includes(p.source)&&<p className="notice amber-notice">A recorded value must be measured or reported. Clear the value to record why it is missing.</p>}</div>;})}
 </details>;
}
export function ProvenanceSummary({facts,measures}:{facts:Facts;measures:Measure[]}){
 const rows=measures.flatMap(m=>{const value=measureValue(facts,m),p=factProvenance(facts,m),own=facts.provenance?.[m];
  if(value)return [`${MEASURE_LABEL[m]}: ${SOURCE_LABEL[p.source]} · ${p.at.replace('T',' ')} UTC${p.own?'':' (visit-level)'}`];
  return own?[`${MEASURE_LABEL[m]}: not recorded · ${SOURCE_LABEL[own.source]}`]:[];});
 return rows.length?<div className="notes-box"><span>Source and time for each measurement</span>{rows.map(r=><p key={r}>{r}</p>)}</div>:null;
}
