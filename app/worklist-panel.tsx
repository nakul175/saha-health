'use client';
import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, ChevronRight, Clock3, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PACKS } from '@/lib/saha/programmes';
import { STATE_LABEL, type ReferralState } from '@/lib/saha/referral-rules';
import type { FollowUpRow, ReferralRow, SubmissionRow, WorklistPage, WorklistView, WorkRow } from '@/lib/saha/worklists';

// Slice 0b-4: work views for a paged workspace (more than 500 people in a non-ASHA scope). The server computes
// each view over the viewer's whole permitted scope with the same functions the unpaged workspace uses
// (lib/saha/worklist-views.ts) and returns one page at a time. The address carries only the view, the tab and
// an offset cursor; never a name, free text or record id. Opening a row loads that record, where its full
// controls (receipts, referral events, follow-up resolution) are available.
type Open = (personId: string, visitId?: string | null) => void;
export type Worklist<R> = { page: WorklistPage | null; rows: R[]; loading: boolean; error: string; more: (() => void) | null };

export function useWorklist<R>(organisationId: string | null, view: WorklistView, tab: 'all' | 'attention' = 'all', refresh?: unknown): Worklist<R> {
  const [page, setPage] = useState<WorklistPage | null>(null), [rows, setRows] = useState<R[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const load = useCallback(async (cursor: string | null) => {
    if (!organisationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/worklists?view=${view}${tab === 'attention' ? '&tab=attention' : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { cache: 'no-store', headers: { 'x-saha-organisation': organisationId } });
      const j: WorklistPage & { error?: string } = await r.json();
      if (!r.ok) throw Error(j.error ?? 'Could not load this list.');
      setRows(prev => cursor ? [...prev, ...(j.rows as R[])] : j.rows as R[]); setPage(j); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this list.'); } finally { setLoading(false); }
  }, [organisationId, view, tab]);
  useEffect(() => { if (organisationId) void load(null); else { setRows([]); setPage(null); } }, [organisationId, load, refresh]);
  return { page, rows, loading, error, more: page?.nextCursor ? () => void load(page.nextCursor) : null };
}

function Foot({ w, children }: { w: Worklist<unknown>; children: React.ReactNode }) {
  return <div className="list-foot">{w.more && <Button variant="outline" disabled={w.loading} onClick={w.more}>{w.loading && <Loader2 className="spin" size={16} />}Load more</Button>}{w.loading && !w.more && <Loader2 className="spin" size={16} />}<ShieldCheck size={15} />{children}</div>;
}
const Shown = ({ w }: { w: Worklist<unknown> }) => w.page && w.rows.length < w.page.total ? <span className="muted text-sm">Showing {w.rows.length.toLocaleString('en-IN')} of {w.page.total.toLocaleString('en-IN')}</span> : null;

export function PagedVisitList({ w, open, asha }: { w: Worklist<WorkRow>; open: Open; asha: boolean }) {
  return <section className="panel worklist" aria-label="Your visit list">
    <div className="section-heading"><h2>Your visit list <span className="number-badge">{w.page?.total ?? '…'}</span></h2><span className="muted text-sm">{asha ? 'Assigned to you' : 'Whole care scope'}</span><Shown w={w} /></div>
    {w.error && <div className="notice amber-notice" role="alert">{w.error}</div>}
    <div className="patient-list">{w.rows.map(p => <button className="patient-row" key={p.id} onClick={() => open(p.id)}><div className="patient-row-name"><strong>{p.name}</strong><span>{p.age ?? '—'} years · {p.village}{p.merged ? ' · merged record' : ''}</span></div><div className="patient-row-task"><span>{p.task}</span><div className="tags"><span className="tag neutral">{p.programmes[0]}</span></div></div><div className="patient-row-status"><span className={`tag ${p.status === 'completed' ? 'success' : p.status === 'in_progress' ? 'blue' : 'neutral'}`}>{p.status === 'completed' ? 'Confirmed' : p.status === 'in_progress' ? 'In progress' : p.due}</span><ChevronRight size={18} /></div></button>)}
      {!w.rows.length && !w.loading && !w.error && <p className="muted">No people in your care scope.</p>}</div>
    <Foot w={w}>Built on the server over your whole care scope. Search the whole scope in People.</Foot>
  </section>;
}

export function PagedFollowUps({ organisationId, open, refresh }: { organisationId: string; open: Open; refresh: unknown }) {
  const w = useWorklist<FollowUpRow>(organisationId, 'followups', 'all', refresh), today = new Date().toISOString().slice(0, 10);
  return <section className="panel programme-patient" aria-label="Programme follow-ups"><div className="section-heading"><h2>Programme follow-ups <span className="number-badge">{w.page?.tasks ?? '…'}</span></h2><span className="muted text-sm">Separate programme tasks, grouped by person</span><Shown w={w} /></div>
    {w.error && <div className="notice amber-notice" role="alert">{w.error}</div>}
    {!w.rows.length && !w.loading && !w.error ? <p className="muted">Schedule a follow-up from an active programme episode.</p> : w.rows.map(g => <button className="followup-group" key={g.personId} onClick={() => open(g.personId)}><strong>{g.name}</strong><div>{g.tasks.map(t => <p key={t.id}>{t.due} · {PACKS.find(p => p.id === t.packId)?.name} · {t.title}{t.due < today ? ' · Overdue' : ''}</p>)}</div><span>Open record →</span></button>)}
    <Foot w={w}>Open follow-ups across your whole care scope.</Foot>
  </section>;
}

export function PagedReferrals({ organisationId, open, refresh, owner }: { organisationId: string; open: Open; refresh: unknown; owner: (userId?: string) => string }) {
  const w = useWorklist<ReferralRow>(organisationId, 'referrals', 'all', refresh);
  return <section className="referral-section" aria-label="Referrals and outcomes"><h2>Referrals & outcomes <span className="number-badge">{w.page?.total ?? '…'}</span></h2><p>Named ownership, due dates and a recorded source for each event. Open a referral to update it.</p>
    {w.error && <div className="notice amber-notice" role="alert">{w.error}</div>}
    {!w.rows.length && !w.loading && !w.error ? <p className="muted">No referrals recorded. Prepare one from a confirmed visit.</p> : w.rows.map(r => <article className="panel referral-tracker" key={r.id}><div className="section-heading"><div><h3>{r.facility}</h3><p>{r.personName} · {r.reason}</p></div><span className="tag">{STATE_LABEL[r.state as ReferralState] ?? r.state}</span></div><p>Owner: {owner(r.ownerId)} · Due: {r.due ?? 'Not set'} · Urgency: {r.urgency ?? 'routine'}</p><Button variant="outline" onClick={() => open(r.personId, r.visitId)}>Open referral visit <ChevronRight size={14} /></Button></article>)}
    <Foot w={w}><Shown w={w} />Referrals across your whole care scope.</Foot>
  </section>;
}

export function PagedReceipts({ organisationId, open, refresh }: { organisationId: string; open: Open; refresh: unknown }) {
  const [tab, setTab] = useState<'all' | 'attention'>('all');
  const w = useWorklist<SubmissionRow>(organisationId, 'submissions', tab, refresh);
  return <section className="panel receipt-panel" aria-label="Programme submissions">
    <div className="section-heading" role="tablist"><button role="tab" aria-selected={tab === 'all'} className={`text-link${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>All submissions ({w.page?.all ?? '…'})</button><button role="tab" aria-selected={tab === 'attention'} className={`text-link${tab === 'attention' ? ' active' : ''}`} onClick={() => setTab('attention')}>Needs attention ({w.page?.attention ?? '…'})</button><Shown w={w} /></div>
    {w.error && <div className="notice amber-notice" role="alert">{w.error}</div>}
    {w.rows.map(s => <div className="receipt-row" key={s.id}><div className={`receipt-icon ${s.state === 'accepted' ? 'ok' : 'warning'}`}>{s.state === 'accepted' ? <CheckCheck /> : <Clock3 />}</div><div className="receipt-main"><strong>{s.connectorName}</strong><span>{s.personName} · {new Date(s.createdAt).toLocaleString('en-IN')}</span><p>{s.message}</p><small>{s.receipt ?? 'Receipt not confirmed'} · {s.attempts} send attempts · {s.mode === 'demo' ? 'Demo' : 'HTTP API'}</small></div><div className="receipt-actions"><span className={`tag ${s.state === 'accepted' ? 'success' : 'amber'}`}>{s.state}</span><button className="text-link" onClick={() => open(s.personId, s.visitId)}>Open visit <ChevronRight size={14} /></button></div></div>)}
    {!w.rows.length && !w.loading && !w.error && <p className="muted">{tab === 'attention' ? 'No unresolved submissions. Every recorded destination has a confirmed status.' : 'No submissions yet. Confirm a visit, then review and run its programme plan.'}</p>}
    <Foot w={w}>Built on the server over your whole care scope. Open a visit to send, look up or view a receipt.</Foot>
  </section>;
}
