import { checkCapabilityBudget, entryFor } from './governance';
import { AppError, fail, visit } from './core';
import { auditAgent, current, providers, type AgentCommand } from './agent';
import { invokeAgent } from './agent-provider';
import { persist, readState, scope, type Actor } from './store';
import type { D1Database } from '@cloudflare/workers-types';
import type { OrgState, Member } from './types';
export async function executeAgent(db:D1Database,s:OrgState,c:Extract<AgentCommand,{type:'executeAgent'}>,u:Actor,m:Member,key:string,hash:string,runtime:Record<string,string|undefined>){
 const before=structuredClone(s),v=visit(s.workspace,c.visitId),r=v.agentRuns?.find(r=>r.id===c.runId);if(!r)fail(404,'Assistant request not found.');if(r.actorId!==u.userId)fail(403,'Only the requesting worker can approve this task.');if(r.inputHash!==c.inputHash)fail(409,'Review the exact current request before approval.');
 if(r.status!=='pending')return {runId:r.id,status:r.status};
 current(s,v,r,m,u,providers(s.workspace.integrations,runtime));if(r.governance)checkCapabilityBudget(s,entryFor(s,r.governance.id),r.id);
 r.status='running';r.startedAt=new Date().toISOString();r.approvedAt=r.startedAt;r.callCount=1;r.message='Request checkpoint saved. One invocation allowed; automatic retries are disabled.';auditAgent(s,u,m,v,'executeAgent','Worker approved the exact input hash and provider. Invocation reserved before sending.');
 // Commit the receipt BEFORE the provider call. Concurrent retries replay this
 // checkpoint. Interrupted calls remain visible as running/unknown, never resent.
 await persist(db,before,s,u,c,key,hash,{runId:r.id,status:'running'});
 let outcome:Awaited<ReturnType<typeof invokeAgent>>|undefined,problem='';try{outcome=await invokeAgent(r,v,runtime,s.workspace.integrations);}catch(e){problem=e instanceof AppError?e.message:'Provider unavailable. No automatic retry was sent.';}
 for(let attempt=0;attempt<3;attempt++){
  const after=await readState(db,s.organisation.id);try{scope(after,u.userId);}catch{}const old=structuredClone(after);const target=after.workspace.visits.find(x=>x.id===v.id),run=target?.agentRuns?.find(x=>x.id===r.id);if(!target||!run)fail(409,'The assistant checkpoint is no longer available.');if(run.status!=='running')return {runId:run.id,status:run.status};
  let member:Member|undefined;try{member=scope(after,u.userId);visit(after.workspace,target.id);current(after,target,run,member,u,providers(after.workspace.integrations,runtime));}catch{problem='Result withheld: patient access, permission, visit or provider changed during execution.';run.status='blocked';}
  if(run.status==='running')run.status=problem?'failed':'review';run.finishedAt=new Date().toISOString();run.message=problem||outcome!.message;
  if(!problem){run.output=outcome!.output;run.warnings=outcome!.warnings;run.usage='usage' in outcome!?outcome!.usage:undefined;}
  run.steps[1]={...run.steps[1],state:problem?'blocked':'done',detail:run.message};if(problem)run.steps[2].state='blocked';auditAgent(after,u,member??m,target,'agentResult',`${run.provider.name}: ${run.status}. ${run.message}`);
  try{await persist(db,old,after,u,{type:'agentResult'},'agent_finish_'+run.id,run.inputHash,{runId:run.id,status:run.status});return {runId:run.id,status:run.status};}catch(e){if(!(e instanceof AppError&&e.status===409)||attempt===2)throw e;}
 }
 fail(409,'Result remains unconfirmed. Refresh; the provider will not be called again.');
}
