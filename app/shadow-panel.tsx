'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { NOT_RUN_LABEL, SHADOW_MAX_DAYS, type NotRunReason } from '@/lib/saha/shadow';
import type { Snapshot } from '@/lib/saha/types';
// Slice 5f: shadow operation of a reviewed capability revision. Counts only; no visit, person or value is shown.
const STATE_LABEL: Record<string, string> = { active: 'In shadow', stopped: 'Stopped', ended: 'Period ended', halted: 'Halted: revision suspended, retired or changed' };
const DRIFT_LABEL: Record<string, string> = { drop: 'Agreement dropped', stable: 'No drop beyond the threshold', insufficient: 'Not enough rated fields to compare' };
const pct = (n: number | null) => n === null ? '—' : `${n}%`;
// Slice 5i: agreement per 7-day period and flagged drops between consecutive periods, counts only.
function DriftTable({ drift, notice }: { drift: any; notice: string }) {
  return <div className="shadow-run" aria-label={`Agreement over time for revision ${drift.revision}`} role="group">
    <p><span className={'tag ' + (drift.status === 'drop' ? 'amber' : drift.status === 'stable' ? 'success' : 'blue')}>{DRIFT_LABEL[drift.status]}</span> Agreement over time</p>
    <p className="muted text-sm">{notice}</p>
    <table className="shadow-table"><caption className="sr-only">Shadow agreement per period for revision {drift.revision}</caption><thead><tr><th scope="col">Period (UTC)</th><th scope="col">Visits</th><th scope="col">Rated fields</th><th scope="col">Agreement rate</th><th scope="col">Change</th></tr></thead><tbody>{drift.periods.map((p: any, i: number) => { const c = i ? drift.changes[i - 1] : null; return <tr key={p.from}><td>{p.from.slice(0, 10)} to {new Date(Date.parse(p.to) - 86400000).toISOString().slice(0, 10)}</td><td>{p.visits}</td><td>{p.rated}</td><td>{pct(p.rate)}</td><td>{!c ? '—' : c.points === null ? 'Not compared' : `${c.points > 0 ? '+' : ''}${c.points} points${c.status === 'drop' ? ' (drop)' : ''}`}</td></tr>; })}</tbody></table>
  </div>;
}
export function ShadowSection({ entry, shadows, data, busy, save, drift, driftNotice }: { entry: any; shadows: any[]; data: Snapshot; busy: boolean; save: (c: any) => Promise<any>; drift?: any; driftNotice?: string }) {
  const today = new Date().toISOString().slice(0, 10), last = new Date(Date.now() + SHADOW_MAX_DAYS * 86400000).toISOString().slice(0, 10);
  const own = data.teams.filter(t => data.membership.isOwner || data.membership.teamIds.includes(t.id));
  const [scope, setScope] = useState<'teams' | 'organisation'>('teams'), [teams, setTeams] = useState<string[]>([]), [until, setUntil] = useState(last), [reason, setReason] = useState(''), [stop, setStop] = useState('');
  const canStart = entry.state === 'reviewed' && !shadows.some(x => x.state === 'active');
  return <section className="shadow-section" aria-label={`Shadow operation for revision ${entry.revision}`}>
    <h3>Shadow operation</h3>
    <p className="muted text-sm">In shadow, this revision runs on visits confirmed during the period in its scope when a manager runs it. Outputs are stored for this comparison only: they are never shown to field workers, never applied and never added to action plans. Only the local rules provider is called in shadow.</p>
    {drift && <DriftTable drift={drift} notice={driftNotice ?? ''} />}
    {shadows.map(x => <div key={x.id} className="shadow-run">
      <p><span className={'tag ' + (x.state === 'active' ? 'blue' : 'amber')}>{STATE_LABEL[x.state] ?? x.state}</span> {x.scope === 'organisation' ? 'Whole organisation' : `${x.teamIds.length} team${x.teamIds.length === 1 ? '' : 's'}`} · {x.startedAt.slice(0, 10)} to {x.until} · started by {x.startedBy}</p>
      <p className="muted text-sm">Visits processed: {x.visits.total} ({x.visits.compared} compared, {x.visits.unable} unable to assess, {Object.values(x.visits.notRun as Record<string, number>).reduce((n, k) => n + k, 0)} not run){x.visits.recomputed ? ` · ${x.visits.recomputed} re-compared against a confirmed correction` : ''}{x.visits.excluded ? ` · ${x.visits.excluded} left out (visit voided, its correction not yet confirmed, or the correction compared on its own)` : ''}{x.state === 'active' ? ` · ${x.pending} confirmed visit${x.pending === 1 ? '' : 's'} waiting` : ''}</p>
      {Object.keys(x.visits.notRun).length > 0 && <p className="muted text-sm">Not run: {Object.entries(x.visits.notRun as Record<NotRunReason, number>).map(([k, n]) => `${NOT_RUN_LABEL[k as NotRunReason]} ${n}`).join(' · ')}</p>}
      {x.fields.length > 0 ? <table className="shadow-table"><caption className="sr-only">Shadow output compared with clinician-confirmed values, counts per field</caption><thead><tr><th scope="col">Field</th><th scope="col">Agreement</th><th scope="col">Disagreement</th><th scope="col">Missing</th><th scope="col">Not recorded by clinician</th><th scope="col">Unable to assess</th></tr></thead><tbody>{x.fields.map((f: any) => <tr key={f.field}><th scope="row">{f.label}</th><td>{f.agreement}</td><td>{f.disagreement}</td><td>{f.missing}</td><td>{f['not-recorded']}</td><td>{f.unable}</td></tr>)}</tbody></table> : <p className="muted text-sm">No field comparisons yet.</p>}
      {x.state === 'active' && <div className="button-row"><Button variant="outline" size="sm" disabled={busy || !x.pending} onClick={() => save({ type: 'runShadow', shadowId: x.id, version: x.version })}>Run shadow on waiting visits</Button></div>}
      {x.state === 'active' && <form className="button-row" onSubmit={async e => { e.preventDefault(); if (await save({ type: 'stopShadow', shadowId: x.id, version: x.version, reason: stop })) setStop(''); }}><Input aria-label="Reason for stopping the shadow operation" placeholder="Reason for stopping" required minLength={10} maxLength={1000} value={stop} onChange={e => setStop(e.target.value)} /><Button variant="outline" size="sm" disabled={busy || stop.trim().length < 10}>Stop shadow</Button></form>}
    </div>)}
    {canStart && <form className="stack-form" onSubmit={async e => { e.preventDefault(); if (await save({ type: 'startShadow', entryId: entry.id, version: entry.version, scope, teamIds: scope === 'teams' ? teams : [], until, reason })) setReason(''); }}>
      <fieldset><legend>Scope</legend>
        <label className="check-label"><input type="radio" name={`shadow-scope-${entry.id}`} checked={scope === 'teams'} onChange={() => setScope('teams')} /> <span>Selected teams</span></label>
        {data.membership.isOwner && <label className="check-label"><input type="radio" name={`shadow-scope-${entry.id}`} checked={scope === 'organisation'} onChange={() => setScope('organisation')} /> <span>Whole organisation</span></label>}
        {scope === 'teams' && own.map(t => <label key={t.id} className="check-label"><Checkbox checked={teams.includes(t.id)} onCheckedChange={yes => setTeams(yes ? [...teams, t.id] : teams.filter(x => x !== t.id))} /><span>{t.name}</span></label>)}
      </fieldset>
      <label className="field">Shadow until<Input type="date" required min={today} max={last} value={until} onChange={e => setUntil(e.target.value)} /></label>
      <label className="field">Reason<Textarea required minLength={10} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <Button variant="outline" disabled={busy || reason.trim().length < 10 || (scope === 'teams' && !teams.length)}>Start shadow operation</Button>
    </form>}
  </section>;
}
