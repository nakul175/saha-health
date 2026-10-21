import { identity, db, json, runtime } from './server.js';
import { readState, scope } from './store.js';
import { environmentOf } from './environment.js';
import { patientId } from './patient-directory.js';
import { fail } from './core.js';
import { recordAccess } from './access-audit.js';
import { serviceAuthoritySelection, serviceAuthorityProjection } from './service-authority-review.js';
const PROOF = ["SELECT id,name,revision,created_at FROM organisations WHERE id=?", "SELECT m.user_id,m.role,m.status,m.version,m.is_owner,a.display_name FROM memberships m JOIN accounts a ON a.user_id=m.user_id WHERE m.org_id=? ORDER BY m.user_id", "SELECT user_id,team_id FROM team_members WHERE org_id=? ORDER BY user_id,team_id", "SELECT data FROM operations WHERE org_id=?", "SELECT id,name FROM teams WHERE org_id=? ORDER BY id", "SELECT id,data FROM integrations WHERE org_id=? ORDER BY id"];
async function proof(org) { return (await db().batch(PROOF.map(sql => db().prepare(sql).bind(org)))).map(r => r.results); }
async function read(actor, org, choice) { const state = await readState(db(), org, [], actor.userId, true), member = scope(state, actor.userId); if (!member.isOwner)
    fail(403, 'Current organisation owner authority is required.'); let value; try {
    value = serviceAuthorityProjection(state, actor.userId, choice, new Date().toISOString());
}
catch {
    fail(409, 'Recorded authority is inconsistent, changed or unavailable. Refresh current access.');
} return { state, member, value }; }
export async function serviceAuthorityRead(request) { if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
    fail(409, 'Use a synthetic or training workspace.'); const actor = await identity(), org = patientId(request.headers.get('x-saha-organisation')), bound = request.headers.get('x-saha-operation-actor'); if (bound && bound !== actor.userId)
    fail(403, 'The signed-in account changed. Return to organisation settings.'); let choice; try {
    choice = serviceAuthoritySelection(new URL(request.url).searchParams);
}
catch {
    fail(400, 'Choose one exact authority and current operations version.');
} const beforeProof = await proof(org), before = await read(actor, org, choice); if (JSON.stringify(beforeProof) !== JSON.stringify(await proof(org)))
    fail(409, 'Authority context changed while opening. Refresh.'); await recordAccess(db(), before.state, actor, before.member, { action: 'viewWorkspace', subject: org, personId: null, detail: 'Read-only recorded service/delegation metadata, no credential issuance or external call.' }); const after = await read(actor, org, choice); const withoutTime = (r) => { const { evaluatedAt, ...rest } = r; void evaluatedAt; return JSON.stringify(rest); }; if (withoutTime(before.value) !== withoutTime(after.value) || before.member.version !== after.member.version)
    fail(409, 'Recorded authority changed. Refresh.'); const finalProof = await proof(org); if (JSON.stringify(beforeProof) !== JSON.stringify(finalProof))
    fail(409, 'Current organisation or authority context changed. Refresh.'); let final; try {
    final = serviceAuthorityProjection(after.state, actor.userId, choice, new Date().toISOString());
}
catch {
    fail(409, 'Recorded authority became unavailable. Refresh.');
} if (withoutTime(after.value) !== withoutTime(final))
    fail(409, 'An authority interval changed. Refresh.'); const response = json(final); response.headers.set('x-saha-operation-actor', actor.userId); response.headers.set('x-saha-organisation', org); return response; }
