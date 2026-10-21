import { fail } from './core';
import type { Member } from './types';

export const EXECUTION_CATALOGUE_VERSION='saha-approved-tools-1';

export type ApprovedExecution={
 catalogueVersion:typeof EXECUTION_CATALOGUE_VERSION;
 toolId:'agent.extract-evidence.v1'|'agent.source-excerpts.v1'|'agent.programme-requirements.v1';
 inputContract:'agent-source-v1';
 outputContract:'agent-evidence-v1';
 authorityClass:'care-role-own-request';
 confirmation:'exact-input-hash';
};

type Task='extract'|'summary'|'review';
type ProviderMode='local'|'openai'|'http';

// This is the executable registry. Tool selection comes only from the parsed
// command and current provider mode; patient notes and provider output are
// never consulted when resolving a path.
const CATALOGUE:Readonly<Record<Task,Readonly<{
 toolId:ApprovedExecution['toolId'];
 providerModes:readonly ProviderMode[];
 roles:readonly Member['role'][];
}>>>=Object.freeze({
 extract:Object.freeze({toolId:'agent.extract-evidence.v1',providerModes:Object.freeze(['local','openai','http'] as const),roles:Object.freeze(['asha','clinician'] as const)}),
 summary:Object.freeze({toolId:'agent.source-excerpts.v1',providerModes:Object.freeze(['local','openai','http'] as const),roles:Object.freeze(['asha','clinician'] as const)}),
 review:Object.freeze({toolId:'agent.programme-requirements.v1',providerModes:Object.freeze(['local'] as const),roles:Object.freeze(['asha','clinician'] as const)}),
});

export function approvedExecutionFor(task:Task,providerMode:ProviderMode,role:Member['role']):ApprovedExecution{
 const entry=CATALOGUE[task];
 if(!entry.providerModes.includes(providerMode))fail(422,'This provider is not approved for the selected tool.');
 if(!entry.roles.includes(role))fail(403,'A care role is required for this approved tool.');
 return {catalogueVersion:EXECUTION_CATALOGUE_VERSION,toolId:entry.toolId,inputContract:'agent-source-v1',outputContract:'agent-evidence-v1',authorityClass:'care-role-own-request',confirmation:'exact-input-hash'};
}

export function assertApprovedExecution(snapshot:ApprovedExecution|undefined,task:Task,providerMode:ProviderMode,role:Member['role']){
 const current=approvedExecutionFor(task,providerMode,role);
 if(!snapshot||JSON.stringify(snapshot)!==JSON.stringify(current))fail(409,'The approved execution path changed or is missing. Prepare a fresh request.');
 return current;
}
