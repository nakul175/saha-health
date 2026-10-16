export type ApprovedCondition={
 field:'systolic'|'diastolic'|'weight'|'temperature'|'weeks'|'coughDays'|'workerConcern';
 operator:'gte'|'lte'|'eq'|'missing';
 value:string;
};

export type ConfirmedRuleInput={
 value:string|number|null|undefined;
 observedAt:string|null|undefined;
 evaluatedAt:string;
 maxObservationAgeHours:number;
};

export type ApprovedRuleResult={
 state:'matched'|'not-matched'|'unknown';
 evidence:'confirmed'|'missing'|'stale'|'future'|'invalid';
};

// This evaluator intentionally accepts only an approved condition and confirmed factual
// input. Free-form prompts, generated explanations and model output have no place in the
// decision boundary, so adding or rephrasing them on a caller object cannot alter a result.
export function evaluateApprovedCondition(condition:ApprovedCondition,input:ConfirmedRuleInput):ApprovedRuleResult{
 const value=input.value,missing=value===undefined||value===null||value===''||value==='unknown';
 if(missing)return {state:condition.operator==='missing'?'matched':'unknown',evidence:'missing'};
 const observed=Date.parse(input.observedAt??''),evaluated=Date.parse(input.evaluatedAt),age=evaluated-observed;
 if(!Number.isFinite(observed)||!Number.isFinite(evaluated))return {state:'unknown',evidence:'invalid'};
 if(age< -300000)return {state:'unknown',evidence:'future'};
 if(age>input.maxObservationAgeHours*3600000)return {state:condition.operator==='missing'?'matched':'unknown',evidence:'stale'};
 if(condition.operator==='missing')return {state:'not-matched',evidence:'confirmed'};
 if(condition.operator==='eq')return {state:String(value)===condition.value?'matched':'not-matched',evidence:'confirmed'};
 const actual=typeof value==='number'?value:Number(value),threshold=Number(condition.value);
 if(!Number.isFinite(actual)||!Number.isFinite(threshold))return {state:'unknown',evidence:'invalid'};
 return {state:condition.operator==='gte'?(actual>=threshold?'matched':'not-matched'):(actual<=threshold?'matched':'not-matched'),evidence:'confirmed'};
}
