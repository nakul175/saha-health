import { fail } from './core';
import { reportingScope } from './delegation';
import { ensurePurpose } from './purpose-scope';
import { allowed } from './access';
import type { Member, OrgState, Person } from './types';

// BR-REP-04 keeps patient records outside aggregate reporting authority. A caller must
// first obtain the patient through its ordinary viewer-scoped partition, then pass this
// separate reporting-purpose gate. Reporting delegation can authorise aggregates but
// cannot make an otherwise inaccessible patient record available.
export function reportingPatientAccess(state: OrgState, member: Member, person: Person) {
  ensurePurpose(member, 'reporting', state.operations?.purposeGrants);
  const report = reportingScope(state, member);
  if (!allowed(member, person) || !report.include(person)) fail(403, 'Current reporting scope and separate patient access are both required.');
  return { teams: report.teams, delegated: report.delegations.map(d => d.id) };
}
