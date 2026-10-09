import type { Person, Snapshot } from './types';
import { visitCompare } from './worklist-views';

/** Presentation opt-in only; all existing server authorisation remains mandatory. */
export function workerDayEnabled(appFirst: boolean, requested: boolean, data: Snapshot | null): boolean {
  return appFirst && requested && data?.role === 'asha' && data.membership.status === 'active'
    && (data.environment === 'synthetic' || data.environment === 'training');
}

/** Preserve the existing work-list order; do not infer clinical priority or create tasks. */
export function workerDayRecords(data: Snapshot): Person[] | null {
  if (!workerDayEnabled(true, true, data) || data.patientPaging) return null;
  return data.people.filter(person => person.assigned && !person.mergedInto).slice().sort(visitCompare);
}
