// General operational output has a deliberately tiny allow-list. Never pass a URL,
// header, request/response body, patient/member identifier, free text, provider
// payload, credential, prompt, recording or raw exception to these functions.
const ROUTE=/^[a-z][a-z0-9-]{0,63}$/;
const REQUEST_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FAILURE_CODES=['request-metrics-unavailable','work-burden-counter-unavailable','workspace-operation-failed'] as const;
type FailureCode=typeof FAILURE_CODES[number];

function boundedInteger(value:number,max:number){return Number.isFinite(value)?Math.min(max,Math.max(0,Math.round(value))):0;}

export function safeRequestEvent(route:string,status:number,durationMs:number,requestId:string){
 if(!ROUTE.test(route))throw new Error('Unsafe operational route label.');
 if(!REQUEST_ID.test(requestId))throw new Error('Unsafe request correlation identifier.');
 return {event:'saha_request' as const,requestId,route,status:boundedInteger(status,599),durationMs:boundedInteger(durationMs,86_400_000)};
}

export function safeFailureEvent(code:FailureCode,error:unknown,requestId?:string){
 if(!FAILURE_CODES.includes(code))throw new Error('Unknown operational failure code.');
 const kind=error instanceof TypeError?'type':error instanceof RangeError?'range':error instanceof DOMException&&error.code===DOMException.ABORT_ERR?'abort':'unknown';
 return {event:'saha_failure' as const,code,kind,...(requestId&&REQUEST_ID.test(requestId)?{requestId}:{})};
}

export function writeRequestEvent(route:string,status:number,durationMs:number,requestId:string){console.log(JSON.stringify(safeRequestEvent(route,status,durationMs,requestId)));}
export function writeFailureEvent(code:FailureCode,error:unknown,requestId?:string){console.error(JSON.stringify(safeFailureEvent(code,error,requestId)));}
