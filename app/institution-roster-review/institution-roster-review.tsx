'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  institutionRosterSelection,
  institutionRosterContext,
  institutionRosterPreview,
  institutionRosterSaved,
  institutionRosterOperation,
  type InstitutionRosterContext,
  type InstitutionRosterPreview,
  type InstitutionRosterRow,
} from '@/lib/saha/institution-roster-review';
import './institution-roster-review.css';
type Attempt = { key: string; body: string; actor: string; org: string };
export default function InstitutionRosterReview() {
  const [context, setContext] = useState<InstitutionRosterContext | null>(null);
  const [preview, setPreview] = useState<InstitutionRosterPreview | null>(null);
  const [notice, setNotice] = useState('Loading current organisation authority…');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [role, setRole] = useState('');
  const [teams, setTeams] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState('');
  const pending = useRef<AbortController | null>(null),
    generation = useRef(0),
    actor = useRef<string | null>(null),
    attempt = useRef<Attempt | null>(null);
  const reset = useCallback(() => {
    setSelected('');
    setRole('');
    setTeams([]);
    setStatus('');
    setReason('');
    setConfirmed(false);
    setPreview(null);
  }, []);
  const clear = useCallback(
    (message: string) => {
      generation.current++;
      pending.current?.abort();
      setContext(null);
      setBusy(false);
      setSaved('');
      setNotice(message);
      reset();
      if (attempt.current) setUncertain(true);
    },
    [reset],
  );
  const load = useCallback(async () => {
    clear('Loading current organisation authority…');
    if (!navigator.onLine || document.hidden) {
      setNotice('Protected roster details cleared. Reconnect and refresh authority.');
      return;
    }
    let org;
    try {
      org = institutionRosterSelection(new URLSearchParams(location.search));
    } catch {
      setNotice('Choose one explicit organisation from its membership controls.');
      return;
    }
    const controller = new AbortController(),
      g = generation.current;
    pending.current = controller;
    try {
      const r = await fetch('/api/institution-roster-review', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'x-saha-organisation': org,
          ...(actor.current ? { 'x-saha-operation-actor': actor.current } : {}),
        },
      });
      if (controller.signal.aborted || g !== generation.current || document.hidden || !navigator.onLine)
        return;
      if (!r.ok)
        throw Error('Current owner roster access is unavailable. Check your organisation and refresh.');
      const value = institutionRosterContext.parse(await r.json());
      if (controller.signal.aborted || g !== generation.current || document.hidden || !navigator.onLine)
        return;
      if (
        value.organisationId !== org ||
        r.headers.get('x-saha-organisation') !== org ||
        r.headers.get('x-saha-operation-actor') !== value.actorId ||
        (actor.current && actor.current !== value.actorId) ||
        (value.refreshAt && Date.parse(value.refreshAt) <= Date.now())
      )
        throw Error('Current owner or organisation changed.');
      actor.current = value.actorId;
      setContext(value);
      setNotice('');
    } catch (e) {
      if (!controller.signal.aborted)
        setNotice(e instanceof Error ? e.message : 'Current roster unavailable.');
    }
  }, [clear]);
  useEffect(() => {
    const f = requestAnimationFrame(() => void load()),
      hide = () => clear('Protected roster details cleared. Reconnect and refresh authority.'),
      hidden = () => {
        if (document.hidden) hide();
      };
    window.addEventListener('offline', hide);
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAnimationFrame(f);
      pending.current?.abort();
      window.removeEventListener('offline', hide);
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [load, clear]);
  useEffect(() => {
    if (!context?.refreshAt) return;
    const timer = setTimeout(
      () => clear('Current assignment context reached its deadline. Refresh organisation authority.'),
      Math.min(Math.max(0, Date.parse(context.refreshAt) - Date.now()), 2147483647),
    );
    return () => clearTimeout(timer);
  }, [context, clear]);
  async function post(body: string, key?: string) {
    if (!context || !navigator.onLine || document.hidden) return;
    const original = context,
      controller = new AbortController(),
      g = generation.current;
    pending.current?.abort();
    pending.current = controller;
    setBusy(true);
    setNotice('');
    setSaved('');
    setPreview(null);
    if (key) {
      setContext(null);
      reset();
      setUncertain(false);
    }
    try {
      const r = await fetch('/api/institution-roster-review', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-saha-organisation': original.organisationId,
          'x-saha-operation-actor': original.actorId,
          ...(key ? { 'idempotency-key': key } : {}),
        },
        body,
      });
      if (controller.signal.aborted || g !== generation.current || document.hidden || !navigator.onLine)
        return;
      if (!r.ok)
        throw Error(
          key
            ? 'The original attempt is unresolved here. Refresh owner authority and check that exact attempt; do not apply a new one.'
            : 'Current roster could not be previewed. Refresh authority and choose again.',
        );
      const value = key
        ? institutionRosterSaved.parse(await r.json())
        : institutionRosterPreview.parse(await r.json());
      if (controller.signal.aborted || g !== generation.current || document.hidden || !navigator.onLine)
        return;
      if (
        value.context.organisationId !== original.organisationId ||
        value.context.actorId !== original.actorId ||
        r.headers.get('x-saha-operation-actor') !== original.actorId ||
        r.headers.get('x-saha-organisation') !== original.organisationId ||
        (key && ('key' in value ? value.key !== key : true)) ||
        (value.context.refreshAt && Date.parse(value.context.refreshAt) <= Date.now())
      )
        throw Error('Returned roster belongs to changed authority or scope.');
      setContext(value.context);
      if ('key' in value) {
        attempt.current = null;
        setUncertain(false);
        setSaved(
          'Exact partial roster applied locally. No invitations were created. Check recorded local access separately; this is not upstream federation or session termination.',
        );
      } else {
        setPreview(value);
        setConfirmed(false);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        const message = e instanceof Error ? e.message : 'Roster outcome unavailable.';
        if (key) {
          setUncertain(true);
          setContext(null);
          setNotice(message);
        } else clear(message);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  function review(event: React.FormEvent) {
    event.preventDefault();
    if (!context) return;
    const member = context.members.find((m) => m.accountCode === selected && m.editable);
    if (!member) return;
    try {
      const value = institutionRosterOperation.parse({
        kind: 'preview',
        rows: [{ accountCode: member.accountCode, name: member.name, role, teams, status }],
      });
      void post(JSON.stringify(value));
    } catch {
      setNotice(
        'Choose one current member, a supported local role, recorded teams and explicit active or left status.',
      );
    }
  }
  function apply() {
    if (!context || !preview || !confirmed || attempt.current) return;
    const member = context.members.find((m) => m.accountCode === selected && m.editable);
    if (!member) return;
    try {
      const value = institutionRosterOperation.parse({
          kind: 'apply',
          rows: [
            {
              accountCode: member.accountCode,
              name: member.name,
              role,
              teams,
              status,
            } as InstitutionRosterRow,
          ],
          previewHash: preview.hash,
          reason,
        }),
        a = {
          key: crypto.randomUUID(),
          body: JSON.stringify(value),
          actor: context.actorId,
          org: context.organisationId,
        };
      attempt.current = a;
      void post(a.body, a.key);
    } catch {
      setNotice('Explain the institutional change in at least 10 characters before applying.');
    }
  }
  const change = () => {
    setPreview(null);
    setConfirmed(false);
  };
  return (
    <main className="institution-roster">
      <p>Saha · Synthetic / training · Owner controls</p>
      <h1>Institution roster reconciliation</h1>
      <p>
        Manual review of existing local membership only. No enterprise feed, buyer-approved group mapping,
        synchronisation window or upstream session termination is established here. Unrecognised roles are
        refused, never converted to clinical privileges.
      </p>
      {notice && <p role="status">{notice}</p>}
      {saved && <p role="status">{saved}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Refresh current owner authority
      </button>
      {uncertain && (
        <section aria-label="Unresolved roster attempt">
          <h2>Keep the original roster attempt</h2>
          <p>
            This open tab retains the exact original input and key. Refresh the original owner’s current
            authority before recovery; do not apply another attempt.
          </p>
          {context && (
            <button
              disabled={busy}
              onClick={() => {
                const a = attempt.current;
                if (a && context.actorId === a.actor && context.organisationId === a.org)
                  void post(a.body, a.key);
              }}
            >
              Check exact roster attempt
            </button>
          )}
        </section>
      )}
      {context && (
        <>
          <h2>{context.organisationName}</h2>
          <p>Organisation reference: {context.organisationId}</p>
          <section aria-label="Current recorded roster">
            <h3>Current recorded roster</h3>
            <ul>
              {context.members.map((m) => (
                <li key={m.userId}>
                  <strong>{m.name}</strong>
                  <p>
                    {m.role} · {m.status} · v{m.version}
                  </p>
                  <p>Account reference: {m.accountCode}</p>
                  <p>
                    Teams:{' '}
                    {m.teams.length
                      ? m.teams.map((id) => context.teams.find((t) => t.id === id)?.name ?? id).join(', ')
                      : 'None recorded'}
                  </p>
                  {!m.editable && (
                    <p>Separate controlled workflow required; this screen does not change this membership.</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
          {!uncertain && !busy && (
            <form aria-label="Review existing institution member" onSubmit={review}>
              <h3>Review one explicit partial roster row</h3>
              <p>
                Unlisted members stay unchanged. No invitation, owner change, self change, provider or fixture
                management, or local suspension reactivation is offered.
              </p>
              <label htmlFor="roster-member">Existing editable member</label>
              <select
                id="roster-member"
                required
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setRole('');
                  setTeams([]);
                  setStatus('');
                  change();
                }}
              >
                <option value="">Choose the exact current account</option>
                {context.members
                  .filter((m) => m.editable)
                  .map((m) => (
                    <option key={m.accountCode} value={m.accountCode}>
                      {m.name} · {m.accountCode}
                    </option>
                  ))}
              </select>
              <label htmlFor="roster-role">Recorded institution role to apply locally</label>
              <select
                id="roster-role"
                required
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  change();
                }}
              >
                <option value="">Choose a supported local role</option>
                {['asha', 'clinician', 'supervisor', 'admin'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <fieldset>
                <legend>Recorded institution teams</legend>
                {context.teams.map((t) => (
                  <label className="tick" key={t.id}>
                    <input
                      type="checkbox"
                      checked={teams.includes(t.id)}
                      onChange={(e) => {
                        setTeams(e.target.checked ? [...teams, t.id] : teams.filter((id) => id !== t.id));
                        change();
                      }}
                    />
                    {t.name}
                  </label>
                ))}
              </fieldset>
              <label htmlFor="roster-status">Institution roster status</label>
              <select
                id="roster-status"
                required
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  change();
                }}
              >
                <option value="">Choose the explicit status</option>
                <option value="active">Active in the institution roster</option>
                <option value="left">Listed as left; suspend local membership</option>
              </select>
              {status === 'left' && (
                <p>
                  Listed as left suspends local status only. The original command keeps the existing role and
                  teams; those entered fields are not applied.
                </p>
              )}
              <button>Preview original roster differences</button>
              <button type="button" onClick={reset}>
                Cancel entered roster row
              </button>
            </form>
          )}
          {preview && !uncertain && (
            <section aria-label="Original roster preview">
              <h3>Original roster preview</h3>
              <ul>
                {preview.actions.map((a) => (
                  <li key={a.accountCode}>
                    {a.name} · {a.action}
                    <p>{a.detail}</p>
                  </li>
                ))}
              </ul>
              <p>Exact review reference: {preview.hash}</p>
              <label htmlFor="roster-reason">Reason and institutional source reference</label>
              <textarea
                id="roster-reason"
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setConfirmed(false);
                }}
              />
              <label className="tick">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                I reviewed this exact existing member, local role, recorded teams, status and original
                differences. Apply only this partial row.
              </label>
              {context.refreshAt && (
                <p>
                  Applying is unavailable while a scheduled assignment interval is pending. Use existing
                  authoritative organisation processing first.
                </p>
              )}
              <button
                disabled={
                  !confirmed ||
                  reason.trim().length < 10 ||
                  busy ||
                  !!context.refreshAt ||
                  (!preview.counts.update && !preview.counts.suspend)
                }
                onClick={apply}
              >
                Apply exact reviewed partial roster
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
