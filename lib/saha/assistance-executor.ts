import type {TaskLimits} from './task-limits';

export type AssistanceAction={id:string;state:'completed'|'cancelled'|'unresolved';detail:string;externallyAccepted:boolean};
export type AssistanceExecution={reason:'completed'|'cancelled'|'step-limit'|'tool-call-limit'|'retry-limit'|'deadline';steps:number;toolCalls:number;retries:number;actions:AssistanceAction[]};

// Counters are executor-owned. Provider/model output cannot raise the reviewed bounds.
export class AssistanceLimiter{
 private readonly started:number;private steps=0;private toolCalls=0;private retries=0;private actions:AssistanceAction[]=[];private stopped:AssistanceExecution['reason']|null=null;
 constructor(private readonly limits:TaskLimits|null,private readonly now:()=>number=Date.now,private readonly cancelled:()=>boolean=()=>false){this.started=now();}
 private deadline(){return (this.limits?.timeMinutes??15)*60000;}
 private stop(reason:AssistanceExecution['reason']){this.stopped??=reason;return this.snapshot();}
 beforeStep(){if(this.cancelled())return this.stop('cancelled');if(this.now()-this.started>=this.deadline())return this.stop('deadline');if(this.steps>=(this.limits?.steps??1))return this.stop('step-limit');this.steps++;return null;}
 beforeToolCall(){if(this.cancelled())return this.stop('cancelled');if(this.toolCalls>=(this.limits?.toolCalls??0))return this.stop('tool-call-limit');this.toolCalls++;return null;}
 beforeRetry(){if(this.cancelled())return this.stop('cancelled');if(this.retries>=(this.limits?.retries??0))return this.stop('retry-limit');this.retries++;return null;}
 record(id:string,state:AssistanceAction['state'],detail:string,externallyAccepted=false){if(!id.trim()||!detail.trim())throw Error('Action evidence requires an identifier and detail.');this.actions.push({id,state,detail,externallyAccepted});}
 finish(){return this.stop(this.cancelled()?'cancelled':'completed');}
 snapshot():AssistanceExecution{return {reason:this.stopped??'completed',steps:this.steps,toolCalls:this.toolCalls,retries:this.retries,actions:this.actions.map(x=>({...x}))};}
}
