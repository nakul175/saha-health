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
  </section>;
}
