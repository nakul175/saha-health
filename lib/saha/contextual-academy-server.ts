import { db, identity, json, loadFor, rawRuntime } from './server';
import { fail } from './core';
import { scope } from './store';
import { patientId } from './patient-directory';
import { recordAccess, accessRoute } from './access-audit';
import { assertAssignedRead } from './routine-read-guard';
import { contextualAcademy } from './contextual-academy';

export async function contextualAcademyRead(request: Request) {
  const actor = await identity(), query = new URL(request.url).searchParams;
  if ([...query.keys()].some(key => key !== 'personId') || query.getAll('personId').length !== 1)
    fail(400, 'Choose one assigned person.');
  const id = patientId(query.get('personId'));
  const state = await loadFor(actor, request.headers.get('x-saha-organisation'), async () => [id]);
  const member = scope(state, actor.userId);
  if (member.role !== 'asha') fail(403, 'Contextual learning requires an active ASHA membership.');
  const person = state.workspace.people.find(value => value.id === id && value.assigned && value.assignedTo === actor.userId && !value.mergedInto);
  if (!person) fail(404, 'This record is not in your assigned care scope.');
  const learning = await contextualAcademy(rawRuntime(), { task: 'routine-visit', role: member.role });
  await recordAccess(db(), state, actor, member, { action: 'viewPatientRecord', subject: id, personId: id,
    detail: `Contextual learning eligibility only; no patient detail sent to Academy.${accessRoute(member, person)}` });
  // The content digest and audit both await work. Recheck the exact assignment
  // immediately before disclosure so changed authority cannot expose content.
  await assertAssignedRead(db(), member, state.organisation.id, { personId: id });
  const response = json(learning);
  response.headers.set('X-Saha-Operation-Actor', actor.userId);
  return response;
}
