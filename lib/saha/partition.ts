import type { D1Database } from '@cloudflare/workers-types';

// Slice 0a: patient-partitioned loading and concurrency.
//
// A command listed here is certified as deciding only from (a) organisation-level state
// (membership, teams, connections, governance, outreach and other organisation documents)
// and (b) the records of the patient(s) it names. Such a command loads only those patients
// and commits under a per-patient guard, so teammates working on different patients no
// longer conflict. Anything that compares across patients (registration matching, duplicate
// EHR links, agent daily caps, outreach cohorts, reports) is deliberately absent and keeps
// the organisation-wide load and guard.
export const PATIENT_COMMANDS = new Set<string>([
  // core visit, plan, consent and referral work
  'startVisit', 'saveVisit', 'confirmVisit', 'preparePlan', 'approvePlan', 'executePlan', 'reconcile',
  'setConsent', 'withdrawConsent', 'runAI', 'reviewAI', 'createReferral',
  // corrections and assignment
  'amendVisit', 'voidVisit', 'correctIdentity', 'assignPatient',
  // programme episodes and follow-ups
  'enrolProgramme', 'scheduleFollowUp', 'resolveFollowUp', 'closeEnrolment', 'saveProgrammeAnswers',
  // field grants and referral tracking
  'prepareFieldVisit', 'syncFieldVisit', 'revokeFieldLease', 'assignReferral', 'recordReferralEvent', 'referralDelay',
  // slice 4b: action-plan ownership of one patient's follow-ups and referrals
  'assignPlanItem',
  // slice 4d: dependencies between one patient's plan items and further sources of one referral
  'linkPlanItems', 'unlinkPlanItems', 'linkReferralSource',
  // identity review and handover acknowledgement
  'resolvePatientIdentity', 'acknowledgeAssignment',
  // clinical review on one encounter
  'saveClinicalConcern', 'checkProtocol', 'reviewProtocol', 'createDirectoryReferral',
  // contact preferences
  'setContactPreferences',
  // EHR permissions and reviewed documents for one patient
  'grantEhrPermission', 'revokeEhrPermission', 'revokeEhrLink', 'reviewEhrDocument', 'prepareEhrPublish', 'importEhrDocument',
  // unsent programme delivery cancellation
  'cancelSubmission',
  // slice 2b: visit media attach and draft removal
  'attachMedia', 'removeMedia',
  // slice 2e: clinician verification of one measurement on a confirmed visit
  'verifyFact',
  // slice 2g: clinician review of notes and programme answers, and supervisor sign-off of one confirmed visit
  'verifyEntry', 'signOffVisit',
  // slice 2i: clinician confirmation of an unusual value on one draft visit
  'confirmUnusualValue',
]);

// Rows a patient-scoped commit may write. Any other table makes the commit organisation-wide.
export const PATIENT_TABLES = new Set<string>(['patients', 'visits', 'plans', 'ai_results', 'submissions', 'referrals', 'record_revisions', 'audit_events', 'command_receipts', 'media']);

const lookups: [field: string, table: string][] = [['visitId', 'visits'], ['referralId', 'referrals'], ['submissionId', 'submissions']];

// Resolves the patient a certified command names. Returns null (organisation-wide load)
// when the command is not certified or the reference is not found in this organisation;
// the normal handler then reports the missing record exactly as before.
export async function patientTargets(db: D1Database, orgId: string, c: { type: string; [k: string]: unknown }): Promise<string[] | null> {
  if (!PATIENT_COMMANDS.has(c.type)) return null;
  if (typeof c.personId === 'string' && c.personId) return [c.personId];
  for (const [field, table] of lookups) {
    const id = c[field];
    if (typeof id !== 'string' || !id) continue;
    const found = await db.prepare(`SELECT person_id FROM ${table} WHERE org_id=? AND id=?`).bind(orgId, id).first<{ person_id: string }>();
    return found?.person_id ? [found.person_id] : null;
  }
  return null;
}
