import { db, identity, json, loadFor, runtime } from './server';
import { fail } from './core';
import { scope } from './store';
import { environmentOf } from './environment';
import { patientId } from './patient-directory';
import { accessRoute, recordAccess } from './access-audit';
import { assertAssignedRead } from './routine-read-guard';
import { packAt } from './programmes';
import { programmeEpisode, type ProgrammeStatusResponse } from './programme-status';

export async function programmeStatusRead(request: Request) {
  const actor = await identity(), query = new URL(request.url).searchParams;
  if (query.getAll('personId').length !== 1 || [...query.keys()].some(key => key !== 'personId')) fail(400, 'Choose one assigned record.');
  const id = patientId(query.get('personId')), organisationId = request.headers.get('x-saha-organisation');
  if (!organisationId) fail(400, 'Choose the organisation returned by Today.');
  const environment = environmentOf(runtime()).name;
  if (!['synthetic', 'training'].includes(environment)) fail(409, 'Programme status is available only in synthetic or training workspaces.');
  const state = await loadFor(actor, organisationId, async () => [id]), member = scope(state, actor.userId);
  if (member.role !== 'asha') fail(403, 'Programme status requires an active ASHA membership.');
  const p = state.workspace.people.find(p => p.id === id && p.assigned && p.assignedTo === actor.userId && !p.mergedInto);
  if (!p) fail(404, 'This record is not in your assigned care scope.');
  const value: ProgrammeStatusResponse = { organisationId: state.organisation.id, actorId: actor.userId,
    person: { id: p.id, name: p.name, village: p.village, version: p.version },
    episodes: (p.enrolments ?? []).map(e => programmeEpisode(e, packAt(e.packId, e.packVersion, state)?.name ?? e.packId)) };
  await recordAccess(db(), state, actor, member, { action: 'viewPatientRecord', subject: id, personId: id, detail: `Bounded programme episode status read: ${value.episodes.length} local episodes; simulator evidence only.${accessRoute(member, p)}` });
  // Same final consistent membership/assignment/purpose/facility guard as Today.
  await assertAssignedRead(db(), member, state.organisation.id, { personId: id });
  const response = json(value); response.headers.set('x-saha-organisation', state.organisation.id); response.headers.set('x-saha-operation-actor', actor.userId);
  return response;
}
