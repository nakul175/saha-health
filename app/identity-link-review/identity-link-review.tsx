'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  identityLinkSelection,
  identityLinkResponse,
  identityLinkOperation,
  identityLinkSaved,
  type IdentityLinkReview as Review,
} from '@/lib/saha/identity-link-review';
import './identity-link-review.css';
type Attempt = { key: string; body: string; actor: string; org: string; person: string };
export default function IdentityLinkReview() {
  const [review, setReview] = useState<Review | null>(null),
    [notice, setNotice] = useState('Loading current correction context…'),
    [busy, setBusy] = useState(false),
    [entry, setEntry] = useState(''),
    [destination, setDestination] = useState(''),
    [identifier, setIdentifier] = useState(''),
    [reason, setReason] = useState(''),
    [origin, setOrigin] = useState(''),
    [verification, setVerification] = useState(''),
    [evidence, setEvidence] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [saved, setSaved] = useState('');
  const request = useRef<AbortController | null>(null),
    actor = useRef<string | null>(null),
    attempt = useRef<Attempt | null>(null),
    generation = useRef(0);
  const reset = useCallback(() => {
    setEntry('');
    setDestination('');
    setIdentifier('');
    setReason('');
    setOrigin('');
    setVerification('');
    setEvidence('');
    setConfirmed(false);
  }, []);
  const clear = useCallback(
    (message: string) => {
      generation.current++;
      request.current?.abort();
      setBusy(false);
      setReview(null);
      setSaved('');
      reset();
      setNotice(message);
      if (attempt.current) setUncertain(true);
    },
    [reset],
  );
  const load = useCallback(async () => {
    clear('Loading current correction context…');
    if (!navigator.onLine) {
      setNotice('Protected details cleared. Reconnect and refresh.');
      return;
    }
    let selected;
    try {
      selected = identityLinkSelection(new URLSearchParams(location.search));
    } catch {
      setNotice('Choose the correction link from Today.');
      return;
    }
    const controller = new AbortController(),
      g = generation.current;
    request.current = controller;
    try {
      const headers: Record<string, string> = { 'x-saha-organisation': selected.organisationId };
      if (actor.current) headers['x-saha-operation-actor'] = actor.current;
      const response = await fetch(
        '/api/identity-link-review?personId=' + encodeURIComponent(selected.personId),
        { credentials: 'same-origin', cache: 'no-store', headers, signal: controller.signal },
      );
      if (controller.signal.aborted || g !== generation.current) return;
      if (!response.ok) throw Error('Current correction access is unavailable. Return to Today or refresh.');
      const value = identityLinkResponse.parse(await response.json());
      if (
        value.organisationId !== selected.organisationId ||
        value.person.id !== selected.personId ||
        value.actorId !== response.headers.get('x-saha-operation-actor') ||
        response.headers.get('x-saha-organisation') !== selected.organisationId ||
        (actor.current && value.actorId !== actor.current) ||
        (value.refreshAt && Date.parse(value.refreshAt) <= Date.now())
      )
        throw Error('Current identity or assignment context is unavailable.');
      actor.current = value.actorId;
      setReview(value);
      setNotice('');
    } catch (e) {
      if (!controller.signal.aborted)
        setNotice(e instanceof Error ? e.message : 'Correction context unavailable.');
    }
  }, [clear]);
  useEffect(() => {
    const f = requestAnimationFrame(() => void load()),
      hide = () => clear('Protected details cleared. Reconnect and refresh.'),
      visibility = () => {
        if (document.hidden) hide();
      };
    window.addEventListener('offline', hide);
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(f);
      request.current?.abort();
      window.removeEventListener('offline', hide);
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [load, clear]);
  useEffect(() => {
    if (!review?.refreshAt) return;
    const expiry = () => clear('A correction or assignment interval changed. Return to Today and refresh.');
    const delay = Date.parse(review.refreshAt) - Date.now();
    if (delay <= 0) {
      const f = requestAnimationFrame(expiry);
      return () => cancelAnimationFrame(f);
    }
    const timer = setTimeout(expiry, Math.min(delay, 2147483647));
    return () => clearTimeout(timer);
  }, [review, clear]);
  async function send(a: Attempt) {
    if (
      !review ||
      review.actorId !== a.actor ||
      review.organisationId !== a.org ||
      review.person.id !== a.person ||
      !navigator.onLine
    )
      return;
    setBusy(true);
    setNotice('');
    setSaved('');
    setUncertain(false);
    const controller = new AbortController(),
      g = generation.current;
    request.current?.abort();
    request.current = controller;
    setReview(null);
    reset();
    try {
      const response = await fetch('/api/identity-link-review', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'x-saha-organisation': a.org,
          'x-saha-operation-actor': a.actor,
          'idempotency-key': a.key,
        },
        body: a.body,
        signal: controller.signal,
      });
      if (controller.signal.aborted || g !== generation.current) return;
      if (!response.ok)
        throw Error(
          'The attempt is unresolved here. Refresh access and check the exact original attempt; do not create another.',
        );
      const value = identityLinkSaved.parse(await response.json());
      if (
        value.key !== a.key ||
        value.review.actorId !== a.actor ||
        value.review.organisationId !== a.org ||
        value.review.person.id !== a.person ||
        response.headers.get('x-saha-operation-actor') !== a.actor ||
        response.headers.get('x-saha-organisation') !== a.org
      )
        throw Error('The saved correction could not be bound to this attempt.');
      attempt.current = null;
      setReview(value.review);
      setSaved(
        'Correction prepared locally. A different authorised person must approve before any separate send. Nothing was sent.',
      );
      setUncertain(false);
    } catch (e) {
      if (!controller.signal.aborted) {
        setUncertain(true);
        setNotice(e instanceof Error ? e.message : 'Outcome unknown. Keep the original attempt.');
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  function prepare(event: React.FormEvent) {
    event.preventDefault();
    if (!review || !confirmed || attempt.current) return;
    const selected = review.entries.find((x) => x.id === entry && x.current);
    if (!selected) return;
    try {
      const value = identityLinkOperation.parse({
        personId: review.person.id,
        command: {
          type: 'prepareIdentifierCorrection',
          personId: review.person.id,
          version: review.person.version,
          issuer: selected.issuer,
          corrects: selected.id,
          identifier,
          origin,
          verification,
          ...(evidence ? { evidence } : {}),
          destinationId: destination,
          reason,
        },
      });
      const a = {
        key: crypto.randomUUID(),
        body: JSON.stringify(value),
        actor: review.actorId,
        org: review.organisationId,
        person: review.person.id,
      };
      attempt.current = a;
      void send(a);
    } catch {
      setNotice(
        'Choose the current link and destination, enter its corrected value, source and review state, and a reason of at least 10 characters. Use the original issuer format: RCH 12 digits or Ni-kshay 6–10 digits. Document-seen evidence needs at least 3 characters.',
      );
    }
  }
  return (
    <main className="identity-links" aria-busy={busy}>
      <p>Saha · Synthetic / training</p>
      <h1>Programme identity corrections</h1>
      <p>
        Existing local history and recorded destination repairs. Saha has not verified these values with an
        issuer. Preparing a correction changes the local link; approval and sending are separate.
      </p>
      {notice && <p role="status">{notice}</p>}
      {saved && <p role="status">{saved}</p>}
      <button onClick={() => void load()} disabled={busy}>
        Refresh current correction access
      </button>
      <a href="/today">Return to Today</a>
      {uncertain && (
        <section aria-label="Unresolved correction attempt">
          <h2>Keep the original attempt</h2>
          <p>
            Only this open tab retains its original key and input. Do not prepare another correction. Refresh
            current access first.
          </p>
          {review && uncertain && (
            <button disabled={busy} onClick={() => void send(attempt.current!)}>
              Check exact correction attempt
            </button>
          )}
        </section>
      )}
      {review && (
        <>
          <h2>{review.person.name}</h2>
          <p>Record reference: {review.person.id}</p>
          <section aria-label="Identifier history">
            <h2>Identifier history</h2>
            {review.entries.length === 0 ? (
              <p>No programme identifiers recorded in this local ledger.</p>
            ) : (
              <ol>
                {review.entries.map((e) => (
                  <li key={e.id}>
                    <h3>
                      {e.label} · {e.masked}
                    </h3>
                    <p>
                      {e.kind === 'withdraw'
                        ? 'Withdrawal history'
                        : e.current
                          ? 'Current local link'
                          : 'Superseded local history'}{' '}
                      · {e.kind}
                    </p>
                    <dl>
                      <dt>Entry reference</dt>
                      <dd>{e.id}</dd>
                      <dt>Replaces</dt>
                      <dd>{e.corrects ?? 'No earlier entry'}</dd>
                      <dt>Recorded source</dt>
                      <dd>
                        {e.source} · {e.origin ?? 'Not recorded'}
                      </dd>
                      <dt>Verification recorded by a person</dt>
                      <dd>{e.verification}</dd>
                      <dt>Recorded by</dt>
                      <dd>{e.recordedBy}</dd>
                      <dt>Recorded at</dt>
                      <dd>{e.recordedAt}</dd>
                    </dl>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section aria-label="Recorded destination repairs">
            <h2>Recorded destination repairs</h2>
            <p>
              This is the existing correction queue for this person, not an exhaustive reconstruction of all
              downstream impacts. Accepted clinical records and receipts are retained.
            </p>
            {!review.repairs.length ? (
              <p>
                No correction work recorded in this queue. This does not prove that no external repair is
                needed.
              </p>
            ) : (
              <ol>
                {review.repairs.map((c) => (
                  <li key={c.id}>
                    <h3>
                      {c.destinationName} · {c.state}
                    </h3>
                    <p>
                      {c.unresolved ? 'Unresolved recorded correction' : 'Closed recorded correction'}
                      {c.expiryPassed
                        ? ' · approval interval passed; stored status has not been changed here'
                        : ''}
                    </p>
                    <dl>
                      <dt>Correction reference</dt>
                      <dd>{c.id}</dd>
                      <dt>Earlier entry</dt>
                      <dd>{c.corrects}</dd>
                      <dt>Superseding entry</dt>
                      <dd>{c.entryId}</dd>
                      <dt>Prepared by</dt>
                      <dd>{c.preparedBy}</dd>
                      <dt>Prepared at</dt>
                      <dd>{c.preparedAt}</dd>
                      <dt>Recorded send attempts</dt>
                      <dd>{c.attempts}</dd>
                      <dt>Recorded external receipt</dt>
                      <dd>{c.receipt ?? 'No receipt recorded'}</dd>
                    </dl>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {!uncertain && !busy && (
            <form aria-label="Prepare one identity correction" onSubmit={prepare}>
              <h2>Prepare one correction</h2>
              <p>
                Correct only an existing current programme link. Withdrawal, merge, approval, issuer
                verification and sending are outside this screen.
              </p>
              <label htmlFor="current-link">Current programme link</label>
              <select
                id="current-link"
                required
                value={entry}
                onChange={(e) => {
                  setEntry(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="">Choose the exact current entry</option>
                {review.entries
                  .filter((e) => e.current)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label} · {e.masked} · {e.id}
                    </option>
                  ))}
              </select>
              <label>
                Corrected programme identifier
                <input
                  required
                  maxLength={64}
                  inputMode="numeric"
                  pattern={
                    review.entries.find((e) => e.id === entry)?.issuer === 'rch' ? '[0-9]{12}' : '[0-9]{6,10}'
                  }
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setConfirmed(false);
                  }}
                  autoComplete="off"
                />
              </label>
              <label htmlFor="correction-source">Source of correction</label>
              <select
                id="correction-source"
                required
                value={origin}
                onChange={(e) => {
                  setOrigin(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="">Choose a recorded source</option>
                <option value="programme-card">Programme card</option>
                <option value="programme-system">Programme system</option>
                <option value="person-reported">Person reported</option>
                <option value="referral-document">Referral document</option>
              </select>
              <label htmlFor="correction-review-state">Review state</label>
              <select
                id="correction-review-state"
                required
                value={verification}
                onChange={(e) => {
                  setVerification(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="">Choose the supported review state</option>
                <option value="unverified">Not checked</option>
                <option value="document-seen">Document seen by the recorder</option>
              </select>
              <label>
                Document evidence, if seen
                <input
                  required={verification === 'document-seen'}
                  maxLength={200}
                  value={evidence}
                  onChange={(e) => {
                    setEvidence(e.target.value);
                    setConfirmed(false);
                  }}
                  autoComplete="off"
                />
              </label>
              <label>
                Reason for correction
                <textarea
                  required
                  minLength={10}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
              <label htmlFor="correction-destination">Existing demonstration destination</label>
              <select
                id="correction-destination"
                required
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="">Choose an enabled correction destination</option>
                {review.destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {!review.destinations.length && (
                <p>
                  No permitted demonstration correction destination is available. Nothing can be prepared
                  here.
                </p>
              )}
              <label className="confirm">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                I reviewed this person, current link, corrected value, source, reason and destination. Prepare
                only; do not approve or send.
              </label>
              <button disabled={!confirmed || !review.destinations.length}>Prepare correction locally</button>
              <button type="button" onClick={reset}>
                Cancel entered correction
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
