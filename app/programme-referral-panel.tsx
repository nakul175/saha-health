'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Snapshot, Visit } from '@/lib/saha/types';
import { NEED_IDS, NEED_LABEL, type NeedId } from '@/lib/saha/referral-needs';
type Command = (c: any, s?: string) => Promise<any>;

// Slice 10f: one referral for the programme episodes of a confirmed visit that raised the same need. The server groups
// the requests: the same need, facility, person and visit become one referral that records which packs asked; a different
// need or facility is its own referral. No facility is contacted.
export function ProgrammeReferralForm({ data, visit: v, busy, command, done }: { data: Snapshot; visit: Visit; busy: boolean; command: Command; done: () => void }) {
  const packs = v.programmeCapture?.packs ?? [], person = data.people.find(p => p.id === v.personId);
  const [need, setNeed] = useState<NeedId>('blood-pressure-review'), [needLabel, setNeedLabel] = useState(''), [facility, setFacility] = useState(''), [reason, setReason] = useState(''), [asked, setAsked] = useState<string[]>([]),[declarations,setDeclarations]=useState<Record<string,string>>({});
  const [windowStart,setWindowStart]=useState(''),[windowEnd,setWindowEnd]=useState(''),[legacyId,setLegacyId]=useState('new');
  if (v.state !== 'confirmed' || v.voidedAt || v.supersededBy || !packs.length) return null;
  const existing = data.referrals.filter(r => r.visitId === v.id && r.need && !['completed', 'declined', 'cancelled'].includes(r.state));
  const legacy=data.referrals.filter(r=>r.personId===v.personId&&r.visitId===v.id&&!r.need&&!['completed','declined','cancelled'].includes(r.state));
  const requests = asked.map(enrolmentId => ({ enrolmentId, need,...(packs.find(x=>x.enrolmentId===enrolmentId)?.pack.referralNeeds?{declarationId:declarations[enrolmentId]}:{}), ...(need === 'other' ? { needLabel: needLabel.trim() } : {}), facility: facility.trim(), reason: reason.trim(),windowStart,windowEnd }));
  return <form className="form-stack" aria-label="Programme referral" onSubmit={async e => { e.preventDefault();const old=legacy.find(r=>r.id===legacyId); if (await command({ type: 'createProgrammeReferrals', visitId: v.id,personVersion:person!.version,visitVersion:v.version,...(old?{adoptLegacy:{referralId:old.id,version:old.version??1}}:{}), requests }, 'Programme referral recorded')) done(); }}>
    <h4>Programme referral</h4>
    <p className="muted">Tick each programme that raised this need at this visit. Only matching person, declared purpose, destination and time window share one referral. Every programme keeps its own reason, dependency and completion state.</p>
    <fieldset><legend>Programmes that raised this need</legend>{packs.map(x => { const e = person?.enrolments?.find(z => z.id === x.enrolmentId), id = `pr-${x.enrolmentId}`; return <label key={x.enrolmentId} htmlFor={id} className="check-row"><Checkbox id={id} checked={asked.includes(x.enrolmentId)} onCheckedChange={on => setAsked(cur => on === true ? [...cur, x.enrolmentId] : cur.filter(k => k !== x.enrolmentId))} />{x.pack.name} v{x.pack.version}{e ? ` · ${e.episodeLabel}` : ''}</label>; })}</fieldset>
    <label className="field"><span>Need</span><Select value={need} onValueChange={v2 => setNeed(v2 as NeedId)}><SelectTrigger aria-label="Referral need"><SelectValue /></SelectTrigger><SelectContent>{NEED_IDS.map(id => <SelectItem key={id} value={id}>{NEED_LABEL[id]}</SelectItem>)}</SelectContent></Select></label>
    {need === 'other' && <label className="field"><span>Name the need</span><Input value={needLabel} maxLength={100} onChange={e => setNeedLabel(e.target.value)} /></label>}
    {packs.filter(x=>asked.includes(x.enrolmentId)&&x.pack.referralNeeds).map(x=><label key={x.enrolmentId} className="field"><span>Declared need · {x.pack.name} v{x.pack.version}</span><Select value={declarations[x.enrolmentId]??''} onValueChange={value=>setDeclarations(cur=>({...cur,[x.enrolmentId]:value}))}><SelectTrigger aria-label={'Declared need '+x.pack.name}><SelectValue placeholder="Choose explicit declared need"/></SelectTrigger><SelectContent>{x.pack.referralNeeds!.filter(d=>d.need===need&&(need!=='other'||d.needLabel===needLabel.trim())).map(d=><SelectItem key={d.id} value={d.id}>{d.id} · {d.urgency} · {d.compatibilityKey?'compatible '+d.compatibilityKey:'separate referral'}</SelectItem>)}</SelectContent></Select></label>)}
    <p className="muted">Installed declarations govern eligibility and combination. An incompatible request stays separate; the highest declared urgency is retained. A referral never completes an episode or contacts a facility here.</p>
    <label className="field"><span>Facility</span><Input value={facility} maxLength={200} onChange={e => setFacility(e.target.value)} placeholder="Receiving facility, synthetic only" /></label>
    <div className="field-grid"><label className="field"><span>Time window starts</span><Input type="date" value={windowStart} onChange={e=>setWindowStart(e.target.value)}/></label><label className="field"><span>Time window ends</span><Input type="date" min={windowStart||undefined} value={windowEnd} onChange={e=>setWindowEnd(e.target.value)}/></label></div>
    {!!legacy.length&&<label className="field"><span>Existing referral from this visit</span><Select value={legacyId} onValueChange={setLegacyId}><SelectTrigger aria-label="Existing referral"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="new">Prepare a new referral</SelectItem>{legacy.map(r=><SelectItem key={r.id} value={r.id}>Adopt {r.facility} · {r.reason}</SelectItem>)}</SelectContent></Select><span className="muted">Adoption is version checked and allowed only when the destination matches. Older work is never merged automatically.</span></label>}
    <label className="field"><span>Reason / handover note</span><Textarea minLength={5} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
    {!!existing.length && <p className="muted">Open programme referrals from this visit: {existing.map(r => `${r.facility} (${r.need!.label}; asked by ${(r.packRequests ?? []).map(q => q.packName).join(', ') || 'no pack recorded'})`).join('; ')}.</p>}
    <Button disabled={busy || !person || !requests.length || requests.some(r=>packs.find(x=>x.enrolmentId===r.enrolmentId)?.pack.referralNeeds&&!r.declarationId) || facility.trim().length < 3 || reason.trim().length < 5 || !windowStart || !windowEnd || windowStart>windowEnd || (need === 'other' && needLabel.trim().length < 3)}>Record programme referral</Button>
  </form>;
}
