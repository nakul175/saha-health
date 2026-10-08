'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Person, Snapshot } from '@/lib/saha/types';
import { DATE_KINDS, DATE_SOURCES, currentDate } from '@/lib/saha/person-dates-constants';
type Command = (c: any, s?: string) => Promise<any>;
const KIND: Record<string, string> = { lmp: 'Last menstrual period (LMP)', edd: 'Expected delivery date (EDD)', birthDate: 'Baby’s date of birth (delivery)', dob: 'Date of birth' };
const SOURCE: Record<string, string> = { reported: 'Told by the person or family', document: 'Seen on a card or document', measured: 'Worked out from a scan or examination', estimated: 'Estimated' };

// Slice 14c: enter, see and withdraw the dates on one person's record. Replacing a date needs a reason; nothing is overwritten.
export function PersonDatesPatient({ data, p, busy, command }: { data: Snapshot; p: Person; busy: boolean; command: Command }) {
  const [open, setOpen] = useState(false), [kind, setKind] = useState<string>('lmp'), [value, setValue] = useState(''), [source, setSource] = useState<string>('reported'), [reason, setReason] = useState('');
  const [wid, setWid] = useState(''), [wreason, setWreason] = useState(''), [warn, setWarn] = useState<string[]>([]);
  const care = ['asha', 'clinician'].includes(data.role), entries = p.dateEntries ?? [], cur = currentDate(entries, kind as any);
  const names = new Map(data.members.map(m => [m.userId, m.displayName]));
  const today = new Date().toISOString().slice(0, 10);
  const save = async () => {
    const r = await command({ type: 'personDateRecord', personId: p.id, version: p.version, kind, value, source, ...(cur ? { reason } : {}) }, 'Date recorded.');
    if (r) { setWarn(r.result?.warnings ?? []); setValue(''); setReason(''); }
  };
  const withdraw = async () => { const r = await command({ type: 'personDateWithdraw', personId: p.id, version: p.version, entryId: wid, reason: wreason }, 'Date withdrawn.'); if (r) { setWid(''); setWreason(''); } };
  return <><Button variant="outline" onClick={() => setOpen(true)}>Pregnancy &amp; birth dates</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="wide-dialog"><DialogHeader><DialogTitle>Dates · {p.name}</DialogTitle><DialogDescription>These dates are health information. Changing a date keeps the earlier one, with the reason. No location is recorded.</DialogDescription></DialogHeader>
      {warn.map(w => <p key={w} role="alert" className="notice amber-notice">{w}</p>)}
      <section aria-label="Current dates"><h3>Current</h3>
        {DATE_KINDS.map(k => { const e = currentDate(entries, k); return <p key={k}><strong>{KIND[k]}:</strong> {e ? `${e.value} · ${SOURCE[e.source]}` : 'Not recorded'}</p>; })}
      </section>
      {care ? <section className="stack-form" aria-label="Record a date"><h3>Record or replace a date</h3>
        <label className="field"><span>Which date</span><Select value={kind} onValueChange={setKind}><SelectTrigger aria-label="Which date"><SelectValue /></SelectTrigger><SelectContent>{DATE_KINDS.map(k => <SelectItem key={k} value={k}>{KIND[k]}</SelectItem>)}</SelectContent></Select></label>
        <label className="field"><span>Date</span><Input type="date" value={value} max={kind === 'edd' ? undefined : today} onChange={e => setValue(e.target.value)} /></label>
        <label className="field"><span>Where it came from</span><Select value={source} onValueChange={setSource}><SelectTrigger aria-label="Where it came from"><SelectValue /></SelectTrigger><SelectContent>{DATE_SOURCES.map(s => <SelectItem key={s} value={s}>{SOURCE[s]}</SelectItem>)}</SelectContent></Select></label>
        {cur && <label className="field"><span>Why replace {cur.value}? (at least 5 characters)</span><Input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} /></label>}
        <Button disabled={busy || !value || (!!cur && reason.trim().length < 5)} onClick={() => void save()}>{cur ? 'Replace date' : 'Save date'}</Button>
      </section> : <p className="notice">Only an ASHA or clinician can record dates.</p>}
      <section aria-label="Date history"><h3>History</h3>{entries.length === 0 ? <p className="muted">No dates recorded yet.</p> : <ul>{[...entries].reverse().map(e => <li key={e.id}>{KIND[e.kind]}: {e.value} · {SOURCE[e.source]} · {names.get(e.recordedBy) ?? 'Unknown'}, {e.recordedAt.slice(0, 10)}{e.reason ? ` · Reason: ${e.reason}` : ''}{e.withdrawn ? ` · Withdrawn ${e.withdrawn.at.slice(0, 10)}: ${e.withdrawn.reason}` : care ? <> <Button variant="ghost" size="sm" disabled={busy} onClick={() => setWid(wid === e.id ? '' : e.id)}>{wid === e.id ? 'Cancel' : 'Withdraw'}</Button></> : ''}</li>)}</ul>}
        {wid && <div className="stack-form"><label className="field"><span>Why withdraw this entry? (at least 5 characters)</span><Input value={wreason} onChange={e => setWreason(e.target.value)} maxLength={300} /></label><Button disabled={busy || wreason.trim().length < 5} onClick={() => void withdraw()}>Withdraw entry</Button></div>}
      </section>
    </DialogContent></Dialog></>;
}
