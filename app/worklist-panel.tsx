'use client';
import { useI18n } from './i18n';
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
      // Slice 6w: a restarted page (the list changed between pages) replaces the rows instead of appending.
      setRows(prev => cursor && !j.restarted ? [...prev, ...(j.rows as R[])] : j.rows as R[]); setPage(j); setError(j.restarted ? 'This list changed while you were reading it, so it was loaded again from the top.' : '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this list.'); } finally { setLoading(false); }
  }, [organisationId, view, tab]);
  useEffect(() => { if (organisationId) void load(null); else { setRows([]); setPage(null); } }, [organisationId, load, refresh]);
  return { page, rows, loading, error, more: page?.nextCursor ? () => void load(page.nextCursor) : null };
}

function Foot({ w, children }: { w: Worklist<unknown>; children: React.ReactNode }) {
  const { t } = useI18n();
  return <div className="list-foot">{w.more && <Button variant="outline" disabled={w.loading} onClick={w.more}>{w.loading && <Loader2 className="spin" size={16} />}{t('work.loadMore')}</Button>}{w.loading && !w.more && <Loader2 className="spin" size={16} />}<ShieldCheck size={15} />{children}</div>;
}
const Shown = ({ w }: { w: Worklist<unknown> }) => { const { t } = useI18n(); return w.page && w.rows.length < w.page.total ? <span className="muted text-sm">{t('work.showing', { shown: w.rows.length.toLocaleString('en-IN'), total: w.page.total.toLocaleString('en-IN') })}</span> : null; };

export function PagedVisitList({ w, open, asha }: { w: Worklist<WorkRow>; open: Open; asha: boolean }) {
  const { t } = useI18n();
  return <section className="panel worklist" aria-label={t('work.listTitle')}>
    <div className="section-heading"><h2>{t('work.listTitle')} <span className="number-badge">{w.page?.total ?? '…'}</span></h2><span className="muted text-sm">{asha ? t('work.assigned') : t('work.wholeScope')}</span><Shown w={w} /></div>
    {w.error && <div className="notice amber-notice" role="alert">{w.error}</div>}
    <div className="patient-list">{w.rows.map(p => <button className="patient-row" key={p.id} onClick={() => open(p.id)}><div className="patient-row-name"><strong>{p.name}</strong><span>{p.age ?? '—'} years · {p.village}{p.merged ? t('work.merged') : ''}</span></div><div className="patient-row-task"><span>{p.task}</span><div className="tags"><span className="tag neutral">{p.programmes[0]}</span></div></div><div className="patient-row-status"><span className={`tag ${p.status === 'completed' ? 'success' : p.status === 'in_progress' ? 'blue' : 'neutral'}`}>{p.status === 'completed' ? t('work.status.confirmed') : p.status === 'in_progress' ? t('work.status.inProgress') : p.due}</span><ChevronRight size={18} /></div></button>)}
      {!w.rows.length && !w.loading && !w.error && <p className="muted">{t('work.noPeople')}</p>}</div>
    <Foot w={w}>{t('work.pagedFoot')}</Foot>
  </section>;
}

export function PagedFollowUps({ organisationId, open, refresh }: { organisationId: string; open: Open; refresh: unknown }) {
  const { t } = useI18n(), w = useWorklist<FollowUpRow>(organisationId, 'followups', 'all', refresh), today = new Date().toISOString().slice(0, 10);
  return <section className="panel programme-patient" aria-label={t('work.followTitle')}><div className="section-heading"><h2>{t('work.followTitle')} <span className="number-badge">{w.page?.tasks ?? '…'}</span></h2><span className="muted text-sm">{t('work.followSub')}</span><Shown w={w} /></div>
    {w.error && <div className="notice amber-notice" role="alert">{w.error}</div>}
    {!w.rows.length && !w.loading && !w.error ? <p className="muted">{t('work.followEmpty')}</p> : w.rows.map(g => <button className="followup-group" key={g.personId} onClick={() => open(g.personId)}><strong>{g.name}</strong><div>{g.tasks.map(x => <p key={x.id}>{x.due} · {PACKS.find(p => p.id === x.packId)?.name ?? x.packId} · {x.title}{x.due < today ? t('work.overdue') : ''}</p>)}</div><span>{t('work.openRecord')}</span></button>)}
    <Foot w={w}>{t('work.followFoot')}</Foot>
  </section>;
}

