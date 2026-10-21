// The reference a later entry uses to point at an entry: its id, or for an entry from a slice 2h import its batch and row.
export const identifierRef = (e) => e.id ?? (e.imported ? `import:${e.imported.batchId}:${e.imported.row}` : '');
// Entries not replaced by a later correction or withdrawal, withdrawal entries themselves excluded: what the record holds now.
export function currentIdentifiers(p) { const list = p.identifiers ?? [], replaced = new Set(list.map(e => e.corrects).filter((x) => !!x)); return list.filter(e => e.kind !== 'withdraw' && !replaced.has(identifierRef(e))); }
// Slice 6t: audit actions that record a material read or an external request (see lib/saha/access-audit.ts).
export const ACCESS_ACTION_NAMES = ['viewPatientRecord', 'viewActionPlan', 'viewRecordHistory', 'viewMedia', 'viewExternalRecords', 'downloadFhir', 'externalRequest', 'indicatorExport', 'abhaLinkReview', 'importRejectionsExport', 'viewWorkspace', 'openRecord', 'searchPatients', 'listPatients', 'viewAggregate', 'identifierSearch', 'identifierSearchMiss', 'identifierConflictReview', 'incentiveExport', 'viewHousehold'];
export const PROGRAMMES = ['Maternal care', 'Chronic care', 'TB screening', 'Child health', 'General care'];
export const ROLE_LABEL = { asha: 'ASHA worker', clinician: 'Clinician', supervisor: 'Supervisor', admin: 'Administrator', provider: 'Provider (sandbox)' };
export const emptyFacts = () => ({ date: new Date().toISOString().slice(0, 16), systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: '', source: 'measured' });
// Slice 10i: imported visits are read-only history (lib/saha/imported-visits.ts). A record opens on its latest visit recorded in Saha, never an imported one.
export const isImported = (v) => !!v?.imported;
export const latestOwnVisitId = (visits, personId) => visits.filter(v => v.personId === personId && !v.imported).at(-1)?.id ?? null;
