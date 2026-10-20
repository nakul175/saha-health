const digest = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map(x => x.toString(16).padStart(2, '0')).join('');
const canonical = (facts) => ({
    actorId: facts.actorId,
    actorVersion: facts.actorVersion,
    taskId: facts.taskId,
    taskVersion: facts.taskVersion,
    evidenceHash: facts.evidenceHash,
    action: facts.action,
    destination: facts.destination,
    purpose: facts.purpose,
    capabilityVersions: Object.fromEntries(Object.entries(facts.capabilityVersions).sort(([a], [b]) => a.localeCompare(b))),
});
export async function bindActionAuthority(facts, approvedAt, ttlMs) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0)
        throw Error('Action authority expiry must be positive.');
    return { ...facts, approvedAt, expiresAt: new Date(Date.parse(approvedAt) + ttlMs).toISOString(), bindingHash: await digest(canonical(facts)) };
}
export async function actionAuthorityCurrent(approval, facts, now) {
    if (!approval || Date.parse(approval.expiresAt) < Date.parse(now))
        return false;
    const currentHash = await digest(canonical(facts));
    return approval.bindingHash === currentHash && approval.bindingHash === await digest(canonical(approval));
}
