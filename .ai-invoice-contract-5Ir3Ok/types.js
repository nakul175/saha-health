// Slice 6t: audit actions that record a material read or an external request (see lib/saha/access-audit.ts).
export const ACCESS_ACTION_NAMES = ['viewPatientRecord', 'viewRecordHistory', 'viewMedia', 'viewExternalRecords', 'downloadFhir', 'externalRequest', 'indicatorExport', 'abhaLinkReview'];
export const PROGRAMMES = ['Maternal care', 'Chronic care', 'TB screening', 'Child health', 'General care'];
export const ROLE_LABEL = { asha: 'ASHA worker', clinician: 'Clinician', supervisor: 'Supervisor', admin: 'Administrator', provider: 'Provider (sandbox)' };
export const emptyFacts = () => ({ date: new Date().toISOString().slice(0, 16), systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: '', source: 'measured' });
