import { db, identity, json, loadFor, runtime } from './server';
import { fail } from './core';
import { scope, type Actor } from './store';
import { environmentOf } from './environment';
import { patientId } from './patient-directory';
import { accessRoute, recordAccess } from './access-audit';
import { recordPatientList } from './read-audit';
import { todayRecord, todayRow } from './today';
import { assertAssignedRead } from './routine-read-guard';

async function assignedRecords(actor: Actor, organisationId: string | null, id: string | null) {
  const state = await loadFor(actor, organisationId, id ? async () => [id] : undefined, !id);
  const member = scope(state, actor.userId);
  if (member.role !== 'asha') fail(403, 'Today requires an active ASHA membership.');
  if (state.paging) fail(409, 'This workspace shape is not supported by Today.');
  const records = state.workspace.people.filter(
    (person) => person.assigned && person.assignedTo === actor.userId && !person.mergedInto,
  );
  if (id && !records.some(person => person.id === id)) fail(404, 'This record is not in your assigned care scope.');
  return { state, member, records };
}

export async function todayRead(request: Request) {
  const actor = await identity();
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some((key) => key !== 'personId') || query.getAll('personId').length > 1) {
    fail(400, 'Choose one record or return to Today.');
  }
  const id = query.has('personId') ? patientId(query.get('personId')) : null;
  const environment = environmentOf(runtime()).name;
  if (environment !== 'synthetic' && environment !== 'training') {
    fail(409, 'Today is available only in the synthetic or training workspace.');
  }
  const { state, member, records } = await assignedRecords(actor,
    request.headers.get('x-saha-organisation'), id);
  if (id) {
    const person = records.find((person) => person.id === id);
    if (!person) fail(404, 'This record is not in your assigned care scope.');
    await recordAccess(db(), state, actor, member, {
      action: 'viewPatientRecord',
      subject: id,
      personId: id,
      detail: `Read-only identity context opened from Today.${accessRoute(member, person!)}`,
    });
    await assertAssignedRead(db(), member, state.organisation.id, { personId: id });
    const response = json({ record: todayRecord(person!) });
    response.headers.set('x-saha-organisation', state.organisation.id);
    return response;
  }
  await recordPatientList(
    db(),
    state.organisation.id,
    actor,
    member,
    { text: false, programme: false, later: false },
    records.length,
    records.length,
  );
  // Keep the single audit's captured count aligned with the returned snapshot.
  // A scope change refuses the response; it never introduces newly readable rows.
  await assertAssignedRead(db(), member, state.organisation.id, { ids: records.map(person => person.id) });
  const response = json({ records: records.map(todayRow) });
  response.headers.set('x-saha-organisation', state.organisation.id);
  return response;
}
