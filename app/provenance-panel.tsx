'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FACT_SOURCES, RECORDED_SOURCES, factProvenance, measureValue } from '@/lib/saha/fact-provenance';
import { useI18n } from './i18n';
import { useGuidedObservation } from './guided-capture';
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
 const guided=useGuidedObservation();if(guided.enabled)measures=guided.measure?[guided.measure]:[];
 const {t,lang,label}=useI18n(),hl=lang==='hi'?'hi':undefined;
 const set=(m:Measure,next:{source?:string;at?:string})=>{const current=facts.provenance?.[m],source=next.source??current?.source??'visit',at=next.at??current?.at??'',provenance={...(facts.provenance??{})};
  if(source==='visit')delete provenance[m];else provenance[m]={source:source as FactSource,...(at?{at}:{})};
  const {provenance:_old,...rest}=facts;onChange(Object.keys(provenance).length?{...rest,provenance}:rest);};
 return <details className="provenance-editor" hidden={guided.enabled&&!guided.measure} open={guided.enabled||!!facts.provenance}><summary>{t('capture.prov.summary')}</summary>
  <p className="muted text-sm">{t('capture.prov.help')}</p>
  {measures.map(m=>{const p=facts.provenance?.[m],value=measureValue(facts,m),name=label('capture.measure',m),shown=m==='bloodPressure'?(facts.systolic||facts.diastolic?`${facts.systolic||'?'}/${facts.diastolic||'?'}`:''):value;
   return <div className="provenance-row" key={m}><div className="form-grid three"><div className="provenance-label"><strong>{name}</strong><span className="muted text-sm">{shown?t('capture.prov.value',{value:shown}):t('capture.prov.noValue')}</span>{guided.enabled&&<span className="muted text-sm" data-testid="active-observation-provenance">{label('capture.src',factProvenance(facts,m).source)}{value?' · '+factProvenance(facts,m).at.replace('T',' ')+' UTC':''}</span>}</div>
    <label className="field"><span>{t('capture.prov.sourceOf',{measure:name})}</span><Select value={p?.source??'visit'} onValueChange={s=>set(m,{source:s})}><SelectTrigger aria-label={t('capture.prov.sourceOf',{measure:name})}><SelectValue/></SelectTrigger><SelectContent lang={hl}><SelectItem value="visit">{t('capture.prov.sameAsVisit')}</SelectItem>{FACT_SOURCES.map(s=><SelectItem key={s} value={s}>{label('capture.src',s)}</SelectItem>)}</SelectContent></Select></label>
    <label className="field"><span>{t('capture.prov.timeOf',{measure:name})}</span><Input type="datetime-local" value={p?.at??''} disabled={!p||!value} onChange={e=>set(m,{at:e.target.value})}/></label></div>
    {p&&value&&!(RECORDED_SOURCES as readonly string[]).includes(p.source)&&<p className="notice amber-notice">{t('capture.prov.mustMeasure')}</p>}</div>;})}
 </details>;
}
export function ProvenanceSummary({facts,measures}:{facts:Facts;measures:Measure[]}){
 const {t,label}=useI18n();
 const rows=measures.flatMap(m=>{const value=measureValue(facts,m),p=factProvenance(facts,m),own=facts.provenance?.[m],name=label('capture.measure',m);
  if(value)return [`${name}: ${label('capture.src',p.source)} · ${p.at.replace('T',' ')} UTC${p.own?'':t('capture.prov.visitLevel')}`];
  return own?[t('capture.prov.notRecorded',{measure:name,source:label('capture.src',own.source)})]:[];});
 return rows.length?<div className="notes-box"><span>{t('capture.prov.summary')}</span>{rows.map(r=><p key={r}>{r}</p>)}</div>:null;
}
