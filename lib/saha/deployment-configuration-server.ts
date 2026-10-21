import { identity, activeOrg, db, json } from './server';
import { readState, scope } from './store';
import { fail } from './core';
import { recordAccess } from './access-audit';
import { deploymentConfigurationView } from './deployment-configuration';

export async function deploymentConfigurationRead(request: Request) {
  const actor = await identity();
  const requested = request.headers.get('x-saha-organisation');
  if (!requested) fail(400, 'Choose one explicit organisation.');
  if (new URL(request.url).search) fail(400, 'Deployment configuration accepts no URL instructions.');
  const expectedActor = request.headers.get('x-saha-operation-actor');
  if (expectedActor && expectedActor !== actor.userId) fail(403, 'The signed-in deployment account changed.');
  const org = await activeOrg(actor, requested);
  const before = await readState(db(), org, [], actor.userId, true), member = scope(before, actor.userId);
  const beforeCount = await db().prepare('SELECT count(*) AS n FROM patients WHERE org_id=?').bind(org).first<{ n: number }>();
  const value = deploymentConfigurationView(before, member, Number(beforeCount?.n ?? 0));
  await recordAccess(db(), before, actor, member, { action: 'viewWorkspace', subject: org, personId: null, detail: 'Read tenant-scoped deployment configuration and validation references; no patient record or provider payload returned.' });
  const after = await readState(db(), org, [], actor.userId, true), afterMember = scope(after, actor.userId);
  const afterCount = await db().prepare('SELECT count(*) AS n FROM patients WHERE org_id=?').bind(org).first<{ n: number }>();
  const current = deploymentConfigurationView(after, afterMember, Number(afterCount?.n ?? 0));
  if (JSON.stringify(value) !== JSON.stringify(current)) fail(409, 'Deployment configuration or referenced settings changed. Refresh.');
  const response = json(current);
  response.headers.set('x-saha-operation-actor', actor.userId);
  response.headers.set('x-saha-organisation', org);
  return response;
}
