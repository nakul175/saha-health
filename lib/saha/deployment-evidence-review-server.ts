import { z } from 'zod';
import { identity, db, json, runtime } from './server';
import { readState, scope } from './store';
import { fail } from './core';
import { recordAccess } from './access-audit';
import { environmentOf } from './environment';
import { projectDeploymentEvidence } from './deployment-evidence-review';
import { deploymentEvidenceTransferProof, DEPLOYMENT_EVIDENCE_TRANSFER_SQL } from './deployment-evidence-review-read-guard';

const orgId = z.string().trim().min(1).max(200);
const queries = ['SELECT id,name,revision FROM organisations WHERE id=?', 'SELECT m.user_id,m.role,m.status,m.version,m.is_owner,a.display_name FROM memberships m JOIN accounts a ON a.user_id=m.user_id WHERE m.org_id=? ORDER BY m.user_id', 'SELECT user_id,team_id FROM team_members WHERE org_id=? ORDER BY user_id,team_id', 'SELECT id,name FROM teams WHERE org_id=? ORDER BY id', 'SELECT id,version,kind,status,data FROM integrations WHERE org_id=? ORDER BY id', 'SELECT data FROM operations WHERE org_id=?', 'SELECT data FROM governance WHERE org_id=?', DEPLOYMENT_EVIDENCE_TRANSFER_SQL];
async function proof(org: string) { return (await db().batch(queries.map(sql => db().prepare(sql).bind(org)))).map(x => x.results); }
export async function deploymentEvidenceRead(request: Request) {
  if (!['synthetic', 'training'].includes(environmentOf(runtime()).name)) fail(409, 'Use a synthetic or training evidence-review workspace.');
  const actor = await identity(), parsed = orgId.safeParse(request.headers.get('x-saha-organisation'));
  if (!parsed.success) fail(400, 'Choose one explicit organisation.');
  const org = parsed.data, expected = request.headers.get('x-saha-operation-actor');
  if (expected !== null && expected !== actor.userId) fail(403, 'The signed-in review account changed.');
  if (new URL(request.url).search) fail(400, 'Evidence review accepts no URL instructions.');
  const before = await proof(org), s = await readState(db(), org, [], actor.userId, true), m = scope(s, actor.userId);
  if (!m.isOwner || m.role !== 'clinician') fail(403, 'A current clinician organisation owner is required.');
  for (const [i, loaded] of [[5, s.operations], [6, s.governance]] as const) {
    if (before[i].length > 1) fail(503, 'Current review source is unavailable.');
    const raw = before[i].length ? JSON.parse((before[i][0] as { data: string }).data) : undefined;
    if (raw !== undefined && (!raw || typeof raw !== 'object' || Array.isArray(raw))) fail(503, 'Current review source is unavailable.');
    if (JSON.stringify(raw ?? {}) !== JSON.stringify(loaded ?? {})) fail(409, 'Current review source changed.');
  }
  const connectors = before[4] as { id: string; version: number; kind: string; status: string; data: string }[];
  if (connectors.length !== s.workspace.integrations.length) fail(409, 'Registered provider context changed.');
  for (const row of connectors) {
    const raw = JSON.parse(row.data), loaded = s.workspace.integrations.find(x => x.id === row.id);
    if (!loaded || raw.id !== row.id || raw.version !== row.version || raw.kind !== row.kind || raw.status !== row.status || JSON.stringify(raw) !== JSON.stringify(loaded)) fail(409, 'Registered provider context changed.');
  }
  const transfer = deploymentEvidenceTransferProof(before[7], new Date().toISOString());
  const view = await projectDeploymentEvidence(s, actor.userId, before, runtime(), transfer.refreshAt);
  await recordAccess(db(), s, actor, m, { action: 'viewWorkspace', subject: org, detail: 'Capability evidence and recorded local review/state separately; no patient data, provider invocation, approval, activation or deployment.' });
  const final = await proof(org);
  if (JSON.stringify(before) !== JSON.stringify(final)) fail(409, 'Evidence, provider or review authority changed before publication. Refresh.');
  deploymentEvidenceTransferProof(final[7], new Date().toISOString());
  if (view.refreshAt && Date.parse(view.refreshAt) <= Date.now()) fail(409, 'Assignment context expired before publication.');
  const response = json(view);
  response.headers.set('x-saha-operation-actor', actor.userId);
  response.headers.set('x-saha-organisation', org);
  return response;
}
