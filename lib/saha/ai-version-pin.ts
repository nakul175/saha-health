import type { AgentProvider } from './agent';
import type { OrgState } from './types';
import { entryFor } from './governance';
import { DATA_RELEASE, PROMPT_RELEASE, TOOL_RELEASE } from './ai-version-releases';

/**
 * Immutable release identity attached to every assistant request.  The fields are
 * deliberately independent: a provider alias or unchanged model name cannot hide
 * a prompt, tool, data contract, capability, or evaluation change.
 */
export type AIVersionPin = {
  format: 'saha-ai-version-pin-v1';
  capability: { id: string; version: number; manifestHash: string } | null;
  provider: { id: string; release: number };
  modelRelease: string;
  agentRelease: string;
  prompt: { id: 'documentary-evidence'; version: '1.2.0' };
  tool: { contract: 'saha-agent-v1'; version: 1 };
  data: { inputSchema: 'saha-documentary-evidence-input-v1'; outputSchema: 'saha-evidence-v1'; version: 1 };
  evaluation: { id: string; corpusVersion: string; corpusHash: string; manifestHash: string } | null;
};

export { DATA_RELEASE, PROMPT_RELEASE, TOOL_RELEASE } from './ai-version-releases';

export function versionPin(
  s: OrgState,
  provider: AgentProvider,
  agentRelease: string,
  governance: { id: string; version: number; manifestHash: string } | null,
): AIVersionPin {
  if (!governance) return {
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

export const sameVersionPin = (a: AIVersionPin | undefined, b: AIVersionPin) =>
  !!a && JSON.stringify(a) === JSON.stringify(b);

export function assertCompleteVersionPin(pin: AIVersionPin | undefined) {
  if (!pin || pin.format !== 'saha-ai-version-pin-v1' || !pin.provider.id || !Number.isInteger(pin.provider.release) ||
      pin.provider.release < 1 || !pin.modelRelease || !pin.agentRelease || !pin.prompt.version ||
      !pin.tool.contract || !pin.data.inputSchema || !pin.data.outputSchema)
    throw new Error('Assistant version evidence is missing or unsupported.');
  if (pin.capability && (!pin.evaluation || pin.evaluation.manifestHash !== pin.capability.manifestHash))
    throw new Error('Assistant evaluation is not bound to the approved capability version.');
}
