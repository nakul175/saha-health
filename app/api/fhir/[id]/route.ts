import { measured } from '@/lib/saha/monitoring';
import { fhirDocument } from '@/lib/saha/fhir-document';
import { identity, loadFor, json, error } from '@/lib/saha/server';
import { visit, person, fail } from '@/lib/saha/core';
import { fhirExample } from '@/lib/saha/fhir';
import { ensureExceptionalScope } from '@/lib/saha/exceptional';
import { scope } from '@/lib/saha/store';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){return measured(_,'fhir',async()=>{try{const {id}=await params;const u=await identity();const orgId=new URL(_.url).searchParams.get('organisationId');const s=await loadFor(u,orgId);const w=s.workspace;const v=visit(w,id);ensureExceptionalScope(s,scope(s,u.userId),{type:'exportFhir',visitId:id});if(v.voidedAt||v.supersededBy)fail(409,'This visit is no longer current. Use revision history to inspect the original.');if(v.state!=='confirmed')fail(409,'Confirm the visit before exporting.');const p=person(w,v.personId);return new Response(JSON.stringify(new URL(_.url).searchParams.get('format')==='document'?fhirDocument(p,v,s.organisation.name,u.displayName):fhirExample(p,v),null,2),{headers:{'Content-Type':'application/fhir+json','Content-Disposition':`attachment; filename="saha-synthetic-${v.id}.json"`,'Cache-Control':'no-store'}});}catch(e){return error(e);}});}
