import { identity, loadFor, json } from './server';
import { allowed } from './access';
import { fail } from './core';
import { scope } from './store';
import { boundedJsonBody } from './request-body';
import { matchInput, patientMatches, openPatientWork } from './continuity';
export async function matchesRead(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin patient searches are unavailable.');if(request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-site patient searches are unavailable.');if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for patient search.');
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId),parsed=matchInput.safeParse(await boundedJsonBody(request,3000));if(!parsed.success)fail(422,'Enter valid patient demographics and a care team.');return json(await patientMatches(s,m,parsed.data));
}
export async function continuityRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);if(m.role==='admin')fail(403,'Patient access is required.');
 const people=s.workspace.people.filter(p=>allowed(m,p)).map(p=>{const work=openPatientWork(s,p),handover=p.assignmentHistory?.at(-1),missing=work.filter(t=>!s.members.some(owner=>owner.userId===t.ownerId&&['asha','clinician'].includes(owner.role)&&allowed(owner,p)));return {id:p.id,name:p.name,age:p.age,sex:p.sex,village:p.village,version:p.version,teamId:p.teamId,assignedTo:p.assignedTo,identityReview:p.identityReview??null,handover:handover??null,work,unavailableOwners:missing.length};}).filter(p=>p.unavailableOwners||p.identityReview?.state==='provisional'||(p.handover?.ownerId&&!p.handover.acknowledgement));
 return json({generatedAt:new Date().toISOString(),people,canAssign:(m.isOwner||m.role==='supervisor'),canResolveIdentity:m.role==='clinician',scope:'Only patients in your current care scope; unavailable task owners and unacknowledged handovers remain visible.'});
}