export function PagedReferrals({ organisationId, open, refresh, owner }: { organisationId: string; open: Open; refresh: unknown; owner: (userId?: string) => string }) {
  const { t } = useI18n(), w = useWorklist<ReferralRow>(organisationId, 'referrals', 'all', refresh);
  return <section className="referral-section" aria-label={t('work.refTitle')}><h2>{t('work.refTitle')} <span className="number-badge">{w.page?.total ?? '…'}</span></h2><p>{t('work.refPagedIntro')}</p>
    {w.error && <div className="notice amber-notice" role="alert">{w.error}</div>}
    {!w.rows.length && !w.loading && !w.error ? <p className="muted">{t('work.refEmpty')}</p> : w.rows.map(r => <article className="panel referral-tracker" key={r.id}><div className="section-heading"><div><h3>{r.facility}</h3><p>{r.personName} · {r.reason}</p></div><span className="tag">{STATE_LABEL[r.state as ReferralState] ?? r.state}</span></div><p>{t('work.refRow', { owner: owner(r.ownerId), due: r.due ?? 'Not set', urgency: r.urgency ?? 'routine' })}</p><Button variant="outline" onClick={() => open(r.personId, r.visitId)}>{t('work.refOpen')} <ChevronRight size={14} /></Button></article>)}
    <Foot w={w}><Shown w={w} />{t('work.refFoot')}</Foot>
  </section>;
}

export function PagedReceipts({ organisationId, open, refresh }: { organisationId: string; open: Open; refresh: unknown }) {
  const { t, signOff } = useI18n();
  const [tab, setTab] = useState<'all' | 'attention'>('all');
  const w = useWorklist<SubmissionRow>(organisationId, 'submissions', tab, refresh);
  return <section className="panel receipt-panel" aria-label={t('receipts.title')}>
    <div className="section-heading" role="tablist"><button role="tab" aria-selected={tab === 'all'} className={`text-link${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>{t('receipts.all', { n: w.page?.all ?? '…' })}</button><button role="tab" aria-selected={tab === 'attention'} className={`text-link${tab === 'attention' ? ' active' : ''}`} onClick={() => setTab('attention')}>{t('receipts.attention', { n: w.page?.attention ?? '…' })}</button><Shown w={w} /></div>
    {w.error && <div className="notice amber-notice" role="alert">{w.error}</div>}
    {w.rows.map(s => <div className="receipt-row" key={s.id}><div className={`receipt-icon ${s.state === 'accepted' ? 'ok' : 'warning'}`}>{s.state === 'accepted' ? <CheckCheck /> : <Clock3 />}</div><div className="receipt-main"><strong>{s.connectorName}</strong><span>{s.personName} · {new Date(s.createdAt).toLocaleString('en-IN')}</span><p>{s.message}</p><small>{s.receipt ?? t('receipts.notConfirmed')} · {t('receipts.attempts', { n: s.attempts, mode: s.mode === 'demo' ? t('receipts.modeDemo') : 'HTTP API' })}</small><small className="block">{t('receipts.signOff', { text: signOff(s.signOff) })}</small></div><div className="receipt-actions"><span className={`tag ${s.state === 'accepted' ? 'success' : 'amber'}`}>{t(`common.state.${s.state}`)}</span><button className="text-link" onClick={() => open(s.personId, s.visitId)}>{t('receipts.openVisit')} <ChevronRight size={14} /></button></div></div>)}
    {!w.rows.length && !w.loading && !w.error && <p className="muted">{tab === 'attention' ? `${t('receipts.emptyAttentionTitle')}. ${t('receipts.emptyAttentionBody')}` : `${t('receipts.emptyAllTitle')}. ${t('receipts.emptyAllBody')}`}</p>}
    <Foot w={w}>{t('receipts.pagedFoot')}</Foot>
  </section>;
}
