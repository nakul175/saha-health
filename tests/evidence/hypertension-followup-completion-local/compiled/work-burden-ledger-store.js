import { guarded, appendCommandAuthority } from './store.js';
import { linkRows, chainMoved, chainBackoff } from './audit-chain.js';
import { fail, uuid } from './core.js';
// Internal fixed-table append. This does not change clinical revisions, receipts,
// persisted clinical records or their authority. Caller authorizes the context.
export async function appendBurdenLedger(database, state, actor, member, entry, event, requiredMembers = [], tail) {
    if (!['work_burden_samples', 'work_support_events'].includes(entry.table))
        throw Error('Unknown work ledger');
    const org = state.organisation.id, config = state.operations?.workBurden;
    if (!config?.enabled)
        return { disabled: true, recorded: false };
    const prior = async () => { const p = await database.prepare(`SELECT input_hash FROM ${entry.table} WHERE org_id=? AND actor_id=? AND id=?`).bind(org, actor.userId, entry.values.id).first(); if (p && p.input_hash !== entry.values.input_hash)
        fail(409, 'This work entry key identifies another entry.'); return p; };
    if (await prior())
        return { recorded: false, replayed: true };
    const rows = [entry, { table: 'audit_events', keys: ['org_id', 'id'], append: true, values: { org_id: org, id: event.id, person_id: event.personId ?? null, actor_id: actor.userId, actor_name: actor.displayName, role: member.role, action: event.action, subject: event.subject, detail: event.detail, at: event.at } }];
    appendCommandAuthority(rows, state, [], 'pre-mutation', actor.userId);
    for (let attempt = 0; attempt < 6; attempt++) {
        const token = uuid(), chain = await linkRows(database, org, rows, event.at), members = [member, ...requiredMembers], clauses = members.map(() => "EXISTS (SELECT 1 FROM memberships WHERE org_id=? AND user_id=? AND status='active' AND version=? AND role=?)");
        const head = database.prepare(`UPDATE organisations SET last_command=? WHERE id=? AND revision=? AND patient_revision=? AND ${clauses.join(' AND ')} AND EXISTS (SELECT 1 FROM operations WHERE org_id=? AND json_extract(data,'$.workBurden.enabled')=1 AND json_extract(data,'$.workBurden.version')=?) ${entry.table === 'work_burden_samples' ? 'AND (SELECT count(*) FROM work_burden_samples WHERE org_id=? AND visit_id=?)<500' : ''} ${tail ? 'AND COALESCE((SELECT max(sequence) FROM work_support_events WHERE org_id=? AND request_id=?),0)=?' : ''} AND NOT EXISTS (SELECT 1 FROM ${entry.table} WHERE org_id=? AND actor_id=? AND id=?)`).bind(token, org, state.organisation.revision, state.organisation.patientRevision ?? 0, ...members.flatMap(m => [org, m.userId, m.version, m.role]), org, config.version, ...(entry.table === 'work_burden_samples' ? [org, entry.values.visit_id] : []), ...(tail ? [org, tail.requestId, tail.sequence] : []), org, actor.userId, entry.values.id);
        let result;
        try {
            result = await database.batch([head, ...guarded(database, org, token, chain.genesis ? [chain.genesis, ...rows] : rows)]);
        }
        catch (e) {
            if (await prior())
                return { recorded: false, replayed: true };
            if (await chainMoved(database, org, chain.base) && attempt < 5) {
                await chainBackoff(attempt + 1);
                continue;
            }
            throw e;
        }
        if (result[0].meta.changes === 1)
            return { recorded: true, replayed: false };
        if (await prior())
            return { recorded: false, replayed: true };
        fail(409, 'Work context or current authority changed. Refresh without repeating clinical work.');
    }
    fail(409, 'Work ledger contention. Keep the same metadata key.');
}
