'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TodayRecord, TodayRow, TodayResponse } from '@/lib/saha/today';
import './today.css';

type View =
  | { kind: 'loading' | 'unavailable' | 'refused' | 'unsupported' }
  | { kind: 'list'; records: TodayRow[] }
  | { kind: 'record'; record: TodayRecord; organisationId: string };

const notices = {
  loading: 'Loading assigned records…',
  unavailable: 'Records unavailable. Check your connection and try again.',
  refused: 'Access refused. Sign in through your organisation and check your ASHA membership.',
  unsupported: 'This workspace is not supported by Today. Use your synthetic or training workspace.',
};

export default function Today() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const request = useRef<AbortController | null>(null);
  const organisation = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const load = useCallback(async (id?: string) => {
    request.current?.abort();
    const selectedOrganisation = id ? organisation.current : null;
    if (!id) organisation.current = null;
    const controller = new AbortController();
    request.current = controller;
    setView({ kind: 'loading' });
    if (id && !selectedOrganisation) {
      setView({ kind: 'unsupported' });
      return;
    }
    if (!navigator.onLine) {
      setView({ kind: 'unavailable' });
      return;
    }
    try {
      const response = await fetch('/api/today' + (id ? '?personId=' + encodeURIComponent(id) : ''), {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: selectedOrganisation ? { 'x-saha-organisation': selectedOrganisation } : {},
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setView({
          kind: [401, 403, 404].includes(response.status)
            ? 'refused'
            : response.status === 409
              ? 'unsupported'
              : 'unavailable',
        });
        return;
      }
      const body: TodayResponse = await response.json();
      if (controller.signal.aborted) return;
      const organisationId = response.headers.get('x-saha-organisation');
      if (!organisationId || (selectedOrganisation && organisationId !== selectedOrganisation)) {
        setView({ kind: 'unsupported' });
        return;
      }
      organisation.current = organisationId;
      if (id && 'record' in body && body.record.id === id)
        setView({ kind: 'record', record: body.record, organisationId });
      else if (!id && 'records' in body && Array.isArray(body.records))
        setView({ kind: 'list', records: body.records });
      else setView({ kind: 'unsupported' });
    } catch {
      if (!controller.signal.aborted) setView({ kind: 'unavailable' });
    }
  }, []);

  useEffect(() => {
    const initialFrame = requestAnimationFrame(() => void load());
    const clear = () => {
      request.current?.abort();
      organisation.current = null;
      setView({ kind: 'unavailable' });
    };
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const visibility = () => {
      if (document.hidden) clear();
      else refresh();
    };
    window.addEventListener('offline', clear);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pagehide', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(initialFrame);
      request.current?.abort();
      window.removeEventListener('offline', clear);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pagehide', clear);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [load]);

  useEffect(() => {
    if (view.kind !== 'loading') heading.current?.focus();
  }, [view]);
  const record = view.kind === 'record' ? view.record : null;
  return (
    <main className="saha-today" aria-busy={view.kind === 'loading'}>
      <p>Saha · Synthetic / training</p>
      <h1 ref={heading} tabIndex={-1}>
        {record ? record.name : 'Today'}
      </h1>
      {record ? (
        <>
          <p>Read-only record context</p>
          <dl>
            <dt>Village</dt>
            <dd>{record.village || 'Not recorded'}</dd>
            <dt>Record reference</dt>
            <dd>{record.id}</dd>
            <dt>Age</dt>
            <dd>{record.age ?? 'Not recorded'}</dd>
            <dt>Sex</dt>
            <dd>{record.sex || 'Not recorded'}</dd>
          </dl>
          <button onClick={() => void load()}>Back to Today</button>
          <a href={'/routine-visit?personId=' + encodeURIComponent(record.id) + '&organisationId=' +
            encodeURIComponent(view.kind === 'record' ? view.organisationId : '')}>Review routine visit</a>
          <a href={'/fact-freshness?personId=' + encodeURIComponent(record.id) + '&organisationId=' +
            encodeURIComponent(view.kind === 'record' ? view.organisationId : '')}>Review original fact times</a>
        </>
      ) : (
        <>
          <p>Assigned records. This list is not a dated daily schedule.</p>
          {view.kind === 'list' ? (
            <>
              <h2>Assigned records</h2>
              {view.records.length === 0 ? (
                <p role="status">No assigned records.</p>
              ) : (
                <ol>
                  {view.records.map((person, index) => (
                    <li key={person.id}>
                      {index === 0 && <p>Next in your list</p>}
                      <h3>{person.name}</h3>
                      <p>{person.village || 'Village not recorded'}</p>
                      <p>Record reference: {person.id}</p>
                      <button aria-label={`Open record ${person.id}`} onClick={() => void load(person.id)}>
                        Open record
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <p role="status">{view.kind === 'record' ? '' : notices[view.kind]}</p>
          )}
          <button disabled={view.kind === 'loading'} onClick={() => void load()}>
            Refresh assigned records
          </button>
        </>
      )}
    </main>
  );
}
