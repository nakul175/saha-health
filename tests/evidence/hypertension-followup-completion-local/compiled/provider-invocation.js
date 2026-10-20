import { digest, fail } from './core.js';
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export function deploymentAgreement(runtime, providerId) {
    let all;
    try {
        all = JSON.parse(runtime.SAHA_PROVIDER_AGREEMENTS_JSON ?? '{}');
    }
    catch {
        fail(409, 'Provider deployment agreements are invalid; nothing was sent.');
    }
    const raw = (all && typeof all === 'object' && !Array.isArray(all)) ? all[providerId] : undefined;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        fail(409, 'No server-approved deployment agreement covers this provider; nothing was sent.');
    const x = raw;
    if (typeof x.reference !== 'string' || x.purpose !== 'documentary-evidence' || x.trainingUse !== 'not-authorised' || !Array.isArray(x.permittedData) || !Array.isArray(x.hostingRegions) || !Array.isArray(x.subprocessors) || !Number.isInteger(x.maximumRetentionDays))
        fail(409, 'The server-held provider agreement is incomplete; nothing was sent.');
    if (!same(x.permittedData, ['documentary-source']) || x.hostingRegions.some(v => typeof v !== 'string') || x.subprocessors.some(v => typeof v !== 'string') || x.maximumRetentionDays < 0)
        fail(409, 'The server-held provider agreement is incompatible; nothing was sent.');
    return x;
}
export async function authorizeProviderInvocation(entry, runtime, payload, at = new Date().toISOString()) {
    if (entry.spec.kind !== 'capability')
        fail(409, 'A reviewed capability is required; nothing was sent.');
    const c = entry.spec;
    const agreement = deploymentAgreement(runtime, c.providerId);
    if (c.purpose !== agreement.purpose || c.agreementReference !== agreement.reference || c.trainingUse !== agreement.trainingUse || !c.permittedData || !same(c.permittedData, agreement.permittedData) || c.retentionDays === undefined || c.retentionDays > agreement.maximumRetentionDays || !agreement.hostingRegions.includes(c.hostingRegion) || !c.subprocessors || !same(c.subprocessors, agreement.subprocessors))
        fail(409, 'Provider retention, training, subprocessor, region or purpose terms are incompatible; nothing was sent.');
    return { contract: 'saha-provider-invocation-v1', providerId: c.providerId, capabilityId: entry.id, capabilityVersion: entry.version, manifestHash: entry.manifestHash, purpose: c.purpose, data: ['documentary-source'], payloadHash: await digest(payload), agreementHash: await digest(agreement), checkedAt: at };
}
