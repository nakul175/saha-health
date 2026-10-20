import {serviceDispatch} from './service-dispatch';
import { checkCapabilityBudget, entryFor } from './governance';
import { checkTaskAttempts } from './task-limits';
import { checkAgentSource, collectSensitive } from './agent-minimisation';
import { AppError, fail, visit } from './core';
import { auditAgent, current, describeConflicts, markConflicts, providers, type AgentCommand, type AgentOutput } from './agent';
import { AGENT_CONTRACT, AgentContractError, invokeAgent } from './agent-provider';
import { linkTrace } from './trace';
import { persist, readState, scope, type Actor } from './store';
import { assertApprovedExecution } from './approved-execution';
import type { D1Database } from '@cloudflare/workers-types';
import type { OrgState, Member } from './types';
import { AssistanceLimiter } from './assistance-executor';
export async function executeAgent(db:D1Database,s:OrgState,c:Extract<AgentCommand,{type:'executeAgent'}>,u:Actor,m:Member,key:string,hash:string,runtime:Record<string,string|undefined>){
 const before=structuredClone(s),v=visit(s.workspace,c.visitId),r=v.agentRuns?.find(r=>r.id===c.runId);if(!r)fail(404,'Assistant request not found.');if(r.actorId!==u.userId)fail(403,'Only the requesting worker can approve this task.');if(r.inputHash!==c.inputHash)fail(409,'Review the exact current request before approval.');
 if(r.status!=='pending')return {runId:r.id,status:r.status};
	 current(s,v,r,m,u,providers(s.workspace.integrations,runtime));assertApprovedExecution(r.approvedExecution,r.task,r.provider.mode,m.role);if(r.governance){const e=entryFor(s,r.governance.id);checkCapabilityBudget(s,e,r.id);checkTaskAttempts(s,e,v,r.task,r.id);}
	 const limiter=new AssistanceLimiter(r.limits??null);const held=limiter.beforeStep();if(held)fail(429,'This assistance task reached its configured execution limit before a provider call. No request was sent.');
	 r.execution=limiter.snapshot();r.status='running';r.startedAt=new Date().toISOString();r.approvedAt=r.startedAt;r.callCount=1;r.message='Request checkpoint saved. Executor-owned limits permit one invocation; automatic retries and provider-requested limit changes are disabled.';auditAgent(s,u,m,v,'executeAgent','Worker approved the exact input hash and provider. Bounded invocation reserved before sending.');linkTrace(before,s,c.type,key,u.userId);
 // Commit the receipt BEFORE the provider call. Concurrent retries replay this
 // checkpoint. Interrupted calls remain visible as running/unknown, never resent.
 await persist(db,before,s,u,c,key,hash,{runId:r.id,status:'running'});
 // Slice R42: inside the external-execution checkpoint, the source is re-checked on the committed state before
 // the provider call; a refusal here sends nothing and marks the run failed, never a blind retry.
 const sensitive=collectSensitive(s);
	 let outcome:Awaited<ReturnType<typeof invokeAgent>>|undefined,problem='',quarantineReason='';try{if(r.provider.mode!=='local')checkAgentSource(r.input,s);await serviceDispatch(db,s,u,m,r.provider.id,v.personId,{intent:'send',purpose:'ai-assistance',authorize:(latest,member)=>{const lv=visit(latest.workspace,v.id),lr=lv.agentRuns?.find(x=>x.id===r.id);if(!lr||lr.status!=='running'||lr.inputHash!==r.inputHash)fail(409,'Assistant checkpoint changed.');current(latest,lv,lr,member,u,providers(latest.workspace.integrations,runtime));if(lr.provider.mode!=='local'){checkAgentSource(lr.input,latest);for(const value of collectSensitive(latest))sensitive.add(value);}}});outcome=await invokeAgent(r,v,runtime,s.workspace.integrations,fetch,sensitive);limiter.record('provider-invocation','completed','Provider result returned for human review.',false);limiter.finish();}catch(e){problem=e instanceof AppError?e.message:'Provider unavailable. No automatic retry was sent.';if(e instanceof AgentContractError)quarantineReason=e.message;limiter.record('provider-invocation','unresolved',problem,false);limiter.finish();}
 for(let attempt=0;attempt<3;attempt++){
  const after=await readState(db,s.organisation.id);try{scope(after,u.userId);}catch{}const old=structuredClone(after);const target=after.workspace.visits.find(x=>x.id===v.id),run=target?.agentRuns?.find(x=>x.id===r.id);if(!target||!run)fail(409,'The assistant checkpoint is no longer available.');if(run.status!=='running')return {runId:run.id,status:run.status};
	  let member:Member|undefined;try{member=scope(after,u.userId);visit(after.workspace,target.id);current(after,target,run,member,u,providers(after.workspace.integrations,runtime));assertApprovedExecution(run.approvedExecution,run.task,run.provider.mode,member.role);}catch{problem='Result withheld: patient access, permission, visit, provider or approved tool changed during execution.';run.status='blocked';}
	  if(run.status==='running')run.status=problem?'failed':'review';run.finishedAt=new Date().toISOString();run.message=problem||outcome!.message;run.execution=limiter.snapshot();if(quarantineReason){delete run.output;delete run.assessment;delete run.usage;run.quarantine={reason:quarantineReason,contract:AGENT_CONTRACT,providerId:run.provider.id,providerVersion:run.provider.version,model:run.provider.model,at:run.finishedAt,noResultStored:true};}  if(!problem){run.output=outcome!.output;run.warnings=outcome!.warnings;run.usage='usage' in outcome!?outcome!.usage:undefined;if('inputQuality' in outcome!&&outcome!.inputQuality)run.inputQuality=outcome!.inputQuality;const assessed=(outcome!.output as AgentOutput).assessment;if(assessed)run.assessment=assessed;
   // Slice 5c: flag disagreement with recorded facts and other open results on both sides; nothing is combined.
   if(run.status==='review'){markConflicts(target);if(run.conflicts?.length)run.warnings.push('Conflicting values: '+describeConflicts(run.conflicts)+'. Applying any of them needs an explicit choice and a reason.');}}
  run.steps[1]={...run.steps[1],state:problem?'blocked':'done',detail:run.message};if(problem)run.steps[2].state='blocked';auditAgent(after,u,member??m,target,'agentResult',`${run.provider.name}: ${run.status}.${quarantineReason?' Invalid provider output quarantined; no clinical result stored.':''} ${run.message}`);linkTrace(old,after,'agentResult','agent_finish_'+run.id,u.userId);
  try{await persist(db,old,after,u,{type:'agentResult'},'agent_finish_'+run.id,run.inputHash,{runId:run.id,status:run.status});return {runId:run.id,status:run.status};}catch(e){if(!(e instanceof AppError&&e.status===409)||attempt===2)throw e;}
 }
 fail(409,'Result remains unconfirmed. Refresh; the provider will not be called again.');
}
