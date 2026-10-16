/** Presentation of the last authorised readback, separate from current unsaved input.
 * This connected workflow never acknowledges device persistence or destination delivery. */
export type RoutineSaveStatusInput = {
  visit: { version: number; state: 'draft' | 'confirmed'; voidedAt?: string; supersededBy?: string } | null;
  dirty: boolean;
  busy: boolean;
  uncertain: boolean;
  lifecycle?: VisitLifecycle;
};
export function routineSaveStatus({ visit, dirty, busy, uncertain, lifecycle }: RoutineSaveStatusInput) {
  const entries = uncertain
    ? 'Write outcome unresolved. Check the original attempt before another save.'
    : busy ? 'Operation in progress. Wait for the server result.'
    : dirty ? 'Unsaved changes on this screen.'
    : visit ? 'Entries match the last loaded server record.' : 'No routine draft loaded.';
  const record = !visit ? 'No server draft loaded.'
    : visit.voidedAt ? `Server version ${visit.version}: voided record.`
    : visit.supersededBy ? `Server version ${visit.version}: superseded record.`
    : `Server version ${visit.version}: ${visit.state === 'confirmed' ? 'confirmed encounter' : 'draft awaiting review'}.`;
  return {
    entries,
    record,
    device: 'This screen does not save a durable copy on this device.',
    destination: 'Destination status is not loaded by this screen. No submission or acceptance is claimed.',
    ...(lifecycle ? { lifecycle } : {}),
  };
}
import type { VisitLifecycle } from './lifecycle-status';
