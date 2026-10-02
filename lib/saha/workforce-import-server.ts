import { identity, loadFor, json, rawRuntime } from './server';
import { fail } from './core';
import { scope } from './store';
import { boundedJsonBody } from './request-body';
import { environmentOf } from './environment';
import { planWorkforceImport, publicWorkforcePlan, workforceImportInput } from './workforce-import';
// Slice 10d: read-only dry run for the workforce roster import (owners). The file travels in the request body, never in
// the URL; the response carries row numbers, actions, roles, team names, counts and reasons, never names, account codes
// or staff ids. Applying needs the returned plan hash and the same file (`workforceImportApply`).
export async function workforceImportDryRun(request:Request){
 const u=await identity();const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin requests are not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');
 const parsed=workforceImportInput.safeParse(await boundedJsonBody(request,20000));if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid import.');
 const e=environmentOf(rawRuntime());if(e.name==='misconfigured')fail(409,'The environment is not configured correctly. Imports are refused until it is corrected.');
 const s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 return json({...publicWorkforcePlan(await planWorkforceImport(s,m,parsed.data.csv,e.name)),generatedAt:new Date().toISOString()});
}
