'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Person, Snapshot } from '@/lib/saha/types';
import { CANCEL_REASONS, VISIT_WINDOWS } from '@/lib/saha/household-visit-constants';
type Command = (c: any, s?: string) => Promise<any>;
const label = (s: string) => s.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
const pick = (m: string, k: string, id: string) => `${m}|${k}|${id}`;
function Pick({ label: text, value, set, items }: { label: string; value: string; set: (s: string) => void; items: { id: string; name: string }[] }) {
  return <Select value={value} onValueChange={set}><SelectTrigger aria-label={text}><SelectValue placeholder={text} /></SelectTrigger><SelectContent>{items.map(x => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>;
}

// Slice 10f: household visit plan. Each member's open follow-ups, referrals and routine visit in one place (members inside
// the worker's scope only; the rest are counted), and one visit slot covering the items the worker chooses. A slot changes no
// due date or owner and closes nothing; each member keeps their own visit, observations and permissions.
export function HouseholdVisitPlan({ data, p, busy, command }: { data: Snapshot; p: Person; busy: boolean; command: Command }) {
  if (!p.householdId || !['asha', 'clinician', 'supervisor'].includes(data.role)) return null;
  return <PlanDialog data={data} p={p} busy={busy} command={command} />;
}
function PlanDialog({ data, p, busy, command }: { data: Snapshot; p: Person; busy: boolean; command: Command }) {
  const [open, setOpen] = useState(false), [view, setView] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]), [date, setDate] = useState(''), [slotWindow, setSlotWindow] = useState('morning'), [cancelReason, setCancelReason] = useState('rescheduled');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/household?${new URLSearchParams({ personId: p.id })}`, { cache: 'no-store', headers: { 'x-saha-organisation': data.organisation.id } }), j: any = await res.json();
      if (!res.ok) throw Error(j.error ?? 'Household visit plan unavailable.');
      setView(j);
    } catch (e) { setError(e instanceof Error ? e.message : 'Household visit plan unavailable.'); } finally { setLoading(false); }
  }, [p.id, data.organisation.id]);
  useEffect(() => { if (open) load(); }, [open, p.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = view?.visitPlan, household = view?.household, care = ['asha', 'clinician'].includes(data.role) && plan?.canSchedule;
  const members: any[] = plan?.members ?? [], visits: any[] = plan?.visits ?? [];
  const covers = members.map(m => ({ personId: m.personId, items: m.items.flatMap((i: any) => i.refs.filter((r: any) => chosen.includes(pick(m.personId, r.kind, r.id)))) })).filter(c => c.items.length);
  const toggle = (m: any, i: any, on: boolean) => setChosen(cur => { const keys = i.refs.map((r: any) => pick(m.personId, r.kind, r.id)); return on ? [...new Set([...cur, ...keys])] : cur.filter(k => !keys.includes(k)); });
  const schedule = async () => {
    const r = await command({ type: 'householdVisitSchedule', householdId: household.id, version: plan.householdVersion, date, window: slotWindow, covers }, 'Household visit planned');
    if (r) { setChosen([]); await load(); }
  };
  return <><Button variant="outline" onClick={() => setOpen(true)}>Household visit plan</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="wide-dialog"><DialogHeader><DialogTitle>Household visit plan · {household?.label ?? p.name}</DialogTitle><DialogDescription>Each member's due work in one place. Choose the items one household visit will cover. Nothing is sent, no due date changes, and each member keeps their own visit, observations and permissions.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="notice amber-notice">{error}</p>}
      {loading && !view ? <p className="notice">Loading household visit plan…</p> : !plan ? <p className="muted">This person is not in a household.</p> : <>
        {plan.outsideScope > 0 && <p className="muted">{plan.outsideScope} other household member{plan.outsideScope > 1 ? 's are' : ' is'} outside your care scope and not shown.</p>}
        <section aria-label="Members and their open items">{members.map(m => <div key={m.personId} className="stack-form"><h4>{m.name} <span className="muted">· {m.age} years · {label(m.relationship)}</span></h4>
          {m.merged ? <p className="muted">This record was merged into another record. Plan from the surviving record.</p> : !m.items.length ? <p className="muted">No open items.</p> : <ul className="revision-list">{m.items.map((i: any) => {
            const keys = i.refs.map((r: any) => pick(m.personId, r.kind, r.id)), on = keys.every((k: string) => chosen.includes(k)), id = `hv-${m.personId}-${i.key}`;
            return <li key={i.key}><label htmlFor={id} className="check-row"><Checkbox id={id} checked={on} disabled={!care || !m.canCover || !!i.covered || busy} onCheckedChange={v => toggle(m, i, v === true)} />
              <span><strong>{i.title}</strong>{i.programmes.length ? ` · ${i.programmes.join(', ')}` : ''} · due {i.due ?? 'not set'}{i.daysOverdue > 0 ? ` · ${i.daysOverdue} day${i.daysOverdue === 1 ? '' : 's'} overdue` : ''} <span className="tag">{label(i.attention)}</span>{i.owner ? <span className="muted"> · owner {i.owner}</span> : null}{i.waitingOn.length ? <span className="muted"> · waiting for {i.waitingOn.join('; ')}</span> : null}{i.covered ? <span className="muted"> · covered by the visit on {i.covered.date}</span> : null}</span></label></li>;
          })}</ul>}
        </div>)}</section>
        {care ? <section className="stack-form" aria-label="Plan a household visit"><h4>Plan one household visit</h4>
          <div className="form-grid"><label className="field"><span>Date</span><Input type="date" min={plan.minDate} max={plan.maxDate} value={date} onChange={e => setDate(e.target.value)} /></label><label className="field"><span>Time of day</span><Pick label="Time of day" value={slotWindow} set={setSlotWindow} items={VISIT_WINDOWS.map(x => ({ id: x, name: label(x) }))} /></label></div>
          <p className="muted">{covers.length ? `${covers.reduce((n, c) => n + c.items.length, 0)} item${covers.reduce((n, c) => n + c.items.length, 0) === 1 ? '' : 's'} for ${covers.length} member${covers.length === 1 ? '' : 's'} selected.` : 'Tick the items this visit will cover.'}</p>
          <Button disabled={busy || !covers.length || !date} onClick={schedule}>Plan household visit</Button></section> : <p className="muted">A care role is required to plan household visits.</p>}
        <section aria-label="Planned household visits"><h4>Household visits</h4>{!visits.length ? <p className="muted">No household visits planned.</p> : <ul className="revision-list">{visits.map(v => <li key={v.id}>
          <strong>{v.date} · {label(v.window)}</strong> <span className="tag">{v.state === 'cancelled' ? `Cancelled${v.cancelReason ? ` (${label(v.cancelReason).toLowerCase()})` : ''}` : label(v.when)}</span> <span className="muted">· planned by {v.worker}</span>
          {v.covers.map((c: any) => <div key={c.personId}><strong>{c.name}</strong>{c.left ? <span className="muted"> (no longer in the household)</span> : null} <span className="muted">· {c.stillOpen} of {c.items.length} still open</span><ul>{c.items.map((i: any) => <li key={i.kind + i.id}>{i.title}{i.open ? '' : ' · closed'}{i.lateByDays > 0 ? ` · due ${i.due}, ${i.lateByDays} day${i.lateByDays === 1 ? '' : 's'} before this visit` : ''}</li>)}</ul></div>)}
          {v.outsideScopeCovered > 0 && <p className="muted">{v.outsideScopeCovered} covered member{v.outsideScopeCovered > 1 ? 's are' : ' is'} outside your care scope and not shown.</p>}
          {v.canCancel && <div className="form-grid"><Pick label="Reason for cancelling" value={cancelReason} set={setCancelReason} items={CANCEL_REASONS.map(x => ({ id: x, name: label(x) }))} /><Button size="sm" variant="ghost" disabled={busy} onClick={async () => { const r = await command({ type: 'householdVisitCancel', householdId: household.id, version: plan.householdVersion, visitId: v.id, reason: cancelReason }, 'Household visit cancelled'); if (r) await load(); }}>Cancel this visit</Button></div>}
        </li>)}</ul>}</section>
        <p className="muted text-sm">{plan.rules}</p>
      </>}
    </DialogContent></Dialog></>;
}
