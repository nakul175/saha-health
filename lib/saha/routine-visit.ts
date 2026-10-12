import type { Person, Visit } from './types';

export type RoutinePerson = Pick<Person, 'id' | 'name' | 'village' | 'age' | 'sex' | 'version'>;
export type RoutineContext = { organisationId: string; person: RoutinePerson; visit: Visit | null };
export type RoutineStaleRefusal = {
  outcome: 'not-applied-stale-version'; key: string; organisationId: string; personId: string;
  visitId: string; expectedVersion: number; currentVersion: number;
};

// Keep the captured contracts and their provenance; omit plans, provider payloads and unrelated visits.
export function routineVisit(visit: Visit): Visit {
  return {
    id: visit.id, personId: visit.personId, version: visit.version, state: visit.state,
    facts: visit.facts, createdAt: visit.createdAt, confirmedAt: visit.confirmedAt,
    recordVersion: visit.recordVersion, aiResults: [], programmeCapture: visit.programmeCapture,
    valueRangeCapture: visit.valueRangeCapture, valueOverrides: visit.valueOverrides,
    overrideConfirmations: visit.overrideConfirmations, factAuthors: visit.factAuthors,
    factReviews: visit.factReviews, noteAuthor: visit.noteAuthor, answerAuthors: visit.answerAuthors,
    entryReviews: visit.entryReviews, patientCheck: visit.patientCheck,
    voidedAt: visit.voidedAt, supersededBy: visit.supersededBy,
  };
}
