'use client';
// Slice 6v: in-app alert notifications. A bell in the top bar shows the signed-in member's unread count
// for alerts they own; the list shows deliveries and escalations. Nothing is emailed, texted or sent.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
type Item = { id: string; alertId: string; level: number; kind: 'delivery' | 'escalation'; severity: 'critical' | 'high' | 'normal'; title: string; count: number | null; detail: string | null; deliveredAt: string; readAt: string | null; clearedAt: string | null; clearedReason: string | null; active: boolean };
type Inbox = { unread: number; items: Item[]; owns: string[]; channel: string };
const when = (v: string) => new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export function AlertBell({ orgId, refreshKey, busy, command, openOperations }: { orgId: string | null; refreshKey: unknown; busy: boolean; command: (body: any, success?: string) => Promise<any>; openOperations: () => void }) {
  const [inbox, setInbox] = useState<Inbox | null>(null), [open, setOpen] = useState(false), [failed, setFailed] = useState(false);
  const panel = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  const load = useCallback(async () => { if (!orgId) return; try { const r = await fetch('/api/alerts', { headers: { 'x-saha-organisation': orgId }, cache: 'no-store' }); if (!r.ok) throw Error(); setInbox(await r.json()); setFailed(false); } catch { setFailed(true); } }, [orgId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  // Poll while the page is visible: the Worker has no background timer, so reads drive evaluation.
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (!open) return; const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } }; document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, [open]);
  if (!orgId || !inbox || !inbox.owns.length) return null;
  const unread = inbox.items.filter(i => i.active && !i.readAt).map(i => i.id);
  const markRead = async (ids: string[]) => { if (!ids.length) return; await command({ type: 'alertInboxMarkRead', ids }, ids.length === 1 ? 'Notification marked read' : 'Notifications marked read'); await load(); };
  return <div className="alert-bell">
    <button ref={button} className="icon-button alert-bell-button" aria-label={`Alert notifications: ${inbox.unread} unread`} aria-expanded={open} aria-controls="alert-inbox" onClick={() => setOpen(x => !x)}><Bell size={17} />{inbox.unread > 0 && <span className="alert-bell-count" aria-hidden="true">{inbox.unread > 99 ? '99+' : inbox.unread}</span>}</button>
    {open && <div ref={panel} id="alert-inbox" className="alert-inbox" role="region" aria-label="Alert notifications">
      <div className="alert-inbox-head"><h2>Alert notifications</h2><button className="icon-button" aria-label="Close alert notifications" onClick={() => { setOpen(false); button.current?.focus(); }}><X size={16} /></button></div>
      <p className="alert-inbox-note">{inbox.channel} {failed ? 'The latest notifications could not be loaded; showing the last ones received.' : ''}</p>
      {inbox.items.length ? <ul className="alert-inbox-list">{inbox.items.map(i => <li key={i.id} className={`alert-inbox-item${i.active ? '' : ' cleared'}${i.active && !i.readAt ? ' unread' : ''}`} data-alert={i.alertId} data-kind={i.kind}>
        <div className="alert-inbox-tags"><span className={`tag ${i.severity === 'critical' ? 'amber' : i.severity === 'high' ? 'amber' : 'general'}`}>{i.severity}</span>{i.kind === 'escalation' && <span className="tag blue">Escalated to owners</span>}{!i.active && <span className="tag success">{i.clearedReason === 'acknowledged' ? 'Acknowledged' : 'Resolved'}</span>}</div>
        <strong>{i.title}</strong>
        {i.count !== null && <small>{i.count} when delivered</small>}
        {i.detail && <p>{i.detail}</p>}
        <small>Delivered {when(i.deliveredAt)}{i.readAt ? ` · read ${when(i.readAt)}` : ''}{i.clearedAt ? ` · ${i.clearedReason === 'acknowledged' ? 'acknowledged' : 'resolved'} ${when(i.clearedAt)}` : ''}</small>
        {i.active && !i.readAt && <Button size="sm" variant="outline" disabled={busy} onClick={() => void markRead([i.id])}>Mark read</Button>}
      </li>)}</ul> : <p className="alert-inbox-empty">No alert notifications for you.</p>}
      <div className="alert-inbox-actions">{unread.length > 1 && <Button size="sm" variant="outline" disabled={busy} onClick={() => void markRead(unread.slice(0, 50))}>Mark all read</Button>}<Button size="sm" onClick={() => { setOpen(false); openOperations(); }}>Open Operations</Button></div>
    </div>}
  </div>;
}
