import type { DataFlowAuthority } from './data-flow-authority';

export function defaultDataFlowPurpose(targetKind: DataFlowAuthority['targetKind']): DataFlowAuthority['accessPurpose'] {
  return targetKind === 'provider' ? 'ai-assistance' : 'programme-delivery';
}

export function selectedDataFlowAuthority(records: DataFlowAuthority[] | undefined, targetId: string, purpose: DataFlowAuthority['accessPurpose']) {
  return records?.find(record => record.targetId === targetId && record.accessPurpose === purpose);
}
