import { measured } from '@/lib/saha/monitoring';
import { fhirDocument } from '@/lib/saha/fhir-document';
import { identity, loadFor, json, error, db } from '@/lib/saha/server';
import { accessRoute, recordAccess } from '@/lib/saha/access-audit';
import { visit, person, fail } from '@/lib/saha/core';
import { fhirExample } from '@/lib/saha/fhir';
import { ensureExceptionalScope } from '@/lib/saha/exceptional';
import { ensureNotRestricted } from '@/lib/saha/rights';
import { scope } from '@/lib/saha/store';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){return measured(_,'fhir',async()=>{try{const {id}=await params;const u=await identity();const orgId=new URL(_.url).searchParams.get('organisationId');const s=await loadFor(u,orgId);const w=s.workspace;const v=visit(w,id);ensureExceptionalScope(s,scope(s,u.userId),{type:'exportFhir',visitId:id});ensureNotRestricted(s,{type:'exportFhir',visitId:id});if(v.voidedAt||v.supersededBy)fail(409,'This visit is no longer current. Use revision history to inspect the original.');if(v.state!=='confirmed')fail(409,'Confirm the visit before exporting.');if(v.imported)fail(409,'This visit was imported from another system. It is read-only history and is not exported as a current observation.');const p=person(w,v.personId),m=scope(s,u.userId),document=new URL(_.url).searchParams.get('format')==='document';
// Slice 6t: a FHIR download carries the visit's clinical content, so it is recorded in the audit chain before it is returned.
await recordAccess(db(),s,u,m,{action:'downloadFhir',subject:v.id,personId:p.id,detail:`FHIR ${document?'document':'example'} downloaded for visit ${v.id}.${accessRoute(m,p)}`});return new Response(JSON.stringify(document?fhirDocument(p,v,s.organisation.name,u.displayName):fhirExample(p,v),null,2),{headers:{'Content-Type':'application/fhir+json','Content-Disposition':`attachment; filename="saha-synthetic-${v.id}.json"`,'Cache-Control':'no-store'}});}catch(e){return error(e);}});}
