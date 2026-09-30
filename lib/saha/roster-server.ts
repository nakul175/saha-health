import { identity, loadFor, json } from './server';
import { fail } from './core';
import { scope } from './store';
import { boundedJsonBody } from './request-body';
import { rosterDiff, rosterInput } from './roster';
// Slice 1d: read-only roster preview for owners. Applying needs the returned hash.
export async function rosterPreview(request:Request){
 const u=await identity();const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin requests are not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');
 const parsed=rosterInput.safeParse(await boundedJsonBody(request,20000));if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid roster.');
 const s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);if(!m.isOwner)fail(403,'Only an organisation owner can preview a roster.');
 return json(await rosterDiff(s,parsed.data.rows,parsed.data.complete,u.userId));
}
