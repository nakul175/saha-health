import { boundedJsonBody } from './request-body.js';
import { db, identity, json, runtime } from './server.js';
import { beginRecovery, completeRecovery, recoverySchema } from './authentication-recovery.js';
import { fail } from './core.js';
import { uuid } from './core.js';
import { identityConfig, signOutPath } from './identity.js';
const read = async (userId) => db().prepare('SELECT user_id,recovery_id,state,revoked_before,data FROM credential_recoveries WHERE user_id=?').bind(userId).first();
export async function authenticationRecoveryRead() {
    const principal = await identity(), row = await read(principal.userId);
    return json({ recovery: row ? JSON.parse(row.data) : null });
}
export async function authenticationRecoveryWrite(request) {
    const principal = await identity();
    const parsed = recoverySchema.safeParse(await boundedJsonBody(request, 4096));
    if (!parsed.success)
        fail(400, parsed.error.issues[0]?.message ?? 'Invalid recovery request.');
    const current = await read(principal.userId);
    if (parsed.data.action === 'begin') {
        const record = beginRecovery(principal, parsed.data.reason);
        const statements = await db().batch([db().prepare(`INSERT INTO credential_recoveries(user_id,recovery_id,state,revoked_before,data,updated_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET recovery_id=excluded.recovery_id,state=excluded.state,
      revoked_before=excluded.revoked_before,data=excluded.data,updated_at=excluded.updated_at`)
                .bind(principal.userId, record.id, record.state, record.revokedBefore, JSON.stringify(record), record.createdAt),
            db().prepare('INSERT INTO credential_recovery_events(id,user_id,recovery_id,action,at,data) VALUES(?,?,?,?,?,?)')
                .bind(uuid(), principal.userId, record.id, 'superseded-credentials-revoked', record.createdAt, JSON.stringify({ authority: parsed.data.authority, reason: record.reason }))]);
        if (statements.some(result => !result.success))
            throw new Error('Recovery revocation was not stored.');
        return json({ recovery: record, reauthenticationRequired: true, reauthenticationPath: signOutPath(identityConfig(runtime())) });
    }
    if (!current || current.recovery_id !== parsed.data.recoveryId)
        fail(404, 'Recovery not found.');
    const record = completeRecovery(principal, JSON.parse(current.data));
    const statements = await db().batch([db().prepare(`UPDATE credential_recoveries SET state=?,data=?,updated_at=?
    WHERE user_id=? AND recovery_id=? AND state='revoked-pending-activation'`)
            .bind(record.state, JSON.stringify(record), record.completedAt, principal.userId, record.id),
        db().prepare('INSERT INTO credential_recovery_events(id,user_id,recovery_id,action,at,data) VALUES(?,?,?,?,?,?)')
            .bind(uuid(), principal.userId, record.id, 'replacement-credential-activated', record.completedAt, JSON.stringify({ credentialId: record.replacementCredentialId }))]);
    if (!statements[0].success || statements[0].meta.changes !== 1 || !statements[1].success || statements[1].meta.changes !== 1)
        fail(409, 'Recovery changed before activation.');
    return json({ recovery: record, reauthenticationRequired: false });
}
