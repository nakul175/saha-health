import { z } from 'zod';
import { db, identity, loadFor, runtime, json, command } from './server';
import { fail } from './core';
import { scope } from './store';
import { patientId } from './patient-directory';
import { environmentOf } from './environment';
import { recordAccess, accessRoute } from './access-audit';
import { assertAssignedRead } from './routine-read-guard';
import { boundedJsonBody } from './request-body';
import { openPatientWork } from './continuity';
import type { HandoverContext } from './handover';
const operation = z.object({ personId: z.string(), command: z.object({ type: z.literal('acknowledgeAssignment'), personId: z.string(), version: z.number().int().positive(), assignmentId: z.string().trim().min(1).max(200), reference: z.string().trim().min(1).max(200) }).strict() }).strict();
async function context(request: Request, id: string): Promise<HandoverContext> {
  const actor = await identity(), org = request.headers.get('x-saha-organisation');
  if (!org) fail(400, 'Choose the organisation returned by Today.');
  if (!['synthetic', 'training'].includes(environmentOf(runtime()).name)) fail(409, 'Handover review requires a synthetic or training workspace.');
  const state = await loadFor(actor, org, async () => [id]), member = scope(state, actor.userId);
  if (member.role !== 'asha') fail(403, 'Handover review requires an active ASHA membership.');
  const p = state.workspace.people.find(p => p.id === id && p.assigned && p.assignedTo === actor.userId && !p.mergedInto);
  if (!p) fail(404, 'This record is not in your assigned care scope.');
  const value: HandoverContext = { organisationId: state.organisation.id, actorId: actor.userId,
    person: { id: p.id, name: p.name, village: p.village, version: p.version, teamId: p.teamId },
    handover: p.assignmentHistory?.at(-1) ?? null, work: openPatientWork(state, p) };
  await recordAccess(db(), state, actor, member, { action: 'viewPatientRecord', subject: id, personId: id, detail: `Bounded receiving handover review: ${value.work.length} current open items.${accessRoute(member, p)}` });
  await assertAssignedRead(db(), member, state.organisation.id, { personId: id });
  return value;
}
function response(value: unknown, actorId: string, org: string) { const r = json(value); r.headers.set('x-saha-operation-actor', actorId); r.headers.set('x-saha-organisation', org); return r; }
export async function handoverRead(request: Request) {
  const query = new URL(request.url).searchParams;
  if (query.getAll('personId').length !== 1 || [...query.keys()].some(k => k !== 'personId')) fail(400, 'Choose one assigned record.');
  const value = await context(request, patientId(query.get('personId')));
  return response(value, value.actorId, value.organisationId);
}
export async function handoverWrite(request: Request) {
  const actor = await identity();
  if (request.headers.get('x-saha-operation-actor') !== actor.userId) fail(403, 'The original signed-in account is required to acknowledge or recover this attempt.');
  if (new URL(request.url).search) fail(400, 'Acknowledgement does not accept query selectors.');
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'Cross-origin changes are unavailable.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Use JSON for acknowledgement.');
  const parsed = operation.safeParse(await boundedJsonBody(request, 4000));
  if (!parsed.success) fail(422, 'Choose one current handover and an acknowledgement reference.');
  const id = patientId(parsed.data.personId);
  if (parsed.data.command.personId !== id) fail(409, 'The acknowledgement belongs to another person.');
  const initial = await context(request, id), headers = new Headers(request.headers); headers.delete('content-length'); headers.set('x-saha-organisation', initial.organisationId);
  // The existing dispatcher alone enforces write authority, version, event and
  // immutable receipt/replay rules. No new patient writer or retry is introduced.
  await command(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(parsed.data.command) }));
  const current = await context(request, id);
  return response({ outcome: 'recorded', key: request.headers.get('idempotency-key'), context: current }, actor.userId, initial.organisationId);
}
