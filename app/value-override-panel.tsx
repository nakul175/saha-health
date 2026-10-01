'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALT_UNITS, CONVERTIBLE_FIELDS, VALUE_FIELDS, VALUE_RANGES, authorText, convertEntered, currentOverride, enteredText, overrideConfirmation, overrideText, rangeText, valueTier } from '@/lib/saha/fact-provenance';
import type { ConvertibleField, Facts, Measure, Snapshot, ValueField, Visit } from '@/lib/saha/types';
// Slice 2i: values entered in another unit (converted on the server, original kept) and reasons for values outside the
// placeholder expected range (BR-DATA-05). The ranges are an engineering placeholder, not clinically approved.
const fieldsFor=(measures:Measure[]):ValueField[]=>VALUE_FIELDS.filter(f=>measures.includes(f==='systolic'||f==='diastolic'?'bloodPressure':f as Measure));
export function UnitAndReasonEditor({facts,measures,onChange}:{facts:Facts;measures:Measure[];onChange:(f:Facts)=>void}){
 const fields=fieldsFor(measures),convertible=CONVERTIBLE_FIELDS.filter(f=>fields.includes(f));
 const setEntered=(f:ConvertibleField,unit:string,value:string)=>{const entered={...(facts.entered??{})};const next:Facts={...facts};
  if(unit==='base'){delete entered[f];}else{entered[f]={value,unit};next[f]=value.trim()?convertEntered(f,{value:value.trim(),unit})??'':'';}
  if(Object.keys(entered).length)next.entered=entered;else delete next.entered;onChange(next);};
 const setReason=(f:ValueField,reason:string)=>{const unusual={...(facts.unusual??{}),[f]:reason};onChange({...facts,unusual});};
 const unusual=fields.filter(f=>valueTier(f,facts[f])!=='expected');
 return <details className="provenance-editor" open={!!facts.entered||unusual.length>0} data-testid="unit-and-reason"><summary>Other units and unusual values</summary>
  <p className="muted text-sm">Enter a value in another unit only when it was measured in that unit; Saha converts it on saving and keeps what you entered. Expected ranges: {VALUE_RANGES.status} ({VALUE_RANGES.version}).</p>
  {convertible.map(f=>{const e=facts.entered?.[f],alt=ALT_UNITS[f],r=VALUE_RANGES.fields[f];
   return <div className="form-grid three" key={f}><div className="provenance-label"><strong>{r.label}</strong><span className="muted text-sm">{e?(facts[f]?`${e.value} ${alt.label.split(' ')[0]} = ${facts[f]} ${r.unit}`:'Enter a positive number'):`Entered in ${r.unit}`}</span></div>
    <label className="field"><span>{r.label} unit</span><Select value={e?alt.unit:'base'} onValueChange={u=>setEntered(f,u,u==='base'?'':(e?.value??''))}><SelectTrigger aria-label={`${r.label} unit`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="base">{r.unit}</SelectItem><SelectItem value={alt.unit}>{alt.label}</SelectItem></SelectContent></Select></label>
    <label className="field"><span>{r.label} in {alt.label.split(' ')[0]}</span><Input inputMode="decimal" value={e?.value??''} disabled={!e} onChange={x=>setEntered(f,alt.unit,x.target.value)} placeholder={e?'Value as measured':'Choose the unit first'}/></label></div>;})}
  {unusual.map(f=>{const r=VALUE_RANGES.fields[f],tier=valueTier(f,facts[f]);
   return <div className="provenance-row" key={'u'+f}><p className="notice amber-notice">{r.label} {facts[f]} {r.unit} is outside the expected range {rangeText(f,r.expected)}. Check the value and its unit.{tier==='clinician'?` It is also outside ${rangeText(f,r.confirm)}: a clinician who did not record it must confirm it before the visit is confirmed.`:''}</p>
    <label className="field"><span>Reason for unusual {r.label.toLowerCase()} (at least 10 characters)</span><Textarea value={facts.unusual?.[f]??''} onChange={x=>setReason(f,x.target.value)} maxLength={500} rows={2}/></label></div>;})}
 </details>;
}
export function ValueOverridePanel({v,data,busy,command}:{v:Visit;data:Snapshot;busy:boolean;command:(c:any,s?:string)=>Promise<any>}){
 const [note,setNote]=useState('');
 const entered=CONVERTIBLE_FIELDS.filter(f=>v.facts.entered?.[f]),history=v.valueOverrides??[];if(!entered.length&&!history.length)return null;
 const current=VALUE_FIELDS.map(f=>currentOverride(v,f)).filter(Boolean) as NonNullable<ReturnType<typeof currentOverride>>[];const earlier=history.filter(o=>!current.some(c=>c.id===o.id));
 const canConfirm=data.role==='clinician'&&v.state==='draft'&&!v.voidedAt&&!v.supersededBy;
 return <div className="notes-box" data-testid="value-overrides"><span>Units and unusual values · {VALUE_RANGES.status}</span>
  {entered.map(f=><p key={'e'+f}>{VALUE_RANGES.fields[f].label}: entered as {enteredText(v.facts.entered![f])}, stored as {v.facts[f]} {VALUE_RANGES.fields[f].unit} (converted by Saha).</p>)}
  {current.map(o=>{const c=overrideConfirmation(v,o),own=o.by.userId===data.user.userId;
   return <div key={o.id}><p>{overrideText(o)}. {o.tier==='clinician'?(c?`Confirmed by ${c.byName} (clinician), ${c.at.slice(0,16).replace('T',' ')} UTC${c.note?`: ${c.note}`:''}.`:`Outside ${rangeText(o.field,o.confirm)}: clinician confirmation required before the visit is confirmed.`):'Reason recorded; no clinician confirmation needed.'}</p>
    {o.tier==='clinician'&&!c&&canConfirm&&(own?<p className="muted text-sm">A different clinician must confirm an unusual value you recorded.</p>:<form className="flex flex-wrap gap-2 items-end" onSubmit={e=>{e.preventDefault();void command({type:'confirmUnusualValue',visitId:v.id,version:v.version,field:o.field,overrideId:o.id,...(note.trim()?{note:note.trim()}:{})},'Unusual value confirmed').then(ok=>{if(ok)setNote('');});}}><label className="field grow"><span>Confirmation note (optional)</span><Input value={note} onChange={e=>setNote(e.target.value)} maxLength={500}/></label><Button type="submit" size="sm" disabled={busy}>Confirm unusual {VALUE_RANGES.fields[o.field].label.toLowerCase()}</Button></form>)}</div>;})}
  {earlier.length>0&&<details><summary>Earlier unusual values ({earlier.length})</summary>{earlier.map(o=><p key={o.id}>{overrideText(o)}{o.visitId!==v.id?' (on the corrected visit)':''}{overrideConfirmation(v,o)?`; confirmed by ${overrideConfirmation(v,o)!.byName}`:''}. No longer current.</p>)}</details>}
 </div>;
}
// Owner-visible: the ranges configuration in force. It is a placeholder for engineering, not a clinical standard.
export function ValueRangesPanel(){
 return <section className="panel" aria-label="Expected value ranges" data-testid="value-ranges"><div className="section-heading"><div><h2>Expected value ranges</h2><p className="muted text-sm">Version {VALUE_RANGES.version}: {VALUE_RANGES.status}. No clinical authority is claimed. A value outside the expected range needs the recorder’s reason; outside the confirmation range, a clinician who did not record it must also confirm it. Changing these ranges needs a release.</p></div></div>
  <table className="w-full text-sm"><thead><tr><th className="text-left">Measurement</th><th className="text-left">Expected</th><th className="text-left">Clinician confirmation outside</th><th className="text-left">Other unit accepted</th></tr></thead><tbody>{VALUE_FIELDS.map(f=>{const r=VALUE_RANGES.fields[f];return <tr key={f}><td>{r.label}</td><td>{rangeText(f,r.expected)}</td><td>{rangeText(f,r.confirm)}</td><td>{(CONVERTIBLE_FIELDS as readonly string[]).includes(f)?ALT_UNITS[f as ConvertibleField].label:'None'}</td></tr>;})}</tbody></table>
 </section>;
}
