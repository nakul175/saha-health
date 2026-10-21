import type { NeedId } from './referral-needs';
import type { Urgency } from './referral-rules';
export type PackCondition={questionId:string;operator:'gte'|'lte'|'eq'|'missing';value:string};
export type CompletionRule={id:string;label:string;requiredQuestions:string[];when?:PackCondition};
export type DeclaredReferralNeed={id:string;need:NeedId;needLabel?:string;compatibilityKey:string|null;urgency:Urgency;when?:PackCondition;dependsOnCompletionRules?:string[]};
export type CompletionContract={rule:CompletionRule;packId:string;packVersion:number;installationId:string;manifestHash:string};
