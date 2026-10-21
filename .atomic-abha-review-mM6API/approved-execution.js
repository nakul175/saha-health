import { fail } from './core.js';
export const EXECUTION_CATALOGUE_VERSION = 'saha-approved-tools-1';
// This is the executable registry. Tool selection comes only from the parsed
// command and current provider mode; patient notes and provider output are
// never consulted when resolving a path.
const CATALOGUE = Object.freeze({
    extract: Object.freeze({ toolId: 'agent.extract-evidence.v1', providerModes: Object.freeze(['local', 'openai', 'http']), roles: Object.freeze(['asha', 'clinician']) }),
    summary: Object.freeze({ toolId: 'agent.source-excerpts.v1', providerModes: Object.freeze(['local', 'openai', 'http']), roles: Object.freeze(['asha', 'clinician']) }),
    review: Object.freeze({ toolId: 'agent.programme-requirements.v1', providerModes: Object.freeze(['local']), roles: Object.freeze(['asha', 'clinician']) }),
});
export function approvedExecutionFor(task, providerMode, role) {
    const entry = CATALOGUE[task];
    if (!entry.providerModes.includes(providerMode))
        fail(422, 'This provider is not approved for the selected tool.');
    if (!entry.roles.includes(role))
        fail(403, 'A care role is required for this approved tool.');
    return { catalogueVersion: EXECUTION_CATALOGUE_VERSION, toolId: entry.toolId, inputContract: 'agent-source-v1', outputContract: 'agent-evidence-v1', authorityClass: 'care-role-own-request', confirmation: 'exact-input-hash' };
}
export function assertApprovedExecution(snapshot, task, providerMode, role) {
    const current = approvedExecutionFor(task, providerMode, role);
    if (!snapshot || JSON.stringify(snapshot) !== JSON.stringify(current))
        fail(409, 'The approved execution path changed or is missing. Prepare a fresh request.');
    return current;
}
