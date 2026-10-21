import { entryFor } from './governance.js';
export const PROMPT_RELEASE = { id: 'documentary-evidence', version: '1.2.0' };
export const TOOL_RELEASE = { contract: 'saha-agent-v1', version: 1 };
export const DATA_RELEASE = { inputSchema: 'saha-documentary-evidence-input-v1', outputSchema: 'saha-evidence-v1', version: 1 };
export function versionPin(s, provider, agentRelease, governance) {
    if (!governance)
        return {
            format: 'saha-ai-version-pin-v1', capability: null,
            provider: { id: provider.id, release: provider.version }, modelRelease: provider.model,
            agentRelease, prompt: PROMPT_RELEASE, tool: TOOL_RELEASE, data: DATA_RELEASE, evaluation: null,
        };
    const entry = entryFor(s, governance.id);
    if (entry.version !== governance.version || entry.manifestHash !== governance.manifestHash)
        throw new Error('Capability version pin changed.');
    const evaluationId = entry.review?.evaluationId;
    const evaluation = evaluationId ? s.governance?.evaluations.find(x => x.id === evaluationId) : undefined;
    if (!evaluation || evaluation.entryId !== entry.id || evaluation.manifestHash !== entry.manifestHash ||
        evaluation.state !== 'completed' || !evaluation.metrics?.passed)
        throw new Error('Approved evaluation version is unavailable.');
    return {
        format: 'saha-ai-version-pin-v1', capability: governance,
        provider: { id: provider.id, release: provider.version }, modelRelease: provider.model,
        agentRelease, prompt: PROMPT_RELEASE, tool: TOOL_RELEASE, data: DATA_RELEASE,
        evaluation: { id: evaluation.id, corpusVersion: evaluation.corpusVersion, corpusHash: evaluation.corpusHash, manifestHash: evaluation.manifestHash },
    };
}
export const sameVersionPin = (a, b) => !!a && JSON.stringify(a) === JSON.stringify(b);
export function assertCompleteVersionPin(pin) {
    if (!pin || pin.format !== 'saha-ai-version-pin-v1' || !pin.provider.id || !Number.isInteger(pin.provider.release) ||
        pin.provider.release < 1 || !pin.modelRelease || !pin.agentRelease || !pin.prompt.version ||
        !pin.tool.contract || !pin.data.inputSchema || !pin.data.outputSchema)
        throw new Error('Assistant version evidence is missing or unsupported.');
    if (pin.capability && (!pin.evaluation || pin.evaluation.manifestHash !== pin.capability.manifestHash))
        throw new Error('Assistant evaluation is not bound to the approved capability version.');
}
