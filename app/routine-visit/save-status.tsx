'use client';
import { routineSaveStatus, type RoutineSaveStatusInput } from '@/lib/saha/routine-save-status';

export function RoutineSaveStatus(props: RoutineSaveStatusInput) {
  const status = routineSaveStatus(props);
  return <section aria-label="Visit save status" aria-live="polite" aria-atomic="true">
    <h2>Save status</h2>
    <dl>
      <dt>Current entries</dt><dd>{status.entries}</dd>
      <dt>Loaded server version for these entries</dt><dd>{status.record}</dd>
      <dt>On this device</dt><dd>{status.device}</dd>
      <dt>Destinations</dt><dd>{status.destination}</dd>
    </dl>
    {status.lifecycle && <section aria-label="Lifecycle by destination">
      <h3>Actual lifecycle</h3>
      <p>Local task: {status.lifecycle.local} · Server: {status.lifecycle.server} · Review: {status.lifecycle.review} · Service: {status.lifecycle.service}</p>
      <p>Durable device copy: not claimed by this connected screen.</p>
      {status.lifecycle.destinations.length ? <ul>{status.lifecycle.destinations.map(item => <li key={item.id}>
        <strong>{item.name}: {item.state}</strong>{item.receipt ? <> · receipt {item.receipt}</> : null}
        {item.recovery ? <p>{item.recovery}</p> : null}
      </li>)}</ul> : <p>No destination submission exists for this visit.</p>}
      {status.lifecycle.unresolved > 0 && <p><strong>{status.lifecycle.unresolved} destination action{status.lifecycle.unresolved === 1 ? '' : 's'} still require recovery.</strong></p>}
    </section>}
  </section>;
}
