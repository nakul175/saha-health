'use client';
import { History } from 'lucide-react';
import { MEASURES, MEASURE_LABEL, SOURCE_LABEL, VALUE_RANGES, currentOverride, enteredText, factProvenance, measureValue, rangeText } from '@/lib/saha/fact-provenance';
import { ROLE_LABEL, type Measure, type Person, type ValueField, type Visit } from '@/lib/saha/types';
// Slice 10i: a visit imported from another system (kind `visits` of the record import) is read-only history. It is shown with its
// lineage, measurements (unit, source and time as stated in the file), reasons for unusual values and notes, and with no action
// that would reuse it as a current observation: it is not sent, referred, published, summarised or signed off, and a current
// observation needs a fresh measurement in a new visit. The server refuses those commands for it in any case.
const UNIT:Record<Measure,string>={bloodPressure:'mmHg',weight:'kg',temperature:'°C',weeks:'weeks',coughDays:'days'};
const FIELD:Record<Measure,ValueField[]>={bloodPressure:['systolic','diastolic'],weight:['weight'],temperature:['temperature'],weeks:['weeks'],coughDays:['coughDays']};
const when=(t:string)=>t.replace('T',' ')+' UTC';
export function ImportedVisitPanel({visit:v,person:p}:{visit:Visit;person:Person}){
 const i=v.imported;if(!i)return null;
 const withdrawal=p.importedVisitWithdrawals?.find(x=>x.batchId===i.batchId),reviews=(p.importedVisitEvidence??[]).filter(e=>e.visitId===v.id).flatMap(e=>e.reviews);
 const shown=MEASURES.filter(m=>measureValue(v.facts,m)||v.facts.provenance?.[m]);
 return <section className="panel visit-panel imported-visit" aria-labelledby={`imported-${v.id}`} data-testid="imported-visit">
  <div className="section-heading"><div><h2 id={`imported-${v.id}`}><History size={19}/> Imported visit · {when(v.facts.date)}</h2><span className="muted text-sm">{p.name} · historical record, read-only</span></div><span className="tag amber">IMPORTED</span></div>
  <div className="notice amber-notice" role="note"><div><strong>Imported from {i.sourceSystem}. Not recorded or signed off in Saha.</strong><p>A person imported this visit from a file; import itself implies no clinician review or sign-off. It is not a current observation: measure again in a new visit. It is not sent to programmes, referred, published, summarised by an assistant or counted in indicators.</p></div></div>
  {withdrawal&&<p role="status" className="notice amber-notice">WITHDRAWN SOURCE BATCH · {when(withdrawal.at.slice(0,16))}. Original facts, receipts and independently captured care are retained; this source cannot open new linked care.</p>}
  {reviews.length>0&&<p className="notice">{reviews.length} explicit historical-source review decision(s) retained. These assess source use and overlaps; they do not sign off historical observations as Saha care.</p>}
  <div className="recorded-facts" role="group" aria-label="Import lineage">
   <p><strong>Source system</strong><span>{i.sourceSystem}</span></p>
   <p><strong>Imported by</strong><span>{i.byName} ({ROLE_LABEL[i.role]??i.role}), {when(i.at.slice(0,16))}</span></p>
   <p><strong>File row</strong><span>Row {i.row} of the file with SHA-256 <code title={i.fileDigest}>{i.fileDigest.slice(0,16)}…</code></span></p>
   <p><strong>Import batch</strong><span>{i.batchId.slice(0,8)} · dry run {i.planHash.slice(0,12)}…</span></p>
  </div>
  {v.valueRangeCapture&&<p className="notice amber-notice">Range policy captured at import: publication {v.valueRangeCapture.publicationVersion} · {v.valueRangeCapture.group} · {v.valueRangeCapture.version}. Engineering example; clinical approval pending. This uses patient context at import, not an assertion about historical pregnancy.</p>}
  <h3>Measurements as stated in the file</h3>
  {shown.length?<table className="w-full text-sm" aria-label="Imported measurements"><thead><tr><th className="text-left">Measurement</th><th className="text-left">Value</th><th className="text-left">Source and time</th><th className="text-left">Unusual value</th></tr></thead><tbody>{shown.map(m=>{
   const value=measureValue(v.facts,m),pv=factProvenance(v.facts,m),entered=FIELD[m].flatMap(f=>v.facts.entered?.[f]?[`${m==='bloodPressure'?f+': ':''}${enteredText(v.facts.entered[f])}`]:[]).join('; ');
   const overrides=FIELD[m].map(f=>currentOverride(v,f)).filter((o):o is NonNullable<typeof o>=>!!o);
   return <tr key={m}><td>{MEASURE_LABEL[m]}</td><td>{value?(m==='bloodPressure'?`${v.facts.systolic}/${v.facts.diastolic}`:value)+' '+UNIT[m]+(entered?` (entered as ${entered})`:''):'Not recorded'}</td><td>{SOURCE_LABEL[pv.source]}{value?`, ${when(pv.at)}`:''}</td><td>{overrides.length?overrides.map(o=>`${VALUE_RANGES.fields[o.field].label}: outside ${rangeText(o.field,o.expected)}; reason: ${o.reason} (${o.rangesVersion})`).join(' · '):'—'}</td></tr>;})}</tbody></table>:<p className="muted text-sm">No measurements in this visit.</p>}
  {v.facts.notes&&<><h3>Notes from the source record</h3><p className="notes-box" style={{whiteSpace:'pre-wrap'}}>{v.facts.notes}</p></>}
  {v.voidedAt&&<p className="muted text-sm">Marked wrong-patient: {v.voidReason}</p>}
 </section>;
}
