import { z } from 'zod';
import { db, identity, json, loadFor, runtime, command } from './server';
import { fail } from './core';
import { scope } from './store';
import { environmentOf } from './environment';
import { patientId } from './patient-directory';
import { recordAccess, accessRoute } from './access-audit';
import { boundedJsonBody } from './request-body';
import { routineVisit, type RoutineContext } from './routine-visit';

const operation = z.object({ personId: z.string(), command: z.record(z.unknown()) }).strict();
const permitted = new Set(['startVisit', 'saveVisit', 'saveProgrammeAnswers', 'confirmVisit']);

async function context(request: Request, id: string, selected?: string): Promise<RoutineContext> {
  const actor = await identity();
  if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
    fail(409, 'Routine capture requires a synthetic or training workspace.');
  const state = await loadFor(actor, request.headers.get('x-saha-organisation'), async () => [id]);
  const member = scope(state, actor.userId);
  if (member.role !== 'asha') fail(403, 'Routine capture requires an active ASHA membership.');
  const person = state.workspace.people.find(p => p.id === id && p.assigned && p.assignedTo === actor.userId && !p.mergedInto);
  if (!person) fail(404, 'This record is not in your assigned care scope.');
  const visit = selected
    ? state.workspace.visits.find(v => v.id === selected && v.personId === id)
    : state.workspace.visits.find(v => v.personId === id && v.state === 'draft' && !v.voidedAt && !v.supersededBy);
  if (selected && !visit) fail(404, 'This visit does not belong to the selected person.');
  await recordAccess(db(), state, actor, member, {
    action: 'viewPatientRecord', subject: id, personId: id,
    detail: `Bounded routine visit context.${accessRoute(member, person)}`,
  });
  return { organisationId: state.organisation.id,
    person: { id: person.id, name: person.name, village: person.village, age: person.age, sex: person.sex, version: person.version },
    visit: visit ? routineVisit(visit) : null };
}

export async function routineRead(request: Request) {
  await identity();
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(k => !['personId', 'visitId'].includes(k)) ||
      query.getAll('personId').length !== 1 || query.getAll('visitId').length > 1)
    fail(400, 'Choose one person and at most one visit.');
  const id = patientId(query.get('personId'));
  const selected = query.has('visitId') ? patientId(query.get('visitId')) : undefined;
  return json(await context(request, id, selected));
}

export async function routineWrite(request: Request) {
  await identity();
  if (new URL(request.url).search) fail(400, 'Routine changes do not accept query selectors.');
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site')
    fail(403, 'Cross-origin changes are not allowed.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Use JSON for this operation.');
  const parsed = operation.safeParse(await boundedJsonBody(request, 20000));
  if (!parsed.success) fail(422, 'Choose one person and one supported routine operation.');
  const input = parsed.data, id = patientId(input.personId), c = input.command;
  if (typeof c.type !== 'string' || !permitted.has(c.type)) fail(422, 'Unsupported routine operation.');
  if (c.type !== 'startVisit' && typeof c.visitId !== 'string') fail(422, 'Choose a visit reference.');
  const selected = c.type === 'startVisit' ? undefined : patientId(c.visitId as string);
  await context(request, id, selected);
  if (c.type === 'startVisit' && c.personId !== id) fail(409, 'The operation belongs to another person.');
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  // The existing dispatcher remains the only writer, including version, purpose, receipt and audit checks.
  const result = await command(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(c) }));
  const visitId = c.type === 'startVisit' ? result.result?.visitId : selected;
  return json({ result: result.result, replayed: Boolean(result.replayed),
    context: await context(request, id, typeof visitId === 'string' ? visitId : selected) });
}
