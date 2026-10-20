import { identity, db, runtime, command, json } from './server';
import { environmentOf } from './environment';
import { boundedJsonBody } from './request-body';
import { fail, digest } from './core';
import { federationCommand, federationEvent, type FederationMember } from './organisational-federation';

export async function organisationalFederationWrite(request: Request) {
  if (!['synthetic','training'].includes(environmentOf(runtime()).name)) fail(409, 'Federation qualification is available only in a synthetic or training workspace.');
  if (new URL(request.url).search) fail(400, 'Choose one organisation using its context header.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Use JSON.');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin)) fail(403, 'Cross-origin federation events are unavailable.');
  const actor = await identity(), org = request.headers.get('x-saha-organisation');
  if (!org) fail(400, 'Choose one organisation.');
  if (request.headers.get('x-saha-operation-actor') !== actor.userId) fail(403, 'Use the original deployment administrator account.');
  const owner = await db().prepare("SELECT is_owner,status FROM memberships WHERE org_id=? AND user_id=?").bind(org, actor.userId).first<{is_owner:number;status:string}>();
  if (!owner || owner.status !== 'active' || owner.is_owner !== 1) fail(403, 'A current organisation owner is required.');
  const parsed = federationEvent.safeParse(await boundedJsonBody(request, 30000));
  if (!parsed.success) fail(422, 'Use one complete authoritative workforce event and reviewed local mapping set.');
  const event = parsed.data;
  const target = await db().prepare("SELECT m.user_id,m.role,m.status,m.version,m.is_owner,a.account_code FROM memberships m JOIN accounts a ON a.user_id=m.user_id WHERE m.org_id=? AND a.account_code=?").bind(org,event.subjectAccountCode).first<FederationMember & {user_id:string;account_code:string;is_owner:number}>();
  if (!target) fail(404, 'The authoritative subject is not an existing member of this organisation.');
  const member: FederationMember = { userId: target.user_id, accountCode: target.account_code, role: target.role, status: target.status, version: target.version, isOwner: target.is_owner === 1, teamIds: (await db().prepare('SELECT team_id FROM team_members WHERE org_id=? AND user_id=? ORDER BY team_id').bind(org,target.user_id).all<{team_id:string}>()).results.map(x=>x.team_id) };
  let prepared;
  try { prepared = federationCommand(member,event); } catch (e) { fail(409, e instanceof Error ? e.message : 'Federation target is unavailable.'); }
  for (const team of prepared!.teamIds) if (!(await db().prepare('SELECT 1 AS ok FROM teams WHERE org_id=? AND id=?').bind(org,team).first())) fail(422, 'A reviewed mapping names a team outside this organisation.');
  const key = `federation-${event.eventId}`;
  const headers = new Headers(request.headers); headers.delete('content-length'); headers.set('idempotency-key',key);
  const body = { ...prepared! }; delete (body as {decision?:unknown}).decision;
  const result = await command(new Request(request.url,{method:'POST',headers,body:JSON.stringify(body)}));
  const response = json({ eventId:event.eventId, eventHash:await digest(event), mappingVersion:event.mappingVersion, decision:prepared!.decision, replayed:result.replayed === true, result:result.result });
  response.headers.set('x-saha-organisation',org); response.headers.set('x-saha-operation-actor',actor.userId); return response;
}
